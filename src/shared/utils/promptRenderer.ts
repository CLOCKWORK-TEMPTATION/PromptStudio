// ============================================================
// Shared Prompt Rendering Utility - Epic 0.3
// ============================================================

import type {
  TemplateContentSnapshot,
  RenderedPromptParts,
  RenderPromptOptions
} from '../types/dspy';

/**
 * Variable pattern for matching {{variable}} syntax
 */
const VARIABLE_PATTERN = /\{\{(\w+)\}\}/g;

/**
 * Extract all variable names from a text
 */
export function extractVariables(text: string): string[] {
  const variables: Set<string> = new Set();
  let match;

  while ((match = VARIABLE_PATTERN.exec(text)) !== null) {
    variables.add(match[1]);
  }

  // Reset regex lastIndex
  VARIABLE_PATTERN.lastIndex = 0;

  return Array.from(variables);
}

/**
 * Replace variables in text with provided values
 */
export function replaceVariables(
  text: string,
  variables: Record<string, unknown>,
  options: RenderPromptOptions = {}
): string {
  const { throwOnMissingVariable = false, defaultValue = '' } = options;

  return text.replace(VARIABLE_PATTERN, (match, varName) => {
    if (varName in variables) {
      const value = variables[varName];

      // Handle different types
      if (value === null || value === undefined) {
        return defaultValue;
      }

      if (typeof value === 'object') {
        return JSON.stringify(value, null, 2);
      }

      return String(value);
    }

    if (throwOnMissingVariable) {
      throw new Error(`Missing required variable: ${varName}`);
    }

    return defaultValue;
  });
}

/**
 * Render prompt parts from a version snapshot with variable substitution
 */
export function renderPromptParts(
  versionSnapshot: TemplateContentSnapshot,
  variables: Record<string, unknown>,
  options: RenderPromptOptions = {}
): RenderedPromptParts {
  // Merge default values with provided variables
  const mergedVariables = {
    ...versionSnapshot.defaultValues,
    ...variables,
  };

  const system = replaceVariables(
    versionSnapshot.system || '',
    mergedVariables,
    options
  );

  const developer = versionSnapshot.developer
    ? replaceVariables(versionSnapshot.developer, mergedVariables, options)
    : undefined;

  const user = replaceVariables(
    versionSnapshot.user || '',
    mergedVariables,
    options
  );

  const context = versionSnapshot.context
    ? replaceVariables(versionSnapshot.context, mergedVariables, options)
    : undefined;

  // Create merged preview for display
  const mergedPreview = buildMergedPreview({ system, developer, user, context });

  return {
    system,
    developer,
    user,
    context,
    mergedPreview,
  };
}

/**
 * Build a merged preview string from prompt parts
 */
function buildMergedPreview(parts: Omit<RenderedPromptParts, 'mergedPreview'>): string {
  const sections: string[] = [];

  if (parts.system) {
    sections.push(`[SYSTEM]\n${parts.system}`);
  }

  if (parts.developer) {
    sections.push(`[DEVELOPER]\n${parts.developer}`);
  }

  if (parts.context) {
    sections.push(`[CONTEXT]\n${parts.context}`);
  }

  if (parts.user) {
    sections.push(`[USER]\n${parts.user}`);
  }

  return sections.join('\n\n');
}

/**
 * Validate that all required variables are present
 */
export function validateVariables(
  text: string,
  variables: Record<string, unknown>,
  requiredVars?: string[]
): { valid: boolean; missing: string[] } {
  const extractedVars = extractVariables(text);
  const allRequired = requiredVars || extractedVars;

  const missing = allRequired.filter(varName => {
    const value = variables[varName];
    return value === undefined || value === null || value === '';
  });

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Get all variables from a content snapshot
 */
export function getAllVariablesFromSnapshot(
  snapshot: TemplateContentSnapshot
): string[] {
  const allVars: Set<string> = new Set();

  const texts = [
    snapshot.system,
    snapshot.developer,
    snapshot.user,
    snapshot.context,
  ].filter(Boolean) as string[];

  for (const text of texts) {
    const vars = extractVariables(text);
    vars.forEach(v => allVars.add(v));
  }

  return Array.from(allVars);
}

/**
 * Parse content snapshot from JSON (with validation)
 */
export function parseContentSnapshot(json: unknown): TemplateContentSnapshot {
  if (!json || typeof json !== 'object') {
    throw new Error('Invalid content snapshot: must be an object');
  }

  const obj = json as Record<string, unknown>;

  if (typeof obj.system !== 'string' && obj.system !== undefined) {
    throw new Error('Invalid content snapshot: system must be a string');
  }

  if (typeof obj.user !== 'string' && obj.user !== undefined) {
    throw new Error('Invalid content snapshot: user must be a string');
  }

  return {
    system: (obj.system as string) || '',
    developer: obj.developer as string | undefined,
    user: (obj.user as string) || '',
    context: obj.context as string | undefined,
    variablesSchema: obj.variablesSchema as TemplateContentSnapshot['variablesSchema'],
    defaultValues: obj.defaultValues as Record<string, unknown> | undefined,
    modelConfig: obj.modelConfig as TemplateContentSnapshot['modelConfig'],
  };
}

/**
 * Create a content snapshot from parts
 */
export function createContentSnapshot(
  parts: {
    system: string;
    developer?: string;
    user: string;
    context?: string;
  },
  options?: {
    variablesSchema?: TemplateContentSnapshot['variablesSchema'];
    defaultValues?: Record<string, unknown>;
    modelConfig?: TemplateContentSnapshot['modelConfig'];
  }
): TemplateContentSnapshot {
  return {
    system: parts.system,
    developer: parts.developer,
    user: parts.user,
    context: parts.context,
    variablesSchema: options?.variablesSchema,
    defaultValues: options?.defaultValues,
    modelConfig: options?.modelConfig,
  };
}

export default {
  extractVariables,
  replaceVariables,
  renderPromptParts,
  validateVariables,
  getAllVariablesFromSnapshot,
  parseContentSnapshot,
  createContentSnapshot,
};
