/**
 * Safety Middleware
 * Intercepts requests to perform pre-execution safety checks on prompts
 * Detects toxicity, PII, drift, and injection attempts before processing
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  SafetyCheckResult,
  SafetyIssue,
  SafetyCheckType,
  SafetySeverity,
  SafetyMiddlewareConfig,
  DriftAnalysis,
  ContentLocation,
  SafetyAction,
} from '../../types/safety.js';

// Extended request interface with safety context
export interface SafetyRequest extends Request {
  safetyResult?: SafetyCheckResult;
  sanitizedContent?: string;
  originalContent?: string;
}

// Default middleware configuration
const DEFAULT_CONFIG: SafetyMiddlewareConfig = {
  enabled: true,
  blockOnFail: true,
  logRequests: true,
};

// =============================================================================
// PATTERN DEFINITIONS
// =============================================================================

// Toxicity patterns with severity levels
const TOXICITY_PATTERNS: Array<{ pattern: RegExp; severity: SafetySeverity; category: string }> = [
  // Hate speech and discrimination
  { pattern: /\b(hate|attack|kill|destroy|eliminate)\s+(all|every)?\s*(people|humans|users)/gi, severity: 'critical', category: 'hate_speech' },
  { pattern: /\b(racist|sexist|homophobic|transphobic|xenophobic)\b/gi, severity: 'high', category: 'discrimination' },
  { pattern: /\b(nigger|faggot|retard|cunt)\b/gi, severity: 'critical', category: 'slurs' },

  // Threats and violence
  { pattern: /\b(threaten|harm|hurt|abuse|assault)\s+\w+/gi, severity: 'high', category: 'threats' },
  { pattern: /\b(bomb|weapon|explosive|gun)\s+(making|build|create)/gi, severity: 'critical', category: 'violence' },

  // Harassment
  { pattern: /\b(harass|stalk|bully|intimidate)\b/gi, severity: 'high', category: 'harassment' },
  { pattern: /\b(stupid|idiot|dumb|moron|imbecile)\b/gi, severity: 'medium', category: 'insults' },

  // Self-harm
  { pattern: /\b(suicide|self.?harm|kill\s+myself)\b/gi, severity: 'critical', category: 'self_harm' },
];

// PII patterns with redaction templates
const PII_PATTERNS: Array<{ type: string; pattern: RegExp; severity: SafetySeverity; redaction: string }> = [
  // Email addresses
  { type: 'email', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, severity: 'high', redaction: '[EMAIL_REDACTED]' },

  // Phone numbers (various formats)
  { type: 'phone', pattern: /\b(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, severity: 'high', redaction: '[PHONE_REDACTED]' },

  // Social Security Numbers
  { type: 'ssn', pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g, severity: 'critical', redaction: '[SSN_REDACTED]' },

  // Credit Card Numbers
  { type: 'credit_card', pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g, severity: 'critical', redaction: '[CC_REDACTED]' },

  // IP Addresses
  { type: 'ip_address', pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g, severity: 'medium', redaction: '[IP_REDACTED]' },

  // API Keys and Secrets
  { type: 'api_key', pattern: /(?:api[_-]?key|apikey|secret[_-]?key|access[_-]?token|auth[_-]?token|bearer)[=:\s]+['"]?[\w-]{20,}['"]?/gi, severity: 'critical', redaction: '[API_KEY_REDACTED]' },

  // Passwords
  { type: 'password', pattern: /(?:password|passwd|pwd)[=:\s]+['"]?[^\s'"]{8,}['"]?/gi, severity: 'critical', redaction: '[PASSWORD_REDACTED]' },

  // AWS Keys
  { type: 'aws_key', pattern: /(?:AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}/g, severity: 'critical', redaction: '[AWS_KEY_REDACTED]' },

  // Private Keys
  { type: 'private_key', pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:RSA\s+)?PRIVATE\s+KEY-----/g, severity: 'critical', redaction: '[PRIVATE_KEY_REDACTED]' },

  // National ID (Arabic format)
  { type: 'national_id', pattern: /\b[0-9]{14}\b/g, severity: 'high', redaction: '[NATIONAL_ID_REDACTED]' },
];

// Prompt injection patterns
const INJECTION_PATTERNS: Array<{ pattern: RegExp; severity: SafetySeverity; description: string }> = [
  { pattern: /ignore\s+(all\s+)?previous\s+instructions?/gi, severity: 'critical', description: 'Instruction override attempt' },
  { pattern: /disregard\s+(all\s+)?(previous|above|prior)/gi, severity: 'critical', description: 'Disregard instruction attempt' },
  { pattern: /forget\s+(everything|all|what)/gi, severity: 'high', description: 'Memory wipe attempt' },
  { pattern: /you\s+are\s+now\s+(?:a|an)?\s*\w+/gi, severity: 'high', description: 'Role hijacking attempt' },
  { pattern: /pretend\s+(?:to\s+be|you\s+are)/gi, severity: 'high', description: 'Identity manipulation' },
  { pattern: /act\s+as\s+if\s+you/gi, severity: 'medium', description: 'Behavior override attempt' },
  { pattern: /system\s*:\s*you\s+are/gi, severity: 'critical', description: 'System prompt injection' },
  { pattern: /\[INST\]|\[\/INST\]|<<SYS>>|<\|im_start\|>/gi, severity: 'critical', description: 'Template injection attempt' },
  { pattern: /\{\{.*\}\}/g, severity: 'medium', description: 'Template variable injection' },
  { pattern: /jailbreak|DAN\s+mode|bypass\s+restrictions/gi, severity: 'critical', description: 'Jailbreak attempt' },
];

// Bias patterns
const BIAS_PATTERNS: Array<{ pattern: RegExp; severity: SafetySeverity; category: string }> = [
  { pattern: /\b(always|never|all|none)\s+(men|women|people|users|they)\s+(are|will|should)/gi, severity: 'medium', category: 'generalization' },
  { pattern: /\b(obviously|clearly|naturally|everyone\s+knows)\b/gi, severity: 'low', category: 'assumption' },
  { pattern: /\b(normal|abnormal)\s+(people|person|behavior)/gi, severity: 'medium', category: 'normative' },
];

// Security patterns
const SECURITY_PATTERNS: Array<{ pattern: RegExp; severity: SafetySeverity; description: string }> = [
  { pattern: /(?:rm\s+-rf|del\s+\/[fs]|format\s+c:)/gi, severity: 'critical', description: 'Dangerous system command' },
  { pattern: /(?:eval|exec|system|shell_exec|passthru)\s*\(/gi, severity: 'high', description: 'Code execution function' },
  { pattern: /(?:DROP\s+TABLE|DELETE\s+FROM|TRUNCATE|ALTER\s+TABLE)/gi, severity: 'critical', description: 'SQL injection attempt' },
  { pattern: /<script[\s>]|javascript:/gi, severity: 'high', description: 'XSS attempt' },
  { pattern: /\$\{.*\}|\$\(.*\)|`.*`/g, severity: 'medium', description: 'Command substitution' },
];

// =============================================================================
// DETECTION FUNCTIONS
// =============================================================================

function findMatchLocation(content: string, match: RegExpMatchArray): ContentLocation {
  const index = match.index ?? content.indexOf(match[0]);
  const lines = content.substring(0, index).split('\n');
  return {
    start: index,
    end: index + match[0].length,
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  };
}

function detectToxicity(content: string): SafetyIssue[] {
  const issues: SafetyIssue[] = [];

  for (const { pattern, severity, category } of TOXICITY_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      issues.push({
        id: uuidv4(),
        type: 'toxicity',
        severity,
        title: `Toxic content detected: ${category}`,
        description: `Potentially toxic language found: "${match[0]}"`,
        location: findMatchLocation(content, match),
        matchedContent: match[0],
        suggestion: 'Remove or rephrase the toxic content using neutral language',
        autoFixable: true,
        fixedContent: '[CONTENT_REMOVED]',
      });
    }
  }

  return issues;
}

function detectPII(content: string): SafetyIssue[] {
  const issues: SafetyIssue[] = [];

  for (const { type, pattern, severity, redaction } of PII_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      issues.push({
        id: uuidv4(),
        type: 'pii',
        severity,
        title: `PII detected: ${type.replace('_', ' ')}`,
        description: `Potential ${type.replace('_', ' ')} found in content`,
        location: findMatchLocation(content, match),
        matchedContent: match[0].substring(0, 4) + '****',
        suggestion: `Remove or redact the ${type.replace('_', ' ')} before sending`,
        autoFixable: true,
        fixedContent: redaction,
      });
    }
  }

  return issues;
}

function detectInjection(content: string): SafetyIssue[] {
  const issues: SafetyIssue[] = [];

  for (const { pattern, severity, description } of INJECTION_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      issues.push({
        id: uuidv4(),
        type: 'injection',
        severity,
        title: 'Prompt injection detected',
        description,
        location: findMatchLocation(content, match),
        matchedContent: match[0],
        suggestion: 'Remove the injection pattern to maintain prompt integrity',
        autoFixable: false,
      });
    }
  }

  return issues;
}

function detectBias(content: string): SafetyIssue[] {
  const issues: SafetyIssue[] = [];

  for (const { pattern, severity, category } of BIAS_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      issues.push({
        id: uuidv4(),
        type: 'bias',
        severity,
        title: `Potential bias: ${category}`,
        description: `Language that may indicate bias: "${match[0]}"`,
        location: findMatchLocation(content, match),
        matchedContent: match[0],
        suggestion: 'Consider using more inclusive and qualified language',
        autoFixable: false,
      });
    }
  }

  return issues;
}

function detectSecurityIssues(content: string): SafetyIssue[] {
  const issues: SafetyIssue[] = [];

  for (const { pattern, severity, description } of SECURITY_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      issues.push({
        id: uuidv4(),
        type: 'security',
        severity,
        title: 'Security concern detected',
        description,
        location: findMatchLocation(content, match),
        matchedContent: match[0],
        suggestion: 'Remove potentially dangerous commands or patterns',
        autoFixable: false,
      });
    }
  }

  return issues;
}

/**
 * Detect drift from expected context/topic
 */
function detectDrift(content: string, baselineContext?: string): DriftAnalysis {
  const result: DriftAnalysis = {
    driftScore: 0,
    driftType: 'none',
    driftingKeywords: [],
  };

  if (!baselineContext) {
    return result;
  }

  // Extract keywords from baseline
  const baselineWords = new Set(
    baselineContext
      .toLowerCase()
      .split(/\W+/)
      .filter(w => w.length > 3)
  );

  // Extract keywords from content
  const contentWords = content
    .toLowerCase()
    .split(/\W+/)
    .filter(w => w.length > 3);

  // Find words in content not in baseline
  const driftingWords = contentWords.filter(w => !baselineWords.has(w));

  // Calculate drift score
  const uniqueDriftingWords = [...new Set(driftingWords)];
  const driftRatio = uniqueDriftingWords.length / contentWords.length;

  // Detect off-topic indicators
  const offTopicPatterns = [
    /(?:by the way|unrelated|different topic|also|another thing)/gi,
    /(?:forget about|instead of|rather than)/gi,
  ];

  let intentDrift = false;
  for (const pattern of offTopicPatterns) {
    if (pattern.test(content)) {
      intentDrift = true;
      break;
    }
  }

  result.driftScore = Math.min(driftRatio + (intentDrift ? 0.3 : 0), 1);
  result.driftingKeywords = uniqueDriftingWords.slice(0, 10);

  if (result.driftScore > 0.7) {
    result.driftType = 'topic';
    result.recommendation = 'Content appears to be significantly off-topic from the expected context';
  } else if (intentDrift) {
    result.driftType = 'intent';
    result.recommendation = 'Content contains language suggesting a topic change';
  } else if (result.driftScore > 0.4) {
    result.driftType = 'semantic';
    result.recommendation = 'Content has moderate semantic drift from the baseline';
  }

  return result;
}

// =============================================================================
// SANITIZATION
// =============================================================================

function sanitizeContent(content: string, issues: SafetyIssue[]): string {
  let sanitized = content;

  // Sort issues by location (descending) to avoid offset issues
  const sortedIssues = [...issues]
    .filter(issue => issue.autoFixable && issue.location && issue.fixedContent)
    .sort((a, b) => (b.location?.start ?? 0) - (a.location?.start ?? 0));

  for (const issue of sortedIssues) {
    if (issue.location && issue.fixedContent) {
      sanitized =
        sanitized.substring(0, issue.location.start) +
        issue.fixedContent +
        sanitized.substring(issue.location.end);
    }
  }

  return sanitized;
}

// =============================================================================
// MAIN SAFETY CHECK FUNCTION
// =============================================================================

export async function performSafetyCheck(
  content: string,
  options: {
    checkToxicity?: boolean;
    checkPII?: boolean;
    checkDrift?: boolean;
    checkInjection?: boolean;
    checkBias?: boolean;
    checkSecurity?: boolean;
    autoSanitize?: boolean;
    baselineContext?: string;
  } = {}
): Promise<SafetyCheckResult> {
  const startTime = Date.now();

  const {
    checkToxicity = true,
    checkPII = true,
    checkDrift = false,
    checkInjection = true,
    checkBias = true,
    checkSecurity = true,
    autoSanitize = false,
    baselineContext,
  } = options;

  const issues: SafetyIssue[] = [];
  const checksPerformed: SafetyCheckType[] = [];
  const recommendations: string[] = [];

  // Perform checks
  if (checkToxicity) {
    checksPerformed.push('toxicity');
    issues.push(...detectToxicity(content));
  }

  if (checkPII) {
    checksPerformed.push('pii');
    issues.push(...detectPII(content));
  }

  if (checkInjection) {
    checksPerformed.push('injection');
    issues.push(...detectInjection(content));
  }

  if (checkBias) {
    checksPerformed.push('bias');
    issues.push(...detectBias(content));
  }

  if (checkSecurity) {
    checksPerformed.push('security');
    issues.push(...detectSecurityIssues(content));
  }

  if (checkDrift && baselineContext) {
    checksPerformed.push('drift');
    const driftAnalysis = detectDrift(content, baselineContext);
    if (driftAnalysis.driftScore > 0.4) {
      issues.push({
        id: uuidv4(),
        type: 'drift',
        severity: driftAnalysis.driftScore > 0.7 ? 'high' : 'medium',
        title: `Context drift detected: ${driftAnalysis.driftType}`,
        description: driftAnalysis.recommendation ?? 'Content appears to drift from expected context',
        suggestion: 'Consider refocusing the content on the original topic',
        autoFixable: false,
        matchedContent: driftAnalysis.driftingKeywords.join(', '),
      });
    }
  }

  // Calculate score
  let score = 100;
  for (const issue of issues) {
    switch (issue.severity) {
      case 'critical': score -= 30; break;
      case 'high': score -= 20; break;
      case 'medium': score -= 10; break;
      case 'low': score -= 5; break;
      case 'info': score -= 1; break;
    }
  }
  score = Math.max(0, score);

  // Generate recommendations
  const issueTypes = new Set(issues.map(i => i.type));
  if (issueTypes.has('toxicity')) {
    recommendations.push('Remove or rephrase toxic language before sending');
  }
  if (issueTypes.has('pii')) {
    recommendations.push('Redact personal information to protect privacy');
  }
  if (issueTypes.has('injection')) {
    recommendations.push('Remove prompt injection patterns to maintain security');
  }
  if (issueTypes.has('bias')) {
    recommendations.push('Consider using more inclusive language');
  }
  if (issueTypes.has('security')) {
    recommendations.push('Remove potentially dangerous commands or code');
  }

  // Determine if blocked
  const hasCritical = issues.some(i => i.severity === 'critical');
  const hasHighSeverity = issues.some(i => i.severity === 'high');
  const blocked = hasCritical;

  // Sanitize if requested
  let sanitizedContent: string | undefined;
  if (autoSanitize && issues.some(i => i.autoFixable)) {
    sanitizedContent = sanitizeContent(content, issues);
  }

  return {
    passed: !blocked && score >= 50,
    blocked,
    issues,
    sanitizedContent,
    recommendations,
    score,
    checksPerformed,
    processingTimeMs: Date.now() - startTime,
  };
}

// =============================================================================
// MIDDLEWARE FUNCTION
// =============================================================================

export function safetyMiddleware(config: Partial<SafetyMiddlewareConfig> = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  return async (req: SafetyRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!finalConfig.enabled) {
      next();
      return;
    }

    // Extract content from request body
    const content = extractContent(req.body);

    if (!content) {
      next();
      return;
    }

    // Store original content
    req.originalContent = content;

    try {
      // Perform safety check
      const result = await performSafetyCheck(content, {
        checkToxicity: true,
        checkPII: true,
        checkInjection: true,
        checkBias: true,
        checkSecurity: true,
        autoSanitize: true,
      });

      req.safetyResult = result;

      // Log if enabled
      if (finalConfig.logRequests) {
        console.log(`[Safety] Score: ${result.score}, Issues: ${result.issues.length}, Blocked: ${result.blocked}`);
      }

      // Custom handler
      if (finalConfig.customHandler) {
        finalConfig.customHandler(result);
      }

      // Block if needed
      if (result.blocked && finalConfig.blockOnFail) {
        res.status(400).json({
          success: false,
          error: {
            code: 'SAFETY_CHECK_FAILED',
            message: 'Content blocked due to safety concerns',
            details: {
              score: result.score,
              issues: result.issues.map(i => ({
                type: i.type,
                severity: i.severity,
                title: i.title,
              })),
              recommendations: result.recommendations,
            },
          },
        });
        return;
      }

      // Replace content with sanitized version if available
      if (result.sanitizedContent) {
        req.sanitizedContent = result.sanitizedContent;
        replaceContent(req.body, result.sanitizedContent);
      }

      next();
    } catch (error) {
      console.error('[Safety] Error during safety check:', error);
      // Don't block on errors, just log and continue
      next();
    }
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function extractContent(body: any): string | null {
  if (!body) return null;

  // Check common content fields
  if (typeof body.content === 'string') return body.content;
  if (typeof body.prompt === 'string') return body.prompt;
  if (typeof body.text === 'string') return body.text;
  if (typeof body.message === 'string') return body.message;

  // Check for hierarchical prompts
  if (body.hierarchicalPrompt) {
    const parts = [];
    if (body.hierarchicalPrompt.systemPrompt) parts.push(body.hierarchicalPrompt.systemPrompt);
    if (body.hierarchicalPrompt.processPrompt) parts.push(body.hierarchicalPrompt.processPrompt);
    if (body.hierarchicalPrompt.taskPrompt) parts.push(body.hierarchicalPrompt.taskPrompt);
    if (body.hierarchicalPrompt.outputPrompt) parts.push(body.hierarchicalPrompt.outputPrompt);
    if (parts.length > 0) return parts.join('\n\n');
  }

  return null;
}

function replaceContent(body: any, sanitizedContent: string): void {
  if (!body) return;

  if (typeof body.content === 'string') {
    body.content = sanitizedContent;
  } else if (typeof body.prompt === 'string') {
    body.prompt = sanitizedContent;
  } else if (typeof body.text === 'string') {
    body.text = sanitizedContent;
  } else if (typeof body.message === 'string') {
    body.message = sanitizedContent;
  }
}

// Export types
export type { SafetyCheckResult, SafetyIssue };
