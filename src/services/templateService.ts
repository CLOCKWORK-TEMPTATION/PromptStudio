import { supabase } from '../lib/supabase';
import type { Template, Technique } from '../types';

interface MetaPromptConfig {
  persona?: string;
  domain?: string;
  timeConstraint?: 'urgent' | 'standard' | 'comprehensive';
  metaInstructions?: Record<string, any>;
}

interface TemplateWithMeta extends Template {
  persona?: string;
  domain?: string;
  timeConstraint?: string;
  metaInstructions?: Record<string, any>;
}

export async function getTemplates(): Promise<Template[]> {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .order('usage_count', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getTemplateById(id: string): Promise<Template | null> {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getTemplatesByCategory(category: string): Promise<Template[]> {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('category', category)
    .order('usage_count', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getFeaturedTemplates(): Promise<Template[]> {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('is_featured', true)
    .order('usage_count', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function searchTemplates(query: string): Promise<Template[]> {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
    .order('usage_count', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function incrementTemplateUsage(id: string): Promise<void> {
  const { data: template } = await supabase
    .from('templates')
    .select('usage_count')
    .eq('id', id)
    .single();

  if (template) {
    await supabase
      .from('templates')
      .update({ usage_count: (template.usage_count || 0) + 1 })
      .eq('id', id);
  }
}

export async function getTechniques(): Promise<Technique[]> {
  const { data, error } = await supabase
    .from('techniques')
    .select('*')
    .order('display_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getTechniqueBySlug(slug: string): Promise<Technique | null> {
  const { data, error } = await supabase
    .from('techniques')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getTechniquesByCategory(category: string): Promise<Technique[]> {
  const { data, error } = await supabase
    .from('techniques')
    .select('*')
    .eq('category', category)
    .order('display_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function searchTechniques(query: string): Promise<Technique[]> {
  const { data, error } = await supabase
    .from('techniques')
    .select('*')
    .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
    .order('display_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Generate meta-prompt instructions based on configuration
 */
export function generateMetaPromptInstructions(config: MetaPromptConfig): string {
  const parts: string[] = [];

  if (config.persona) {
    parts.push(`You are acting as a ${config.persona}.`);
  }

  if (config.domain) {
    parts.push(`You are an expert in the ${config.domain} domain.`);
  }

  if (config.timeConstraint) {
    const timeInstructions: Record<string, string> = {
      urgent: 'Provide a concise, direct response focusing on immediate action items. Prioritize speed and clarity over comprehensive details.',
      standard: 'Provide a balanced response with clear explanations and practical guidance.',
      comprehensive: 'Provide a thorough, detailed response with extensive context, examples, and considerations. Take time to explore edge cases and alternative approaches.',
    };

    const instruction = timeInstructions[config.timeConstraint] || timeInstructions.standard;
    parts.push(instruction);
  }

  if (config.metaInstructions) {
    const { tone, style, expertise, constraints, language, format } = config.metaInstructions;

    if (tone) parts.push(`Use a ${tone} tone.`);
    if (style) parts.push(`Follow a ${style} style.`);
    if (expertise) parts.push(`Apply ${expertise} level expertise.`);
    if (language) parts.push(`Respond in ${language} language.`);
    if (format) parts.push(`Format output as ${format}.`);
    if (constraints) parts.push(`Constraints: ${constraints}`);
  }

  return parts.join(' ');
}

/**
 * Apply meta-prompting to a template
 * Prepends the meta-prompt instructions to the template content
 */
export function applyMetaPromptingToTemplate(
  template: Template,
  metaConfig: MetaPromptConfig
): string {
  const metaInstructions = generateMetaPromptInstructions(metaConfig);

  if (!metaInstructions) {
    return template.content;
  }

  // Prepend meta-instructions as a system layer
  return `# Meta-Prompting Layer\n${metaInstructions}\n\n---\n\n${template.content}`;
}

/**
 * Extract meta-prompting configuration from a template if it has metadata
 */
export function extractMetaConfigFromTemplate(template: TemplateWithMeta): MetaPromptConfig {
  return {
    persona: template.persona,
    domain: template.domain,
    timeConstraint: template.timeConstraint as any,
    metaInstructions: template.metaInstructions,
  };
}

/**
 * Get templates with meta-prompting support
 */
export async function getTemplatesWithMetaSupport(): Promise<TemplateWithMeta[]> {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .order('usage_count', { ascending: false });

  if (error) throw error;
  return data || [];
}
