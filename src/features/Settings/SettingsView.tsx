import { useState, useEffect } from 'react';
import {
  Settings,
  User,
  Palette,
  Code,
  Bell,
  Shield,
  Database,
  Cloud,
  Download,
  Upload,
  Trash2,
  Key,
  Globe,
  Monitor,
  Moon,
  Sun,
  Check,
  Copy,
  RefreshCw,
  Save,
  FolderOpen,
  Layers,
} from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useEditorStore } from '../../stores/editorStore';
import { supabase, getOrCreateSession, getSessionId } from '../../lib/supabase';
import type { EnvironmentProfile, ModelConfig } from '../../types';
import { DEFAULT_MODEL_CONFIG, AI_MODELS, SUPPORTED_LANGUAGES } from '../../types';
import clsx from 'clsx';

type SettingsTab = 'general' | 'editor' | 'models' | 'profiles' | 'export' | 'advanced';

const SETTINGS_TABS: { id: SettingsTab; label: string; icon: typeof Settings }[] = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'editor', label: 'Editor', icon: Code },
  { id: 'models', label: 'Models', icon: Layers },
  { id: 'profiles', label: 'Environment Profiles', icon: FolderOpen },
  { id: 'export', label: 'Export & Backup', icon: Download },
  { id: 'advanced', label: 'Advanced', icon: Shield },
];

export function SettingsView() {
  const { theme, setTheme, preferences, setPreferences, currentModelConfig, setCurrentModelConfig } = useAppStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [displayName, setDisplayName] = useState('Anonymous User');
  const [profiles, setProfiles] = useState<EnvironmentProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [savedConfigs, setSavedConfigs] = useState<{ id: string; name: string; config: ModelConfig }[]>([]);
  const [newConfigName, setNewConfigName] = useState('');
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [newProfile, setNewProfile] = useState({
    name: '',
    description: '',
    default_role: '',
    default_output_format: '',
  });

  useEffect(() => {
    loadUserData();
    loadProfiles();
    loadSavedConfigs();
  }, []);

  const loadUserData = async () => {
    const token = await getOrCreateSession();
    const { data } = await supabase
      .from('user_sessions')
      .select('display_name, preferences')
      .eq('session_token', token)
      .maybeSingle();

    if (data) {
      setDisplayName(data.display_name || 'Anonymous User');
    }
  };

  const loadProfiles = async () => {
    const token = await getOrCreateSession();
    const sessionId = await getSessionId(token);
    if (!sessionId) return;

    const { data } = await supabase
      .from('environment_profiles')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });

    if (data) {
      setProfiles(data);
    }
  };

  const loadSavedConfigs = async () => {
    const token = await getOrCreateSession();
    const sessionId = await getSessionId(token);
    if (!sessionId) return;

    const { data } = await supabase
      .from('model_configs')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });

    if (data) {
      setSavedConfigs(
        data.map((d) => ({
          id: d.id,
          name: d.name,
          config: {
            temperature: d.temperature,
            top_p: d.top_p,
            top_k: d.top_k,
            frequency_penalty: d.frequency_penalty,
            presence_penalty: d.presence_penalty,
            max_tokens: d.max_tokens,
            stop_sequences: d.stop_sequences || [],
            response_format: d.response_format,
          },
        }))
      );
    }
  };

  const saveDisplayName = async () => {
    setIsLoading(true);
    const token = await getOrCreateSession();
    await supabase.from('user_sessions').update({ display_name: displayName }).eq('session_token', token);
    setIsLoading(false);
    showSuccess();
  };

  const saveModelConfig = async () => {
    if (!newConfigName.trim()) return;
    setIsLoading(true);

    const token = await getOrCreateSession();
    const sessionId = await getSessionId(token);
    if (!sessionId) {
      setIsLoading(false);
      return;
    }

    await supabase.from('model_configs').insert({
      session_id: sessionId,
      name: newConfigName,
      model_id: 'gpt-4',
      temperature: currentModelConfig.temperature,
      top_p: currentModelConfig.top_p,
      top_k: currentModelConfig.top_k,
      frequency_penalty: currentModelConfig.frequency_penalty,
      presence_penalty: currentModelConfig.presence_penalty,
      max_tokens: currentModelConfig.max_tokens,
      stop_sequences: currentModelConfig.stop_sequences,
      response_format: currentModelConfig.response_format,
    });

    setNewConfigName('');
    loadSavedConfigs();
    setIsLoading(false);
    showSuccess();
  };

  const loadConfig = (config: ModelConfig) => {
    setCurrentModelConfig(config);
    showSuccess();
  };

  const deleteConfig = async (id: string) => {
    await supabase.from('model_configs').delete().eq('id', id);
    loadSavedConfigs();
  };

  const createProfile = async () => {
    if (!newProfile.name.trim()) return;
    setIsLoading(true);

    const token = await getOrCreateSession();
    const sessionId = await getSessionId(token);
    if (!sessionId) {
      setIsLoading(false);
      return;
    }

    await supabase.from('environment_profiles').insert({
      session_id: sessionId,
      name: newProfile.name,
      description: newProfile.description,
      default_role: newProfile.default_role,
      default_output_format: newProfile.default_output_format,
      default_constraints: [],
      variables: {},
      model_config: {},
      is_active: false,
    });

    setNewProfile({ name: '', description: '', default_role: '', default_output_format: '' });
    loadProfiles();
    setIsLoading(false);
    showSuccess();
  };

  const deleteProfile = async (id: string) => {
    await supabase.from('environment_profiles').delete().eq('id', id);
    loadProfiles();
  };

  const activateProfile = async (id: string) => {
    const token = await getOrCreateSession();
    const sessionId = await getSessionId(token);
    if (!sessionId) return;

    await supabase.from('environment_profiles').update({ is_active: false }).eq('session_id', sessionId);
    await supabase.from('environment_profiles').update({ is_active: true }).eq('id', id);
    loadProfiles();
  };

  const exportData = async () => {
    const token = await getOrCreateSession();
    const sessionId = await getSessionId(token);
    if (!sessionId) return;

    const { data: prompts } = await supabase.from('prompts').select('*').eq('session_id', sessionId);
    const { data: configs } = await supabase.from('model_configs').select('*').eq('session_id', sessionId);
    const { data: profilesData } = await supabase.from('environment_profiles').select('*').eq('session_id', sessionId);

    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      prompts: prompts || [],
      model_configs: configs || [],
      environment_profiles: profilesData || [],
      preferences,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompt-studio-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearAllData = async () => {
    if (!confirm('Are you sure you want to delete all your data? This action cannot be undone.')) return;

    const token = await getOrCreateSession();
    const sessionId = await getSessionId(token);
    if (!sessionId) return;

    await supabase.from('prompts').delete().eq('session_id', sessionId);
    await supabase.from('model_configs').delete().eq('session_id', sessionId);
    await supabase.from('environment_profiles').delete().eq('session_id', sessionId);
    await supabase.from('prompt_chains').delete().eq('session_id', sessionId);

    loadProfiles();
    loadSavedConfigs();
    showSuccess();
  };

  const showSuccess = () => {
    setShowSaveSuccess(true);
    setTimeout(() => setShowSaveSuccess(false), 2000);
  };

  const renderGeneralSettings = () => (
    <div className="space-y-8">
      <div>
        <h3 className={clsx('text-lg font-medium mb-4', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          Appearance
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className={clsx('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>Theme</label>
              <p className={clsx('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Choose your preferred color scheme
              </p>
            </div>
            <div className="flex gap-2">
              {(['light', 'dark'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={clsx(
                    'px-4 py-2 rounded-lg flex items-center gap-2 transition-colors capitalize',
                    theme === t
                      ? theme === 'dark'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                        : 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                      : theme === 'dark'
                      ? 'bg-gray-800 text-gray-400 border border-gray-700'
                      : 'bg-gray-100 text-gray-600 border border-gray-200'
                  )}
                >
                  {t === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className={clsx('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Language
              </label>
              <p className={clsx('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Interface language
              </p>
            </div>
            <select
              value={preferences.language}
              onChange={(e) => setPreferences({ language: e.target.value })}
              className={clsx(
                'px-4 py-2 rounded-lg border',
                theme === 'dark'
                  ? 'bg-gray-800 border-gray-700 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              )}
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name} ({lang.nativeName})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div>
        <h3 className={clsx('text-lg font-medium mb-4', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          Profile
        </h3>
        <div className="space-y-4">
          <div>
            <label className={clsx('block text-sm font-medium mb-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
              Display Name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={clsx(
                  'flex-1 px-4 py-2 rounded-lg border',
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                )}
              />
              <button
                onClick={saveDisplayName}
                disabled={isLoading}
                className={clsx(
                  'px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors',
                  theme === 'dark'
                    ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                    : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                )}
              >
                <Save className="w-4 h-4" />
                Save
              </button>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className={clsx('text-lg font-medium mb-4', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          Behavior
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className={clsx('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>Auto Save</label>
              <p className={clsx('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Automatically save changes while editing
              </p>
            </div>
            <button
              onClick={() => setPreferences({ auto_save: !preferences.auto_save })}
              className={clsx(
                'w-12 h-6 rounded-full transition-colors relative',
                preferences.auto_save ? 'bg-emerald-500' : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-300'
              )}
            >
              <div
                className={clsx(
                  'absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform',
                  preferences.auto_save ? 'translate-x-6' : 'translate-x-0.5'
                )}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderEditorSettings = () => (
    <div className="space-y-8">
      <div>
        <h3 className={clsx('text-lg font-medium mb-4', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          Editor Preferences
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className={clsx('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Font Size
              </label>
              <p className={clsx('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Editor font size in pixels
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPreferences({ editor_font_size: Math.max(10, preferences.editor_font_size - 1) })}
                className={clsx(
                  'w-8 h-8 rounded-lg flex items-center justify-center',
                  theme === 'dark'
                    ? 'bg-gray-800 text-gray-400 hover:text-white'
                    : 'bg-gray-100 text-gray-600 hover:text-gray-900'
                )}
              >
                -
              </button>
              <span
                className={clsx('w-12 text-center font-mono', theme === 'dark' ? 'text-white' : 'text-gray-900')}
              >
                {preferences.editor_font_size}px
              </span>
              <button
                onClick={() => setPreferences({ editor_font_size: Math.min(24, preferences.editor_font_size + 1) })}
                className={clsx(
                  'w-8 h-8 rounded-lg flex items-center justify-center',
                  theme === 'dark'
                    ? 'bg-gray-800 text-gray-400 hover:text-white'
                    : 'bg-gray-100 text-gray-600 hover:text-gray-900'
                )}
              >
                +
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className={clsx('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Line Numbers
              </label>
              <p className={clsx('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Show line numbers in editor
              </p>
            </div>
            <button
              onClick={() => setPreferences({ show_line_numbers: !preferences.show_line_numbers })}
              className={clsx(
                'w-12 h-6 rounded-full transition-colors relative',
                preferences.show_line_numbers ? 'bg-emerald-500' : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-300'
              )}
            >
              <div
                className={clsx(
                  'absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform',
                  preferences.show_line_numbers ? 'translate-x-6' : 'translate-x-0.5'
                )}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderModelSettings = () => (
    <div className="space-y-8">
      <div>
        <h3 className={clsx('text-lg font-medium mb-4', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          Current Model Configuration
        </h3>
        <div
          className={clsx(
            'p-4 rounded-lg border space-y-4',
            theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
          )}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={clsx('block text-sm mb-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Temperature
              </label>
              <span className={clsx('font-mono', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                {currentModelConfig.temperature}
              </span>
            </div>
            <div>
              <label className={clsx('block text-sm mb-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Top P
              </label>
              <span className={clsx('font-mono', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                {currentModelConfig.top_p}
              </span>
            </div>
            <div>
              <label className={clsx('block text-sm mb-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Max Tokens
              </label>
              <span className={clsx('font-mono', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                {currentModelConfig.max_tokens}
              </span>
            </div>
            <div>
              <label className={clsx('block text-sm mb-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Response Format
              </label>
              <span className={clsx('font-mono', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                {currentModelConfig.response_format}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newConfigName}
              onChange={(e) => setNewConfigName(e.target.value)}
              placeholder="Configuration name..."
              className={clsx(
                'flex-1 px-3 py-2 rounded-lg border text-sm',
                theme === 'dark'
                  ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
              )}
            />
            <button
              onClick={saveModelConfig}
              disabled={!newConfigName.trim() || isLoading}
              className={clsx(
                'px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors',
                theme === 'dark'
                  ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50'
                  : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-50'
              )}
            >
              <Save className="w-4 h-4" />
              Save Config
            </button>
          </div>
        </div>
      </div>

      <div>
        <h3 className={clsx('text-lg font-medium mb-4', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          Saved Configurations
        </h3>
        {savedConfigs.length === 0 ? (
          <p className={clsx('text-sm', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
            No saved configurations yet
          </p>
        ) : (
          <div className="space-y-2">
            {savedConfigs.map((config) => (
              <div
                key={config.id}
                className={clsx(
                  'flex items-center justify-between p-4 rounded-lg border',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                )}
              >
                <div>
                  <span className={clsx('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {config.name}
                  </span>
                  <p className={clsx('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                    Temp: {config.config.temperature}, Max Tokens: {config.config.max_tokens}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => loadConfig(config.config)}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                      theme === 'dark'
                        ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                        : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    )}
                  >
                    Load
                  </button>
                  <button
                    onClick={() => deleteConfig(config.id)}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                      theme === 'dark'
                        ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                    )}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className={clsx('text-lg font-medium mb-4', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          Available Models
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {AI_MODELS.map((model) => (
            <div
              key={model.id}
              className={clsx(
                'p-3 rounded-lg border',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={clsx('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  {model.name}
                </span>
                <span
                  className={clsx(
                    'text-xs px-2 py-0.5 rounded-full capitalize',
                    theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'
                  )}
                >
                  {model.provider}
                </span>
              </div>
              <div className="flex gap-4">
                <span className={clsx('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                  {model.context_window.toLocaleString()} tokens
                </span>
                <span className={clsx('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                  ${model.pricing.input}/1K in
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderProfilesSettings = () => (
    <div className="space-y-8">
      <div>
        <h3 className={clsx('text-lg font-medium mb-4', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          Create Environment Profile
        </h3>
        <div
          className={clsx(
            'p-4 rounded-lg border space-y-4',
            theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
          )}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={clsx('block text-sm font-medium mb-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                Profile Name
              </label>
              <input
                type="text"
                value={newProfile.name}
                onChange={(e) => setNewProfile({ ...newProfile, name: e.target.value })}
                placeholder="e.g., Code Review"
                className={clsx(
                  'w-full px-3 py-2 rounded-lg border text-sm',
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                )}
              />
            </div>
            <div>
              <label className={clsx('block text-sm font-medium mb-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                Description
              </label>
              <input
                type="text"
                value={newProfile.description}
                onChange={(e) => setNewProfile({ ...newProfile, description: e.target.value })}
                placeholder="Profile description..."
                className={clsx(
                  'w-full px-3 py-2 rounded-lg border text-sm',
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                )}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={clsx('block text-sm font-medium mb-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                Default Role
              </label>
              <input
                type="text"
                value={newProfile.default_role}
                onChange={(e) => setNewProfile({ ...newProfile, default_role: e.target.value })}
                placeholder="You are a..."
                className={clsx(
                  'w-full px-3 py-2 rounded-lg border text-sm',
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                )}
              />
            </div>
            <div>
              <label className={clsx('block text-sm font-medium mb-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                Default Output Format
              </label>
              <input
                type="text"
                value={newProfile.default_output_format}
                onChange={(e) => setNewProfile({ ...newProfile, default_output_format: e.target.value })}
                placeholder="JSON, Markdown, etc."
                className={clsx(
                  'w-full px-3 py-2 rounded-lg border text-sm',
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                )}
              />
            </div>
          </div>
          <button
            onClick={createProfile}
            disabled={!newProfile.name.trim() || isLoading}
            className={clsx(
              'px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors',
              theme === 'dark'
                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50'
                : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-50'
            )}
          >
            <FolderOpen className="w-4 h-4" />
            Create Profile
          </button>
        </div>
      </div>

      <div>
        <h3 className={clsx('text-lg font-medium mb-4', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          Your Profiles
        </h3>
        {profiles.length === 0 ? (
          <p className={clsx('text-sm', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
            No profiles created yet
          </p>
        ) : (
          <div className="space-y-2">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className={clsx(
                  'flex items-center justify-between p-4 rounded-lg border',
                  profile.is_active
                    ? theme === 'dark'
                      ? 'bg-emerald-500/10 border-emerald-500/50'
                      : 'bg-emerald-50 border-emerald-300'
                    : theme === 'dark'
                    ? 'bg-gray-800/50 border-gray-700'
                    : 'bg-gray-50 border-gray-200'
                )}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className={clsx('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {profile.name}
                    </span>
                    {profile.is_active && (
                      <span
                        className={clsx(
                          'text-xs px-2 py-0.5 rounded-full',
                          theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                        )}
                      >
                        Active
                      </span>
                    )}
                  </div>
                  <p className={clsx('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                    {profile.description || profile.default_role || 'No description'}
                  </p>
                </div>
                <div className="flex gap-2">
                  {!profile.is_active && (
                    <button
                      onClick={() => activateProfile(profile.id)}
                      className={clsx(
                        'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                        theme === 'dark'
                          ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                          : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      )}
                    >
                      Activate
                    </button>
                  )}
                  <button
                    onClick={() => deleteProfile(profile.id)}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                      theme === 'dark'
                        ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                    )}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderExportSettings = () => (
    <div className="space-y-8">
      <div>
        <h3 className={clsx('text-lg font-medium mb-4', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          Export & Backup
        </h3>
        <div className="space-y-4">
          <div
            className={clsx(
              'p-4 rounded-lg border',
              theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
            )}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className={clsx('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  Export All Data
                </span>
                <p className={clsx('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                  Download all your prompts, configurations, and settings as JSON
                </p>
              </div>
              <button
                onClick={exportData}
                className={clsx(
                  'px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors',
                  theme === 'dark'
                    ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                    : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                )}
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAdvancedSettings = () => (
    <div className="space-y-8">
      <div>
        <h3 className={clsx('text-lg font-medium mb-4', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          Danger Zone
        </h3>
        <div
          className={clsx(
            'p-4 rounded-lg border',
            theme === 'dark' ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200'
          )}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className={clsx('font-medium', theme === 'dark' ? 'text-red-400' : 'text-red-700')}>
                Clear All Data
              </span>
              <p className={clsx('text-sm', theme === 'dark' ? 'text-red-400/70' : 'text-red-600')}>
                Permanently delete all your prompts, configurations, and settings
              </p>
            </div>
            <button
              onClick={clearAllData}
              className={clsx(
                'px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors',
                theme === 'dark'
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : 'bg-red-100 text-red-700 hover:bg-red-200'
              )}
            >
              <Trash2 className="w-4 h-4" />
              Clear All
            </button>
          </div>
        </div>
      </div>

      <div>
        <h3 className={clsx('text-lg font-medium mb-4', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          Reset to Defaults
        </h3>
        <div
          className={clsx(
            'p-4 rounded-lg border',
            theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
          )}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className={clsx('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Reset Model Configuration
              </span>
              <p className={clsx('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Reset model settings to default values
              </p>
            </div>
            <button
              onClick={() => {
                setCurrentModelConfig(DEFAULT_MODEL_CONFIG);
                showSuccess();
              }}
              className={clsx(
                'px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors',
                theme === 'dark'
                  ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                  : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
              )}
            >
              <RefreshCw className="w-4 h-4" />
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'general':
        return renderGeneralSettings();
      case 'editor':
        return renderEditorSettings();
      case 'models':
        return renderModelSettings();
      case 'profiles':
        return renderProfilesSettings();
      case 'export':
        return renderExportSettings();
      case 'advanced':
        return renderAdvancedSettings();
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex">
      <aside
        className={clsx(
          'w-64 border-r p-4',
          theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
        )}
      >
        <div className="flex items-center gap-3 mb-6">
          <Settings className={clsx('w-6 h-6', theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600')} />
          <h1 className={clsx('text-xl font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Settings
          </h1>
        </div>

        <nav className="space-y-1">
          {SETTINGS_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left',
                  activeTab === tab.id
                    ? theme === 'dark'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-emerald-50 text-emerald-600'
                    : theme === 'dark'
                    ? 'text-gray-400 hover:text-white hover:bg-gray-800'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-3xl">
          {renderContent()}
        </div>
      </main>

      {showSaveSuccess && (
        <div
          className={clsx(
            'fixed bottom-4 right-4 px-4 py-3 rounded-lg flex items-center gap-2 shadow-lg',
            theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
          )}
        >
          <Check className="w-5 h-5" />
          <span className="font-medium">Saved successfully</span>
        </div>
      )}
    </div>
  );
}
