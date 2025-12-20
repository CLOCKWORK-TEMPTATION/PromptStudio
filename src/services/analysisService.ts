import type { AnalysisResult, PromptComponent, AnalysisSuggestion, AnalysisWarning, TokenEstimate, TokenVisualization, Token } from '../types';

// =============================================================================
// SAFETY POLICY TYPES
// =============================================================================

export interface SafetyPolicy {
  id: string;
  name: string;
  enabled: boolean;
  blockOnViolation: boolean;
  autoFix: boolean;
}

export interface SafetyCheckResult {
  passed: boolean;
  blocked: boolean;
  score: number;
  issues: SafetyIssue[];
  sanitizedContent?: string;
  recommendations: string[];
  driftAnalysis?: DriftAnalysis;
}

export interface SafetyIssue {
  id: string;
  type: 'toxicity' | 'pii' | 'drift' | 'injection' | 'bias' | 'security';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  location?: { start: number; end: number };
  matchedContent?: string;
  suggestion?: string;
  autoFixable: boolean;
  fixedContent?: string;
}

export interface DriftAnalysis {
  driftScore: number;
  driftType: 'semantic' | 'topic' | 'intent' | 'none';
  originalIntent?: string;
  detectedIntent?: string;
  driftingKeywords: string[];
  recommendation?: string;
}

// =============================================================================
// PATTERN DEFINITIONS
// =============================================================================

const SENSITIVE_PATTERNS = [
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, type: 'email', severity: 'high' as const },
  { pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, type: 'phone', severity: 'high' as const },
  { pattern: /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g, type: 'ssn', severity: 'critical' as const },
  { pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/g, type: 'credit_card', severity: 'critical' as const },
  { pattern: /(?:api[_-]?key|apikey|secret[_-]?key|access[_-]?token|auth[_-]?token)[=:]\s*['"]?[\w-]+['"]?/gi, type: 'api_key', severity: 'critical' as const },
  { pattern: /(?:password|passwd|pwd)[=:]\s*['"]?[^\s'"]+['"]?/gi, type: 'password', severity: 'critical' as const },
  { pattern: /(?:AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}/g, type: 'aws_key', severity: 'critical' as const },
  { pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/g, type: 'private_key', severity: 'critical' as const },
];

const SECURITY_PATTERNS = [
  { pattern: /(?:rm\s+-rf|del\s+\/|format\s+c:)/gi, message: 'Potentially dangerous system command detected', severity: 'critical' as const },
  { pattern: /(?:eval|exec|system)\s*\(/gi, message: 'Code execution function detected', severity: 'high' as const },
  { pattern: /(?:ignore previous|disregard|forget all)/gi, message: 'Potential prompt injection pattern', severity: 'critical' as const },
  { pattern: /(?:you are now|act as if|pretend you)/gi, message: 'Role manipulation attempt detected', severity: 'high' as const },
  { pattern: /(?:DROP\s+TABLE|DELETE\s+FROM|TRUNCATE)/gi, message: 'SQL injection pattern detected', severity: 'critical' as const },
  { pattern: /<script[\s>]|javascript:/gi, message: 'XSS attempt detected', severity: 'critical' as const },
  { pattern: /jailbreak|DAN\s+mode|bypass\s+restrictions/gi, message: 'Jailbreak attempt detected', severity: 'critical' as const },
];

const TOXICITY_PATTERNS = [
  { pattern: /\b(hate|attack|kill|destroy|eliminate)\s+(all|every)?\s*(people|humans|users)/gi, category: 'hate_speech', severity: 'critical' as const },
  { pattern: /\b(racist|sexist|homophobic|transphobic)\b/gi, category: 'discrimination', severity: 'high' as const },
  { pattern: /\b(threaten|harm|hurt|abuse|assault)\s+\w+/gi, category: 'threats', severity: 'high' as const },
  { pattern: /\b(stupid|idiot|dumb|moron)\b/gi, category: 'insults', severity: 'medium' as const },
  { pattern: /\b(harass|stalk|bully|intimidate)\b/gi, category: 'harassment', severity: 'high' as const },
];

const BIAS_PATTERNS = [
  { pattern: /\b(always|never|all|none)\s+(men|women|people)\s+(are|will|should)/gi, category: 'generalization', severity: 'medium' as const },
  { pattern: /\b(obviously|clearly|naturally|everyone\s+knows)\b/gi, category: 'assumption', severity: 'low' as const },
  { pattern: /\b(normal|abnormal)\s+(people|person|behavior)/gi, category: 'normative', severity: 'medium' as const },
];

const ROLE_PATTERNS = [
  /you are(?: a| an)?\s+([^.]+)/i,
  /act(?:ing)? as(?: a| an)?\s+([^.]+)/i,
  /role:\s*([^.\n]+)/i,
  /persona:\s*([^.\n]+)/i,
];

const CONSTRAINT_PATTERNS = [
  /(?:do not|don't|never|must not|should not)\s+([^.]+)/gi,
  /(?:always|must|should|need to)\s+([^.]+)/gi,
  /constraint[s]?:\s*([^.\n]+)/gi,
  /rule[s]?:\s*([^.\n]+)/gi,
];

const OUTPUT_FORMAT_PATTERNS = [
  /(?:format|output|respond|return)(?:\s+(?:as|in|using))?\s*:\s*([^.\n]+)/gi,
  /(?:json|xml|markdown|table|list|bullet)/gi,
  /```[\w]*\n/g,
];

export function analyzePrompt(content: string): AnalysisResult {
  const components = detectComponents(content);
  const suggestions = generateSuggestions(content, components);
  const warnings = detectWarnings(content);
  const tokenEstimate = estimateTokens(content);

  const clarityScore = calculateClarityScore(content, components);
  const specificityScore = calculateSpecificityScore(content, components);
  const structureScore = calculateStructureScore(content, components);
  const overallScore = Math.round((clarityScore + specificityScore + structureScore) / 3);

  return {
    clarity_score: clarityScore,
    specificity_score: specificityScore,
    structure_score: structureScore,
    overall_score: overallScore,
    components,
    suggestions,
    warnings,
    token_estimate: tokenEstimate,
  };
}

function detectComponents(content: string): PromptComponent[] {
  const components: PromptComponent[] = [];

  ROLE_PATTERNS.forEach((pattern) => {
    const match = content.match(pattern);
    if (match) {
      components.push({
        type: 'role',
        content: match[0],
        start: content.indexOf(match[0]),
        end: content.indexOf(match[0]) + match[0].length,
      });
    }
  });

  let constraintMatch;
  CONSTRAINT_PATTERNS.forEach((pattern) => {
    pattern.lastIndex = 0;
    while ((constraintMatch = pattern.exec(content)) !== null) {
      components.push({
        type: 'constraint',
        content: constraintMatch[0],
        start: constraintMatch.index,
        end: constraintMatch.index + constraintMatch[0].length,
      });
    }
  });

  const examplePatterns = [
    /example[s]?:\s*([\s\S]*?)(?=\n\n|$)/gi,
    /for example[,:]?\s*([^.\n]+)/gi,
    /e\.g\.[,:]?\s*([^.\n]+)/gi,
  ];

  examplePatterns.forEach((pattern) => {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(content)) !== null) {
      components.push({
        type: 'example',
        content: match[0],
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  });

  OUTPUT_FORMAT_PATTERNS.forEach((pattern) => {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(content)) !== null) {
      components.push({
        type: 'output_format',
        content: match[0],
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  });

  return components;
}

function generateSuggestions(content: string, components: PromptComponent[]): AnalysisSuggestion[] {
  const suggestions: AnalysisSuggestion[] = [];

  const hasRole = components.some((c) => c.type === 'role');
  if (!hasRole && content.length > 50) {
    suggestions.push({
      type: 'addition',
      message: 'Consider adding a role assignment to improve response quality',
      impact: 'high',
      suggestion: 'Add "You are a [expert type]..." at the beginning',
    });
  }

  const hasExamples = components.some((c) => c.type === 'example');
  if (!hasExamples && content.length > 100) {
    suggestions.push({
      type: 'addition',
      message: 'Adding examples can improve accuracy by up to 40%',
      impact: 'high',
      suggestion: 'Include 2-3 examples of expected input/output',
    });
  }

  const hasOutputFormat = components.some((c) => c.type === 'output_format');
  if (!hasOutputFormat && content.length > 50) {
    suggestions.push({
      type: 'addition',
      message: 'Specify output format for more consistent results',
      impact: 'medium',
      suggestion: 'Add "Output format: [JSON/Markdown/List/etc.]"',
    });
  }

  const hasConstraints = components.some((c) => c.type === 'constraint');
  if (!hasConstraints && content.length > 100) {
    suggestions.push({
      type: 'addition',
      message: 'Adding constraints helps prevent unwanted outputs',
      impact: 'medium',
      suggestion: 'Add specific rules about what to include or avoid',
    });
  }

  const wordCount = content.split(/\s+/).length;
  if (wordCount < 20) {
    suggestions.push({
      type: 'improvement',
      message: 'Prompt may be too brief for complex tasks',
      impact: 'medium',
      suggestion: 'Add more context and specific instructions',
    });
  }

  const vagueWords = ['good', 'nice', 'better', 'best', 'great', 'interesting', 'stuff', 'things'];
  const hasVagueLanguage = vagueWords.some((word) =>
    content.toLowerCase().includes(word)
  );
  if (hasVagueLanguage) {
    suggestions.push({
      type: 'improvement',
      message: 'Contains vague language that may lead to inconsistent results',
      impact: 'low',
      suggestion: 'Replace vague words with specific, measurable criteria',
    });
  }

  return suggestions;
}

function detectWarnings(content: string): AnalysisWarning[] {
  const warnings: AnalysisWarning[] = [];

  SENSITIVE_PATTERNS.forEach(({ pattern, type }) => {
    const match = content.match(pattern);
    if (match) {
      warnings.push({
        type: 'sensitive_data',
        message: `Contains potential ${type.replace('_', ' ')} - consider removing`,
        severity: 'critical',
        location: {
          start: content.indexOf(match[0]),
          end: content.indexOf(match[0]) + match[0].length,
        },
      });
    }
  });

  SECURITY_PATTERNS.forEach(({ pattern, message }) => {
    if (pattern.test(content)) {
      warnings.push({
        type: 'security',
        message,
        severity: 'warning',
      });
    }
  });

  const wordCount = content.split(/\s+/).length;
  if (wordCount > 2000) {
    warnings.push({
      type: 'cost',
      message: 'Very long prompt may result in high token costs',
      severity: 'info',
    });
  }

  return warnings;
}

function calculateClarityScore(content: string, components: PromptComponent[]): number {
  let score = 50;

  const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const avgSentenceLength = sentences.reduce((acc, s) => acc + s.split(/\s+/).length, 0) / sentences.length;

  if (avgSentenceLength < 25) score += 15;
  else if (avgSentenceLength < 35) score += 10;
  else score -= 10;

  const hasStructure = /(?:##|###|\d\.|[-*])/g.test(content);
  if (hasStructure) score += 15;

  if (components.some((c) => c.type === 'role')) score += 10;
  if (components.some((c) => c.type === 'output_format')) score += 10;

  return Math.min(100, Math.max(0, score));
}

function calculateSpecificityScore(content: string, components: PromptComponent[]): number {
  let score = 50;

  const wordCount = content.split(/\s+/).length;
  if (wordCount > 50) score += 10;
  if (wordCount > 100) score += 10;
  if (wordCount > 200) score += 5;

  if (components.some((c) => c.type === 'example')) score += 20;
  if (components.some((c) => c.type === 'constraint')) score += 15;

  const hasNumbers = /\d+/.test(content);
  if (hasNumbers) score += 5;

  const vagueWords = ['good', 'nice', 'better', 'best', 'great', 'interesting'];
  const vagueCount = vagueWords.filter((word) => content.toLowerCase().includes(word)).length;
  score -= vagueCount * 5;

  return Math.min(100, Math.max(0, score));
}

function calculateStructureScore(content: string, components: PromptComponent[]): number {
  let score = 50;

  const hasHeadings = /(?:##|###)/g.test(content);
  if (hasHeadings) score += 15;

  const hasBullets = /(?:[-*]\s)/g.test(content);
  if (hasBullets) score += 10;

  const hasNumberedList = /\d\.\s/g.test(content);
  if (hasNumberedList) score += 10;

  const hasSections = content.split(/\n\n+/).length > 2;
  if (hasSections) score += 10;

  const componentTypes = new Set(components.map((c) => c.type));
  score += componentTypes.size * 5;

  return Math.min(100, Math.max(0, score));
}

function estimateTokens(content: string): TokenEstimate {
  const charCount = content.length;
  const wordCount = content.split(/\s+/).length;

  const gpt4Tokens = Math.ceil(charCount / 4);
  const gpt35Tokens = Math.ceil(charCount / 4);
  const claudeTokens = Math.ceil(charCount / 3.5);
  const llamaTokens = Math.ceil(wordCount * 1.3);

  return {
    gpt4: gpt4Tokens,
    gpt35: gpt35Tokens,
    claude: claudeTokens,
    llama: llamaTokens,
    estimated_cost: {
      'gpt-4': (gpt4Tokens / 1000) * 0.03,
      'gpt-4-turbo': (gpt4Tokens / 1000) * 0.01,
      'gpt-3.5-turbo': (gpt35Tokens / 1000) * 0.0005,
      'claude-3-opus': (claudeTokens / 1000) * 0.015,
      'claude-3-sonnet': (claudeTokens / 1000) * 0.003,
    },
  };
}

export function tokenizeText(content: string, model: string): TokenVisualization {
  const tokens: Token[] = [];
  let currentPos = 0;
  let tokenId = 0;

  const avgCharsPerToken = model.includes('claude') ? 3.5 : 4;

  const words = content.split(/(\s+)/);

  for (const word of words) {
    if (word.length === 0) continue;

    if (word.length <= avgCharsPerToken) {
      tokens.push({
        text: word,
        id: tokenId++,
        start: currentPos,
        end: currentPos + word.length,
      });
    } else {
      let wordPos = 0;
      while (wordPos < word.length) {
        const chunkSize = Math.min(Math.ceil(avgCharsPerToken), word.length - wordPos);
        tokens.push({
          text: word.slice(wordPos, wordPos + chunkSize),
          id: tokenId++,
          start: currentPos + wordPos,
          end: currentPos + wordPos + chunkSize,
        });
        wordPos += chunkSize;
      }
    }
    currentPos += word.length;
  }

  return {
    tokens,
    total: tokens.length,
    model,
  };
}

export function detectVariables(content: string): { name: string; start: number; end: number }[] {
  const variables: { name: string; start: number; end: number }[] = [];

  const patterns = [
    /\{\{(\w+)\}\}/g,
    /@(\w+(?::\w+)?)/g,
    /\$\{(\w+)\}/g,
  ];

  patterns.forEach((pattern) => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      variables.push({
        name: match[1],
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  });

  return variables;
}

export function replaceVariables(content: string, values: Record<string, string>): string {
  let result = content;

  Object.entries(values).forEach(([key, value]) => {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    result = result.replace(new RegExp(`@${key}`, 'g'), value);
    result = result.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
  });

  return result;
}

// =============================================================================
// SAFETY CHECK FUNCTIONS
// =============================================================================

let issueIdCounter = 0;
function generateIssueId(): string {
  return `issue_${Date.now()}_${++issueIdCounter}`;
}

/**
 * Detect toxicity in content
 */
export function detectToxicity(content: string): SafetyIssue[] {
  const issues: SafetyIssue[] = [];

  for (const { pattern, category, severity } of TOXICITY_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      issues.push({
        id: generateIssueId(),
        type: 'toxicity',
        severity,
        title: `محتوى سام: ${category}`,
        description: `تم اكتشاف لغة سامة محتملة: "${match[0]}"`,
        location: match.index !== undefined ? { start: match.index, end: match.index + match[0].length } : undefined,
        matchedContent: match[0],
        suggestion: 'قم بإزالة أو إعادة صياغة المحتوى السام باستخدام لغة محايدة',
        autoFixable: true,
        fixedContent: '[تم الحذف]',
      });
    }
  }

  return issues;
}

/**
 * Detect PII (Personally Identifiable Information)
 */
export function detectPII(content: string): SafetyIssue[] {
  const issues: SafetyIssue[] = [];
  const redactionMap: Record<string, string> = {
    email: '[بريد_محذوف]',
    phone: '[هاتف_محذوف]',
    ssn: '[رقم_ضمان_محذوف]',
    credit_card: '[بطاقة_محذوفة]',
    api_key: '[مفتاح_API_محذوف]',
    password: '[كلمة_سر_محذوفة]',
    aws_key: '[مفتاح_AWS_محذوف]',
    private_key: '[مفتاح_خاص_محذوف]',
  };

  for (const { pattern, type, severity } of SENSITIVE_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      issues.push({
        id: generateIssueId(),
        type: 'pii',
        severity,
        title: `معلومات شخصية: ${type.replace('_', ' ')}`,
        description: `تم اكتشاف ${type.replace('_', ' ')} محتمل`,
        location: match.index !== undefined ? { start: match.index, end: match.index + match[0].length } : undefined,
        matchedContent: match[0].substring(0, 4) + '****',
        suggestion: `قم بإزالة أو إخفاء ${type.replace('_', ' ')} قبل الإرسال`,
        autoFixable: true,
        fixedContent: redactionMap[type] || '[محذوف]',
      });
    }
  }

  return issues;
}

/**
 * Detect prompt injection attempts
 */
export function detectInjection(content: string): SafetyIssue[] {
  const issues: SafetyIssue[] = [];

  for (const { pattern, message, severity } of SECURITY_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(content)) {
      pattern.lastIndex = 0;
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        issues.push({
          id: generateIssueId(),
          type: 'injection',
          severity,
          title: 'محاولة حقن',
          description: message,
          location: match.index !== undefined ? { start: match.index, end: match.index + match[0].length } : undefined,
          matchedContent: match[0],
          suggestion: 'قم بإزالة نمط الحقن للحفاظ على سلامة البرومبت',
          autoFixable: false,
        });
      }
    }
  }

  return issues;
}

/**
 * Detect biased language
 */
export function detectBias(content: string): SafetyIssue[] {
  const issues: SafetyIssue[] = [];

  for (const { pattern, category, severity } of BIAS_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      issues.push({
        id: generateIssueId(),
        type: 'bias',
        severity,
        title: `تحيز محتمل: ${category}`,
        description: `لغة قد تشير إلى تحيز: "${match[0]}"`,
        location: match.index !== undefined ? { start: match.index, end: match.index + match[0].length } : undefined,
        matchedContent: match[0],
        suggestion: 'استخدم لغة أكثر شمولية وحيادية',
        autoFixable: false,
      });
    }
  }

  return issues;
}

/**
 * Detect drift from expected context/topic
 */
export function detectDrift(content: string, baselineContext?: string): DriftAnalysis {
  const result: DriftAnalysis = {
    driftScore: 0,
    driftType: 'none',
    driftingKeywords: [],
  };

  if (!baselineContext) {
    return result;
  }

  // Extract keywords from baseline (words > 3 chars)
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
  const driftRatio = contentWords.length > 0 ? uniqueDriftingWords.length / contentWords.length : 0;

  // Detect off-topic indicators
  const offTopicPatterns = [
    /(?:by the way|بالمناسبة|unrelated|غير متعلق|different topic|موضوع مختلف)/gi,
    /(?:forget about|انسى|instead of|بدلاً من|rather than)/gi,
    /(?:also|أيضاً|another thing|شيء آخر|let me ask)/gi,
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
    result.recommendation = 'المحتوى يبدو خارج الموضوع بشكل كبير عن السياق المتوقع';
  } else if (intentDrift) {
    result.driftType = 'intent';
    result.recommendation = 'المحتوى يحتوي على لغة تشير إلى تغيير الموضوع';
  } else if (result.driftScore > 0.4) {
    result.driftType = 'semantic';
    result.recommendation = 'المحتوى يحتوي على انحراف دلالي معتدل عن الأساس';
  }

  return result;
}

/**
 * Sanitize content by applying fixes
 */
export function sanitizeContent(content: string, issues: SafetyIssue[]): string {
  let sanitized = content;

  // Sort by location descending to avoid offset issues
  const fixableIssues = [...issues]
    .filter(issue => issue.autoFixable && issue.location && issue.fixedContent)
    .sort((a, b) => (b.location?.start ?? 0) - (a.location?.start ?? 0));

  for (const issue of fixableIssues) {
    if (issue.location && issue.fixedContent) {
      sanitized =
        sanitized.substring(0, issue.location.start) +
        issue.fixedContent +
        sanitized.substring(issue.location.end);
    }
  }

  return sanitized;
}

/**
 * Perform comprehensive safety check on content
 */
export function performSafetyCheck(
  content: string,
  options: {
    checkToxicity?: boolean;
    checkPII?: boolean;
    checkDrift?: boolean;
    checkInjection?: boolean;
    checkBias?: boolean;
    autoSanitize?: boolean;
    baselineContext?: string;
  } = {}
): SafetyCheckResult {
  const {
    checkToxicity: doToxicity = true,
    checkPII: doPII = true,
    checkDrift: doDrift = false,
    checkInjection: doInjection = true,
    checkBias: doBias = true,
    autoSanitize = false,
    baselineContext,
  } = options;

  const issues: SafetyIssue[] = [];
  const recommendations: string[] = [];

  // Perform checks
  if (doToxicity) {
    issues.push(...detectToxicity(content));
  }

  if (doPII) {
    issues.push(...detectPII(content));
  }

  if (doInjection) {
    issues.push(...detectInjection(content));
  }

  if (doBias) {
    issues.push(...detectBias(content));
  }

  let driftAnalysis: DriftAnalysis | undefined;
  if (doDrift && baselineContext) {
    driftAnalysis = detectDrift(content, baselineContext);
    if (driftAnalysis.driftScore > 0.4) {
      issues.push({
        id: generateIssueId(),
        type: 'drift',
        severity: driftAnalysis.driftScore > 0.7 ? 'high' : 'medium',
        title: `انحراف في السياق: ${driftAnalysis.driftType}`,
        description: driftAnalysis.recommendation ?? 'المحتوى ينحرف عن السياق المتوقع',
        suggestion: 'فكر في إعادة التركيز على الموضوع الأصلي',
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
    }
  }
  score = Math.max(0, score);

  // Generate recommendations
  const issueTypes = new Set(issues.map(i => i.type));
  if (issueTypes.has('toxicity')) {
    recommendations.push('قم بإزالة أو إعادة صياغة اللغة السامة قبل الإرسال');
  }
  if (issueTypes.has('pii')) {
    recommendations.push('قم بإخفاء المعلومات الشخصية لحماية الخصوصية');
  }
  if (issueTypes.has('injection')) {
    recommendations.push('قم بإزالة أنماط حقن البرومبت للحفاظ على الأمان');
  }
  if (issueTypes.has('bias')) {
    recommendations.push('استخدم لغة أكثر شمولية');
  }
  if (issueTypes.has('drift')) {
    recommendations.push('أعد التركيز على الموضوع الأصلي');
  }

  // Determine blocking
  const hasCritical = issues.some(i => i.severity === 'critical');
  const blocked = hasCritical;

  // Sanitize if requested
  let sanitizedContent: string | undefined;
  if (autoSanitize && issues.some(i => i.autoFixable)) {
    sanitizedContent = sanitizeContent(content, issues);
  }

  return {
    passed: !blocked && score >= 50,
    blocked,
    score,
    issues,
    sanitizedContent,
    recommendations,
    driftAnalysis,
  };
}

/**
 * Pre-send validation with policy enforcement
 */
export function validateBeforeSend(
  content: string,
  policy?: SafetyPolicy
): {
  canSend: boolean;
  result: SafetyCheckResult;
  action: 'allow' | 'warn' | 'block' | 'sanitize';
} {
  const result = performSafetyCheck(content, {
    checkToxicity: true,
    checkPII: true,
    checkInjection: true,
    checkBias: true,
    autoSanitize: policy?.autoFix ?? false,
  });

  let action: 'allow' | 'warn' | 'block' | 'sanitize' = 'allow';

  if (result.blocked) {
    action = 'block';
  } else if (result.sanitizedContent && policy?.autoFix) {
    action = 'sanitize';
  } else if (result.issues.length > 0) {
    action = 'warn';
  }

  const canSend = action !== 'block' || !(policy?.blockOnViolation ?? true);

  return {
    canSend,
    result,
    action,
  };
}
