export interface SafetyCheckResult {
  passed: boolean;
  issues: SafetyIssue[];
  sanitizedContent?: string;
  recommendations: string[];
}

export interface SafetyIssue {
  type: 'toxicity' | 'pii' | 'bias' | 'harmful-content';
  severity: 'low' | 'medium' | 'high';
  description: string;
  location?: { start: number; end: number };
  suggestion?: string;
}

export class SafetyService {
  // Toxicity patterns
  private static toxicPatterns = [
    /\b(hate|attack|kill|destroy)\b/gi,
    /\b(stupid|idiot|dumb)\b/gi,
    /\b(racist|sexist|discriminat)\w*/gi,
  ];

  // PII patterns
  private static piiPatterns = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    phone: /\b(\+\d{1,3}[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}\b/g,
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
    creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    ipAddress: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  };

  // Bias indicators
  private static biasPatterns = [
    /\b(always|never|all|none)\s+(men|women|people|users)\b/gi,
    /\b(obviously|clearly|naturally)\b/gi,
  ];

  /**
   * Perform comprehensive safety check
   */
  static async performSafetyCheck(
    content: string,
    options: {
      checkToxicity?: boolean;
      checkPII?: boolean;
      checkBias?: boolean;
      autoSanitize?: boolean;
    } = {}
  ): Promise<SafetyCheckResult> {
    const {
      checkToxicity = true,
      checkPII = true,
      checkBias = true,
      autoSanitize = false,
    } = options;

    const issues: SafetyIssue[] = [];
    let sanitizedContent = content;
    const recommendations: string[] = [];

    // Check for toxicity
    if (checkToxicity) {
      const toxicityIssues = this.detectToxicity(content);
      issues.push(...toxicityIssues);

      if (autoSanitize && toxicityIssues.length > 0) {
        sanitizedContent = this.sanitizeToxicity(sanitizedContent);
        recommendations.push('Toxic language has been automatically sanitized');
      }
    }

    // Check for PII
    if (checkPII) {
      const piiIssues = this.detectPII(content);
      issues.push(...piiIssues);

      if (autoSanitize && piiIssues.length > 0) {
        sanitizedContent = this.sanitizePII(sanitizedContent);
        recommendations.push('Personal information has been redacted');
      }
    }

    // Check for bias
    if (checkBias) {
      const biasIssues = this.detectBias(content);
      issues.push(...biasIssues);

      if (biasIssues.length > 0) {
        recommendations.push('Consider using more inclusive language');
      }
    }

    const passed = issues.filter(i => i.severity === 'high').length === 0;

    return {
      passed,
      issues,
      sanitizedContent: autoSanitize ? sanitizedContent : undefined,
      recommendations,
    };
  }

  /**
   * Detect toxic content
   */
  private static detectToxicity(content: string): SafetyIssue[] {
    const issues: SafetyIssue[] = [];

    this.toxicPatterns.forEach(pattern => {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        issues.push({
          type: 'toxicity',
          severity: 'high',
          description: `Potentially toxic language detected: "${match[0]}"`,
          location: match.index ? { start: match.index, end: match.index + match[0].length } : undefined,
          suggestion: 'Consider using more neutral language',
        });
      }
    });

    return issues;
  }

  /**
   * Detect PII (Personally Identifiable Information)
   */
  private static detectPII(content: string): SafetyIssue[] {
    const issues: SafetyIssue[] = [];

    Object.entries(this.piiPatterns).forEach(([type, pattern]) => {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        issues.push({
          type: 'pii',
          severity: 'high',
          description: `Potential ${type} detected`,
          location: match.index ? { start: match.index, end: match.index + match[0].length } : undefined,
          suggestion: `Remove or redact ${type}`,
        });
      }
    });

    return issues;
  }

  /**
   * Detect biased language
   */
  private static detectBias(content: string): SafetyIssue[] {
    const issues: SafetyIssue[] = [];

    this.biasPatterns.forEach(pattern => {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        issues.push({
          type: 'bias',
          severity: 'medium',
          description: `Potentially biased language: "${match[0]}"`,
          location: match.index ? { start: match.index, end: match.index + match[0].length } : undefined,
          suggestion: 'Use more inclusive or qualified language',
        });
      }
    });

    return issues;
  }

  /**
   * Sanitize toxic content
   */
  private static sanitizeToxicity(content: string): string {
    let sanitized = content;

    this.toxicPatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    });

    return sanitized;
  }

  /**
   * Sanitize PII
   */
  private static sanitizePII(content: string): string {
    let sanitized = content;

    Object.entries(this.piiPatterns).forEach(([type, pattern]) => {
      sanitized = sanitized.replace(pattern, `[${type.toUpperCase()}_REDACTED]`);
    });

    return sanitized;
  }

  /**
   * Validate prompt before sending to LLM
   */
  static async validatePrompt(prompt: string): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check minimum length
    if (prompt.length < 10) {
      errors.push('Prompt is too short (minimum 10 characters)');
    }

    // Check maximum length
    if (prompt.length > 100000) {
      errors.push('Prompt is too long (maximum 100,000 characters)');
    }

    // Check for common issues
    if (prompt.trim() === '') {
      errors.push('Prompt is empty');
    }

    // Check for potential injection attempts
    const injectionPatterns = [
      /ignore\s+previous\s+instructions/gi,
      /disregard\s+all\s+previous/gi,
      /system\s*:\s*you\s+are/gi,
    ];

    injectionPatterns.forEach(pattern => {
      if (pattern.test(prompt)) {
        warnings.push('Potential prompt injection detected');
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Calculate content safety score
   */
  static async calculateSafetyScore(content: string): Promise<number> {
    const result = await this.performSafetyCheck(content);

    let score = 1.0;

    result.issues.forEach(issue => {
      switch (issue.severity) {
        case 'high':
          score -= 0.3;
          break;
        case 'medium':
          score -= 0.15;
          break;
        case 'low':
          score -= 0.05;
          break;
      }
    });

    return Math.max(score, 0);
  }
}
