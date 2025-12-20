import { useState, useEffect, useCallback } from 'react';
import {
  Save,
  Share2,
  Download,
  Copy,
  Check,
  Star,
  StarOff,
  MoreVertical,
  Play,
  Tag,
} from 'lucide-react';
import { PromptEditor } from './PromptEditor';
import { ModelControlPanel } from './ModelControlPanel';
import { AnalysisPanel } from './AnalysisPanel';
import { TokenizerVisualization } from './TokenizerVisualization';
import { ToolDefinitionPanel } from './ToolDefinitionPanel';
import { SmartVariables } from './SmartVariables';
import { VoiceInput } from './VoiceInput';
import { AIGenerator } from './AIGenerator';
import { MetaPromptingPanel } from '../../components/MetaPromptingPanel';
import { PreSendAnalysis } from './PreSendAnalysis';
import { useEditorStore } from '../../stores/editorStore';
import { useAppStore } from '../../stores/appStore';
import { createPrompt, updatePrompt } from '../../services/promptService';
import clsx from 'clsx';

export function EditorView() {
  const { theme, sessionId, currentPrompt, setCurrentPrompt, addNotification } = useAppStore();
  const {
    title,
    setTitle,
    content,
    tags,
    setTags,
    category,
    setCategory,
    modelId,
    isDirty,
    setIsDirty,
    setLastSavedAt,
  } = useEditorStore();

  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [activePanel, setActivePanel] = useState<'analysis' | 'tools' | 'variables' | 'meta'>('analysis');

  const handleSave = useCallback(async () => {
    if (!sessionId || !content.trim()) return;

    setIsSaving(true);
    try {
      if (currentPrompt) {
        const updated = await updatePrompt(currentPrompt.id, {
          title,
          content,
          tags,
          category,
          model_id: modelId,
        });
        setCurrentPrompt(updated);
      } else {
        const created = await createPrompt(sessionId, {
          title,
          content,
          tags,
          category,
          model_id: modelId,
        });
        setCurrentPrompt(created);
      }
      setIsDirty(false);
      setLastSavedAt(new Date().toISOString());
      addNotification({
        type: 'success',
        title: 'Saved',
        message: 'Prompt saved successfully',
        duration: 3000,
      });
    } catch {
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to save prompt',
        duration: 5000,
      });
    } finally {
      setIsSaving(false);
    }
  }, [sessionId, content, currentPrompt, title, tags, category, modelId, setCurrentPrompt, setIsDirty, setLastSavedAt, addNotification]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  return (
    <div className="h-full flex">
      <div className="flex-1 flex flex-col min-w-0">
        <div className={clsx(
          'px-6 py-4 border-b flex items-center justify-between',
          theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
        )}>
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled Prompt"
              className={clsx(
                'text-xl font-semibold bg-transparent border-none outline-none min-w-0 flex-1',
                theme === 'dark' ? 'text-white placeholder-gray-600' : 'text-gray-900 placeholder-gray-400'
              )}
            />

            <div className="flex items-center gap-2 flex-shrink-0">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className={clsx(
                    'inline-flex items-center gap-1 px-2 py-1 rounded text-sm',
                    theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
                  )}
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-red-500"
                  >
                    &times;
                  </button>
                </span>
              ))}
              {showTagInput ? (
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddTag();
                    if (e.key === 'Escape') setShowTagInput(false);
                  }}
                  onBlur={() => {
                    handleAddTag();
                    setShowTagInput(false);
                  }}
                  placeholder="Add tag..."
                  autoFocus
                  className={clsx(
                    'px-2 py-1 rounded text-sm border outline-none w-24',
                    theme === 'dark'
                      ? 'bg-gray-800 border-gray-700 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  )}
                />
              ) : (
                <button
                  onClick={() => setShowTagInput(true)}
                  className={clsx(
                    'p-1 rounded transition-colors',
                    theme === 'dark' ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
                  )}
                >
                  <Tag className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={handleCopy}
              className={clsx(
                'p-2 rounded-lg transition-colors',
                theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
              )}
              title="Copy to clipboard"
            >
              {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
            </button>

            <button
              className={clsx(
                'p-2 rounded-lg transition-colors',
                theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
              )}
              title="Share"
            >
              <Share2 className="w-5 h-5" />
            </button>

            <button
              className={clsx(
                'p-2 rounded-lg transition-colors',
                theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
              )}
              title="Export"
            >
              <Download className="w-5 h-5" />
            </button>

            <div className="w-px h-6 bg-gray-700 mx-1" />

            <button
              onClick={handleSave}
              disabled={isSaving || !isDirty}
              className={clsx(
                'px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors',
                isDirty
                  ? theme === 'dark'
                    ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                    : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                  : theme === 'dark'
                    ? 'bg-gray-800 text-gray-500'
                    : 'bg-gray-100 text-gray-400'
              )}
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        <div className="flex-1 p-6">
          <PromptEditor />
        </div>
      </div>

      <aside className={clsx(
        'w-96 border-l flex flex-col overflow-hidden',
        theme === 'dark' ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-gray-50'
      )}>
        <div className={clsx(
          'px-4 py-3 border-b flex gap-2',
          theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
        )}>
          {(['analysis', 'tools', 'variables', 'meta'] as const).map((panel) => (
            <button
              key={panel}
              onClick={() => setActivePanel(panel)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize',
                activePanel === panel
                  ? theme === 'dark'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-emerald-100 text-emerald-700'
                  : theme === 'dark'
                    ? 'text-gray-400 hover:text-white hover:bg-gray-800'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              )}
            >
              {panel}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activePanel === 'analysis' && (
            <>
              <PreSendAnalysis
                prompt={content}
                model={modelId || 'gpt-4'}
                autoAnalyze={true}
                debounceMs={500}
              />
              <AnalysisPanel />
              <TokenizerVisualization />
            </>
          )}

          {activePanel === 'tools' && (
            <>
              <ToolDefinitionPanel />
              <ModelControlPanel />
            </>
          )}

          {activePanel === 'variables' && (
            <>
              <SmartVariables />
              <AIGenerator />
              <VoiceInput />
            </>
          )}

          {activePanel === 'meta' && (
            <MetaPromptingPanel />
          )}
        </div>
      </aside>
    </div>
  );
}
