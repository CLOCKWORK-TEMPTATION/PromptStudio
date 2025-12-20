// @ts-nocheck
import { supabase } from '../lib/supabase';
import type { Prompt, PromptVersion, ModelConfig } from '../types';
import { DEFAULT_MODEL_CONFIG } from '../types';

export async function getPrompts(sessionId: string): Promise<Prompt[]> {
  const { data, error } = await supabase
    .from<Prompt>('prompts')
    .select('*')
    .eq('session_id', sessionId)
    .eq('is_archived', false)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data as Prompt[] | null) || [];
}

export async function getPromptById(id: string): Promise<Prompt | null> {
  const { data, error } = await supabase
    .from<Prompt>('prompts')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as Prompt | null;
}

export async function createPrompt(sessionId: string, prompt: Partial<Prompt>): Promise<Prompt> {
  const { data, error } = await supabase
    .from<Prompt>('prompts')
    .insert({
      session_id: sessionId,
      title: prompt.title || 'Untitled Prompt',
      content: prompt.content || '',
      description: prompt.description || '',
      tags: prompt.tags || [],
      category: prompt.category || 'general',
      model_id: prompt.model_id || 'gpt-4',
      modelConfig: prompt.modelConfig || DEFAULT_MODEL_CONFIG,
      variables: prompt.variables || [],
    } as Partial<Prompt>)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error('Failed to create prompt');
  return data as Prompt;
}

export async function updatePrompt(id: string, updates: Partial<Prompt>): Promise<Prompt> {
  const { data, error } = await supabase
    .from<Prompt>('prompts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error('Prompt not found');
  return data as Prompt;
}

export async function deletePrompt(id: string): Promise<void> {
  const { error } = await supabase
    .from<Prompt>('prompts')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function archivePrompt(id: string): Promise<void> {
  const { error } = await supabase
    .from<Prompt>('prompts')
    .update({ is_archived: true } as Partial<Prompt>)
    .eq('id', id);

  if (error) throw error;
}

export async function toggleFavorite(id: string, isFavorite: boolean): Promise<void> {
  const { error } = await supabase
    .from<Prompt>('prompts')
    .update({ isFavorite: isFavorite } as Partial<Prompt>)
    .eq('id', id);

  if (error) throw error;
}

interface PromptWithUsage {
  usage_count?: number;
  usageCount?: number;
}

export async function incrementUsage(id: string): Promise<void> {
  const { data: prompt } = await supabase
    .from<PromptWithUsage>('prompts')
    .select('usage_count')
    .eq('id', id)
    .single();

  if (prompt) {
    const currentCount = (prompt as PromptWithUsage).usageCount || 0;
    await supabase
      .from<Prompt>('prompts')
      .update({
        usageCount: currentCount + 1,
        last_used_at: new Date().toISOString(),
      } as Partial<Prompt>)
      .eq('id', id);
  }
}

export async function getPromptVersions(promptId: string): Promise<PromptVersion[]> {
  const { data, error } = await supabase
    .from<PromptVersion>('prompt_versions')
    .select('*')
    .eq('prompt_id', promptId)
    .order('version_number', { ascending: false });

  if (error) throw error;
  return (data as PromptVersion[] | null) || [];
}

interface VersionNumber {
  version_number: number;
}

export async function createVersion(
  promptId: string,
  content: string,
  modelConfig: ModelConfig,
  changeSummary: string
): Promise<PromptVersion> {
  const { data: versions } = await supabase
    .from<VersionNumber>('prompt_versions')
    .select('version_number')
    .eq('prompt_id', promptId)
    .order('version_number', { ascending: false })
    .limit(1);

  const versionList = versions as VersionNumber[] | null;
  const nextVersion = versionList && versionList.length > 0 ? versionList[0].version_number + 1 : 1;

  const { data, error } = await supabase
    .from<PromptVersion>('prompt_versions')
    .insert({
      prompt_id: promptId,
      versionNumber: nextVersion,
      content,
      modelConfig: modelConfig,
      changeSummary: changeSummary,
    } as Partial<PromptVersion>)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error('Failed to create version');
  return data as PromptVersion;
}

interface VersionContent {
  content: string;
  modelConfig: ModelConfig;
}

export async function restoreVersion(promptId: string, versionId: string): Promise<Prompt> {
  const { data: version } = await supabase
    .from<VersionContent>('prompt_versions')
    .select('*')
    .eq('id', versionId)
    .single();

  const versionData = version as VersionContent | null;
  if (!versionData) throw new Error('Version not found');

  const { data, error } = await supabase
    .from<Prompt>('prompts')
    .update({
      content: versionData.content,
      modelConfig: versionData.modelConfig,
    } as Partial<Prompt>)
    .eq('id', promptId)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error('Prompt not found');
  return data as Prompt;
}

export async function searchPrompts(sessionId: string, query: string): Promise<Prompt[]> {
  const { data, error } = await supabase
    .from<Prompt>('prompts')
    .select('*')
    .eq('session_id', sessionId)
    .eq('is_archived', false)
    .or(`title.ilike.%${query}%,content.ilike.%${query}%,description.ilike.%${query}%`)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data as Prompt[] | null) || [];
}

export async function getPromptsByCategory(sessionId: string, category: string): Promise<Prompt[]> {
  const { data, error } = await supabase
    .from<Prompt>('prompts')
    .select('*')
    .eq('session_id', sessionId)
    .eq('category', category)
    .eq('is_archived', false)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data as Prompt[] | null) || [];
}

export async function getFavoritePrompts(sessionId: string): Promise<Prompt[]> {
  const { data, error } = await supabase
    .from<Prompt>('prompts')
    .select('*')
    .eq('session_id', sessionId)
    .eq('is_favorite', true)
    .eq('is_archived', false)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data as Prompt[] | null) || [];
}
