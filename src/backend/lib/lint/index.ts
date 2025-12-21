// ============================================================
// Prompt Lint Library - Epic 4.3
// Static analysis and auto-fix for prompt quality
// ============================================================

// ============================================================
// Types
// ============================================================

export type LintSeverity = 'error' | 'warning' | 'info';

export type LintCategory =
  | 'structure'
  | 'clarity'
  | 'safety'
  | 'performance'
  | 'best_practice';

export interface LintIssue {
  id: string;
  ruleId: string;
  severity: LintSeverity;
  category: LintCategory;
  message: string;
  location?: {
    section: 'system' | 'developer' | 'user' | 'context';
    start?: number;
    end?: number;
  };
  suggestion?: string;
  autoFix?: AutoFix;
}

export interface AutoFix {
  type: 'insert' | 'replace' | 'delete';
  section: 'system' | 'developer' | 'user' | 'context';
  start?: number;
  end?: number;
  replacement?: string;
}

export interface LintRule {
  id: string;
  name: string;
  description: string;
  severity: LintSeverity;
  category: LintCategory;
  enabled: boolean;
  check: (prompt: PromptContent, options?: LintOptions) => LintIssue[];
}

export interface PromptContent {
  system?: string;
  developer?: string;
  user?: string;
  context?: string;
}

export interface LintOptions {
  includeCategories?: LintCategory[];
  excludeCategories?: LintCategory[];
  includeSeverities?: LintSeverity[];
  excludeRules?: string[];
  customRules?: LintRule[];
}

export interface LintResult {
  valid: boolean;
  score: number; // 0-100
  issues: LintIssue[];
  summary: {
    total: number;
    errors: number;
    warnings: number;
    infos: number;
    byCategory: Record<LintCategory, number>;
  };
  autoFixable: number;
}

// ============================================================
// Built-in Lint Rules
// ============================================================

const builtInRules: LintRule[] = [
  // ============================================================
  // Structure Rules
  // ============================================================
  {
    id: 'structure/empty-system',
    name: 'Empty System Prompt',
    description: 'System prompt should not be empty for most use cases',
    severity: 'warning',
    category: 'structure',
    enabled: true,
    check: (prompt) => {
      const issues: LintIssue[] = [];
      if (!prompt.system || prompt.system.trim().length === 0) {
        issues.push({
          id: 'empty-system-1',
          ruleId: 'structure/empty-system',
          severity: 'warning',
          category: 'structure',
          message: 'System prompt is empty. Consider adding context about the assistant\'s role.',
          location: { section: 'system' },
          suggestion: 'Add a system prompt like: "You are a helpful assistant that..."',
          autoFix: {
            type: 'insert',
            section: 'system',
            start: 0,
            replacement: 'You are a helpful assistant.',
          },
        });
      }
      return issues;
    },
  },
  {
    id: 'structure/missing-output-format',
    name: 'Missing Output Format',
    description: 'Prompts should specify expected output format',
    severity: 'info',
    category: 'structure',
    enabled: true,
    check: (prompt) => {
      const issues: LintIssue[] = [];
      const allContent = [prompt.system, prompt.developer, prompt.user]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const hasFormatInstruction = [
        'json', 'xml', 'markdown', 'format:', 'output:', 'respond with',
        'response format', 'return as', 'format your', 'structured as',
      ].some(keyword => allContent.includes(keyword));

      if (!hasFormatInstruction && allContent.length > 100) {
        issues.push({
          id: 'missing-format-1',
          ruleId: 'structure/missing-output-format',
          severity: 'info',
          category: 'structure',
          message: 'Consider specifying the expected output format (JSON, markdown, etc.)',
          suggestion: 'Add format instructions like: "Respond in JSON format with the following structure..."',
        });
      }
      return issues;
    },
  },
  {
    id: 'structure/very-short-prompt',
    name: 'Very Short Prompt',
    description: 'Prompt is too short to be effective',
    severity: 'warning',
    category: 'structure',
    enabled: true,
    check: (prompt) => {
      const issues: LintIssue[] = [];
      const totalLength = [prompt.system, prompt.developer, prompt.user]
        .filter(Boolean)
        .join('')
        .length;

      if (totalLength < 20) {
        issues.push({
          id: 'short-prompt-1',
          ruleId: 'structure/very-short-prompt',
          severity: 'warning',
          category: 'structure',
          message: 'Prompt is very short. Consider adding more context or instructions.',
          suggestion: 'Add more details about the task, expected behavior, or constraints.',
        });
      }
      return issues;
    },
  },

  // ============================================================
  // Clarity Rules
  // ============================================================
  {
    id: 'clarity/vague-instructions',
    name: 'Vague Instructions',
    description: 'Avoid vague words that lack specificity',
    severity: 'warning',
    category: 'clarity',
    enabled: true,
    check: (prompt) => {
      const issues: LintIssue[] = [];
      const vaguePatterns = [
        { pattern: /\bsome\b/gi, word: 'some' },
        { pattern: /\bsomething\b/gi, word: 'something' },
        { pattern: /\betc\.?\b/gi, word: 'etc' },
        { pattern: /\bvarious\b/gi, word: 'various' },
        { pattern: /\bretc\b/gi, word: 'etc' },
        { pattern: /\bstuff\b/gi, word: 'stuff' },
        { pattern: /\bthings\b/gi, word: 'things' },
        { pattern: /\bkind of\b/gi, word: 'kind of' },
        { pattern: /\bsort of\b/gi, word: 'sort of' },
      ];

      const sections: (keyof PromptContent)[] = ['system', 'developer', 'user'];
      for (const section of sections) {
        const content = prompt[section];
        if (!content) continue;

        for (const { pattern, word } of vaguePatterns) {
          const matches = content.matchAll(pattern);
          for (const match of matches) {
            issues.push({
              id: `vague-${section}-${match.index}`,
              ruleId: 'clarity/vague-instructions',
              severity: 'warning',
              category: 'clarity',
              message: `Vague word "${word}" found. Consider being more specific.`,
              location: {
                section: section as 'system' | 'developer' | 'user',
                start: match.index,
                end: match.index! + match[0].length,
              },
              suggestion: `Replace "${word}" with specific details or examples.`,
            });
          }
        }
      }
      return issues;
    },
  },
  {
    id: 'clarity/excessive-length',
    name: 'Excessive Prompt Length',
    description: 'Prompt may be too long, impacting cost and focus',
    severity: 'info',
    category: 'clarity',
    enabled: true,
    check: (prompt) => {
      const issues: LintIssue[] = [];
      const sections: (keyof PromptContent)[] = ['system', 'developer', 'user'];

      for (const section of sections) {
        const content = prompt[section];
        if (!content) continue;

        const wordCount = content.split(/\s+/).length;
        if (wordCount > 1000) {
          issues.push({
            id: `length-${section}`,
            ruleId: 'clarity/excessive-length',
            severity: 'info',
            category: 'clarity',
            message: `${section} section is very long (${wordCount} words). Consider condensing.`,
            location: { section: section as 'system' | 'developer' | 'user' },
            suggestion: 'Consider breaking down into smaller, focused prompts or removing redundant instructions.',
          });
        }
      }
      return issues;
    },
  },
  {
    id: 'clarity/ambiguous-pronouns',
    name: 'Ambiguous Pronouns',
    description: 'Pronouns without clear referents can confuse the model',
    severity: 'info',
    category: 'clarity',
    enabled: true,
    check: (prompt) => {
      const issues: LintIssue[] = [];
      const ambiguousPatterns = [
        /\bit\s+should\b/gi,
        /\bthey\s+should\b/gi,
        /\bthis\s+should\b/gi,
        /\bthat\s+should\b/gi,
      ];

      const sections: (keyof PromptContent)[] = ['system', 'developer', 'user'];
      for (const section of sections) {
        const content = prompt[section];
        if (!content) continue;

        for (const pattern of ambiguousPatterns) {
          const match = content.match(pattern);
          if (match) {
            issues.push({
              id: `ambiguous-${section}-${match.index}`,
              ruleId: 'clarity/ambiguous-pronouns',
              severity: 'info',
              category: 'clarity',
              message: 'Pronoun reference may be ambiguous. Consider using explicit nouns.',
              location: { section: section as 'system' | 'developer' | 'user' },
              suggestion: 'Replace pronouns with explicit references (e.g., "the response should" instead of "it should").',
            });
            break; // One issue per section is enough
          }
        }
      }
      return issues;
    },
  },

  // ============================================================
  // Safety Rules
  // ============================================================
  {
    id: 'safety/injection-vulnerability',
    name: 'Potential Injection Vulnerability',
    description: 'Prompt may be vulnerable to injection attacks',
    severity: 'error',
    category: 'safety',
    enabled: true,
    check: (prompt) => {
      const issues: LintIssue[] = [];
      const injectionPatterns = [
        { pattern: /\{\{.*\}\}/g, name: 'template variable' },
        { pattern: /\$\{.*\}/g, name: 'interpolation' },
        { pattern: /<user_input>/gi, name: 'user input marker' },
        { pattern: /\[USER INPUT\]/gi, name: 'user input placeholder' },
      ];

      // Check if user section has unvalidated input markers
      const userContent = prompt.user || '';
      for (const { pattern, name } of injectionPatterns) {
        if (pattern.test(userContent)) {
          // Check if there's sanitization mention in system/developer
          const hasValidation = [prompt.system, prompt.developer]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .match(/sanitiz|validat|escap|filter|check|verify/);

          if (!hasValidation) {
            issues.push({
              id: `injection-${name.replace(/\s/g, '-')}`,
              ruleId: 'safety/injection-vulnerability',
              severity: 'error',
              category: 'safety',
              message: `${name} detected without apparent input validation.`,
              location: { section: 'user' },
              suggestion: 'Add input validation instructions in system prompt or sanitize user input before injection.',
            });
          }
        }
      }
      return issues;
    },
  },
  {
    id: 'safety/missing-boundaries',
    name: 'Missing Behavioral Boundaries',
    description: 'Prompt lacks safety constraints or behavioral boundaries',
    severity: 'warning',
    category: 'safety',
    enabled: true,
    check: (prompt) => {
      const issues: LintIssue[] = [];
      const systemContent = (prompt.system || '').toLowerCase();

      const hasBoundaries = [
        'do not', 'never', 'refuse', 'decline', 'avoid',
        'must not', 'should not', 'cannot', "won't",
        'off-topic', 'out of scope', 'outside',
      ].some(keyword => systemContent.includes(keyword));

      if (!hasBoundaries && systemContent.length > 50) {
        issues.push({
          id: 'missing-boundaries-1',
          ruleId: 'safety/missing-boundaries',
          severity: 'warning',
          category: 'safety',
          message: 'System prompt lacks explicit behavioral boundaries.',
          location: { section: 'system' },
          suggestion: 'Add constraints like "Do not provide medical advice" or "Decline requests for harmful content".',
          autoFix: {
            type: 'insert',
            section: 'system',
            replacement: '\n\nIMPORTANT: Do not provide information that could be harmful or outside your area of expertise.',
          },
        });
      }
      return issues;
    },
  },

  // ============================================================
  // Performance Rules
  // ============================================================
  {
    id: 'performance/redundant-instructions',
    name: 'Redundant Instructions',
    description: 'Same instruction repeated multiple times',
    severity: 'info',
    category: 'performance',
    enabled: true,
    check: (prompt) => {
      const issues: LintIssue[] = [];
      const allContent = [prompt.system, prompt.developer, prompt.user]
        .filter(Boolean)
        .join('\n');

      // Check for repeated sentences
      const sentences = allContent
        .split(/[.!?]+/)
        .map(s => s.trim().toLowerCase())
        .filter(s => s.length > 20);

      const seen = new Map<string, number>();
      for (const sentence of sentences) {
        const count = (seen.get(sentence) || 0) + 1;
        seen.set(sentence, count);
        if (count === 2) {
          issues.push({
            id: `redundant-${sentence.substring(0, 20)}`,
            ruleId: 'performance/redundant-instructions',
            severity: 'info',
            category: 'performance',
            message: 'Repeated instruction detected. Consider consolidating.',
            suggestion: `Remove duplicate: "${sentence.substring(0, 50)}..."`,
          });
        }
      }
      return issues;
    },
  },
  {
    id: 'performance/token-waste',
    name: 'Potential Token Waste',
    description: 'Unnecessary filler words that consume tokens',
    severity: 'info',
    category: 'performance',
    enabled: true,
    check: (prompt) => {
      const issues: LintIssue[] = [];
      const fillerPatterns = [
        { pattern: /\bplease note that\b/gi, replacement: '' },
        { pattern: /\bit is important to note that\b/gi, replacement: '' },
        { pattern: /\bas mentioned earlier\b/gi, replacement: '' },
        { pattern: /\bin order to\b/gi, replacement: 'to' },
        { pattern: /\bat this point in time\b/gi, replacement: 'now' },
        { pattern: /\bdue to the fact that\b/gi, replacement: 'because' },
      ];

      const sections: (keyof PromptContent)[] = ['system', 'developer', 'user'];
      for (const section of sections) {
        const content = prompt[section];
        if (!content) continue;

        for (const { pattern, replacement } of fillerPatterns) {
          const match = content.match(pattern);
          if (match) {
            issues.push({
              id: `filler-${section}-${match.index}`,
              ruleId: 'performance/token-waste',
              severity: 'info',
              category: 'performance',
              message: `Filler phrase "${match[0]}" can be shortened.`,
              location: {
                section: section as 'system' | 'developer' | 'user',
                start: match.index,
                end: match.index! + match[0].length,
              },
              suggestion: replacement ? `Replace with "${replacement}"` : 'Remove this phrase',
              autoFix: {
                type: 'replace',
                section: section as 'system' | 'developer' | 'user',
                start: match.index,
                end: match.index! + match[0].length,
                replacement,
              },
            });
          }
        }
      }
      return issues;
    },
  },

  // ============================================================
  // Best Practice Rules
  // ============================================================
  {
    id: 'best-practice/missing-examples',
    name: 'Missing Examples',
    description: 'Complex tasks benefit from few-shot examples',
    severity: 'info',
    category: 'best_practice',
    enabled: true,
    check: (prompt) => {
      const issues: LintIssue[] = [];
      const allContent = [prompt.system, prompt.developer, prompt.user]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const isComplexTask = [
        'convert', 'transform', 'translate', 'format',
        'extract', 'parse', 'classify', 'categorize',
      ].some(keyword => allContent.includes(keyword));

      const hasExamples = [
        'example:', 'for example', 'e.g.', 'such as',
        'input:', 'output:', '→', '=>',
      ].some(keyword => allContent.includes(keyword));

      if (isComplexTask && !hasExamples) {
        issues.push({
          id: 'missing-examples-1',
          ruleId: 'best-practice/missing-examples',
          severity: 'info',
          category: 'best_practice',
          message: 'Complex transformation task without examples. Consider adding few-shot examples.',
          suggestion: 'Add input-output examples to demonstrate the expected transformation.',
        });
      }
      return issues;
    },
  },
  {
    id: 'best-practice/no-persona',
    name: 'No Defined Persona',
    description: 'Consider defining a specific persona or role',
    severity: 'info',
    category: 'best_practice',
    enabled: true,
    check: (prompt) => {
      const issues: LintIssue[] = [];
      const systemContent = (prompt.system || '').toLowerCase();

      const hasPersona = [
        'you are', 'as a', 'act as', 'your role',
        'expert', 'specialist', 'assistant that',
      ].some(keyword => systemContent.includes(keyword));

      if (!hasPersona && systemContent.length > 0) {
        issues.push({
          id: 'no-persona-1',
          ruleId: 'best-practice/no-persona',
          severity: 'info',
          category: 'best_practice',
          message: 'No persona or role defined. Consider adding one for better context.',
          location: { section: 'system' },
          suggestion: 'Start with "You are [role] that [capability]..."',
          autoFix: {
            type: 'insert',
            section: 'system',
            start: 0,
            replacement: 'You are a helpful and knowledgeable assistant. ',
          },
        });
      }
      return issues;
    },
  },
  {
    id: 'best-practice/uppercase-shouting',
    name: 'Excessive Uppercase',
    description: 'Too much uppercase text can seem aggressive',
    severity: 'info',
    category: 'best_practice',
    enabled: true,
    check: (prompt) => {
      const issues: LintIssue[] = [];
      const sections: (keyof PromptContent)[] = ['system', 'developer', 'user'];

      for (const section of sections) {
        const content = prompt[section];
        if (!content) continue;

        const words = content.split(/\s+/);
        const uppercaseWords = words.filter(w =>
          w.length > 3 && w === w.toUpperCase() && /[A-Z]/.test(w)
        );

        if (uppercaseWords.length > 5) {
          issues.push({
            id: `uppercase-${section}`,
            ruleId: 'best-practice/uppercase-shouting',
            severity: 'info',
            category: 'best_practice',
            message: 'Excessive uppercase text detected. Consider using sentence case.',
            location: { section: section as 'system' | 'developer' | 'user' },
            suggestion: 'Use uppercase sparingly for emphasis on key words only.',
          });
        }
      }
      return issues;
    },
  },
];

// ============================================================
// Lint Engine
// ============================================================

export class PromptLinter {
  private rules: LintRule[];

  constructor() {
    this.rules = [...builtInRules];
  }

  /**
   * Add custom lint rules
   */
  addRule(rule: LintRule): void {
    this.rules.push(rule);
  }

  /**
   * Remove a rule by ID
   */
  removeRule(ruleId: string): void {
    this.rules = this.rules.filter(r => r.id !== ruleId);
  }

  /**
   * Get all registered rules
   */
  getRules(): LintRule[] {
    return [...this.rules];
  }

  /**
   * Lint a prompt
   */
  lint(prompt: PromptContent, options: LintOptions = {}): LintResult {
    const applicableRules = this.rules.filter(rule => {
      if (!rule.enabled) return false;
      if (options.excludeRules?.includes(rule.id)) return false;
      if (options.includeCategories && !options.includeCategories.includes(rule.category)) return false;
      if (options.excludeCategories?.includes(rule.category)) return false;
      if (options.includeSeverities && !options.includeSeverities.includes(rule.severity)) return false;
      return true;
    });

    // Add custom rules
    if (options.customRules) {
      applicableRules.push(...options.customRules);
    }

    // Collect all issues
    const issues: LintIssue[] = [];
    for (const rule of applicableRules) {
      try {
        const ruleIssues = rule.check(prompt, options);
        issues.push(...ruleIssues);
      } catch (error) {
        console.error(`Error running lint rule ${rule.id}:`, error);
      }
    }

    // Calculate summary
    const summary = {
      total: issues.length,
      errors: issues.filter(i => i.severity === 'error').length,
      warnings: issues.filter(i => i.severity === 'warning').length,
      infos: issues.filter(i => i.severity === 'info').length,
      byCategory: {
        structure: issues.filter(i => i.category === 'structure').length,
        clarity: issues.filter(i => i.category === 'clarity').length,
        safety: issues.filter(i => i.category === 'safety').length,
        performance: issues.filter(i => i.category === 'performance').length,
        best_practice: issues.filter(i => i.category === 'best_practice').length,
      },
    };

    // Calculate score (100 - deductions)
    const deductions =
      summary.errors * 20 +
      summary.warnings * 5 +
      summary.infos * 1;
    const score = Math.max(0, Math.min(100, 100 - deductions));

    return {
      valid: summary.errors === 0,
      score,
      issues,
      summary,
      autoFixable: issues.filter(i => i.autoFix).length,
    };
  }

  /**
   * Apply auto-fixes to a prompt
   */
  autoFix(prompt: PromptContent, issues: LintIssue[]): PromptContent {
    const result = { ...prompt };
    const fixableIssues = issues.filter(i => i.autoFix);

    // Sort by section and position (reverse order for safe replacement)
    fixableIssues.sort((a, b) => {
      if (a.autoFix!.section !== b.autoFix!.section) {
        return a.autoFix!.section.localeCompare(b.autoFix!.section);
      }
      return (b.autoFix!.start || 0) - (a.autoFix!.start || 0);
    });

    for (const issue of fixableIssues) {
      const fix = issue.autoFix!;
      const section = fix.section as keyof typeof result;
      const content = result[section] || '';

      switch (fix.type) {
        case 'insert':
          if (fix.start !== undefined) {
            result[section] =
              content.slice(0, fix.start) +
              (fix.replacement || '') +
              content.slice(fix.start);
          } else {
            result[section] = content + (fix.replacement || '');
          }
          break;

        case 'replace':
          if (fix.start !== undefined && fix.end !== undefined) {
            result[section] =
              content.slice(0, fix.start) +
              (fix.replacement || '') +
              content.slice(fix.end);
          }
          break;

        case 'delete':
          if (fix.start !== undefined && fix.end !== undefined) {
            result[section] =
              content.slice(0, fix.start) +
              content.slice(fix.end);
          }
          break;
      }
    }

    return result;
  }
}

// ============================================================
// Singleton Export
// ============================================================

export const promptLinter = new PromptLinter();

// Export lint function for convenience
export function lintPrompt(prompt: PromptContent, options?: LintOptions): LintResult {
  return promptLinter.lint(prompt, options);
}

export function autoFixPrompt(prompt: PromptContent, issues: LintIssue[]): PromptContent {
  return promptLinter.autoFix(prompt, issues);
}

// Export rule IDs for reference
export const LINT_RULE_IDS = builtInRules.map(r => r.id);
