import { supabase } from '../lib/supabase';
import type { Prompt, PromptVersion, ModelConfig } from '../types';
import { DEFAULT_MODEL_CONFIG } from '../types';

export async function getPrompts(sessionId: string): Promise<Prompt[]> {
  const { data, error } = await supabase
    .from('prompts')
    .select('*')
    .eq('session_id', sessionId)
    .eq('is_archived', false)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getPromptById(id: string): Promise<Prompt | null> {
  const { data, error } = await supabase
    .from('prompts')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createPrompt(sessionId: string, prompt: Partial<Prompt>): Promise<Prompt> {
  const { data, error } = await supabase
    .from('prompts')
    .insert({
      session_id: sessionId,
      title: prompt.title || 'Untitled Prompt',
      content: prompt.content || '',
      description: prompt.description || '',
      tags: prompt.tags || [],
      category: prompt.category || 'general',
      model_id: prompt.model_id || 'gpt-4',
      model_config: prompt.model_config || DEFAULT_MODEL_CONFIG,
      variables: prompt.variables || [],
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updatePrompt(id: string, updates: Partial<Prompt>): Promise<Prompt> {
  const { data, error } = await supabase
    .from('prompts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deletePrompt(id: string): Promise<void> {
  const { error } = await supabase
    .from('prompts')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function archivePrompt(id: string): Promise<void> {
  const { error } = await supabase
    .from('prompts')
    .update({ is_archived: true })
    .eq('id', id);

  if (error) throw error;
}

export async function toggleFavorite(id: string, isFavorite: boolean): Promise<void> {
  const { error } = await supabase
    .from('prompts')
    .update({ is_favorite: isFavorite })
    .eq('id', id);

  if (error) throw error;
}

export async function incrementUsage(id: string): Promise<void> {
  const { data: prompt } = await supabase
    .from('prompts')
    .select('usage_count')
    .eq('id', id)
    .single();

  if (prompt) {
    await supabase
      .from('prompts')
      .update({
        usage_count: (prompt.usage_count || 0) + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', id);
  }
}

export async function getPromptVersions(promptId: string): Promise<PromptVersion[]> {
  const { data, error } = await supabase
    .from('prompt_versions')
    .select('*')
    .eq('prompt_id', promptId)
    .order('version_number', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createVersion(
  promptId: string,
  content: string,
  modelConfig: ModelConfig,
  changeSummary: string
): Promise<PromptVersion> {
  const { data: versions } = await supabase
    .from('prompt_versions')
    .select('version_number')
    .eq('prompt_id', promptId)
    .order('version_number', { ascending: false })
    .limit(1);

  const nextVersion = versions && versions.length > 0 ? versions[0].version_number + 1 : 1;

  const { data, error } = await supabase
    .from('prompt_versions')
    .insert({
      prompt_id: promptId,
      version_number: nextVersion,
      content,
      model_config: modelConfig,
      change_summary: changeSummary,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function restoreVersion(promptId: string, versionId: string): Promise<Prompt> {
  const { data: version } = await supabase
    .from('prompt_versions')
    .select('*')
    .eq('id', versionId)
    .single();

  if (!version) throw new Error('Version not found');

  const { data, error } = await supabase
    .from('prompts')
    .update({
      content: version.content,
      model_config: version.model_config,
    })
    .eq('id', promptId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function searchPrompts(sessionId: string, query: string): Promise<Prompt[]> {
  const { data, error } = await supabase
    .from('prompts')
    .select('*')
    .eq('session_id', sessionId)
    .eq('is_archived', false)
    .or(`title.ilike.%${query}%,content.ilike.%${query}%,description.ilike.%${query}%`)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getPromptsByCategory(sessionId: string, category: string): Promise<Prompt[]> {
  const { data, error } = await supabase
    .from('prompts')
    .select('*')
    .eq('session_id', sessionId)
    .eq('category', category)
    .eq('is_archived', false)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getFavoritePrompts(sessionId: string): Promise<Prompt[]> {
  const { data, error } = await supabase
    .from('prompts')
    .select('*')
    .eq('session_id', sessionId)
    .eq('is_favorite', true)
    .eq('is_archived', false)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data || [];
}
