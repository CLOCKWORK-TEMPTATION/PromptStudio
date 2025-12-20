import { create } from 'zustand';
import type { AnalysisResult, TokenVisualization, ToolDefinition, SmartVariable } from '../types';

interface MetaPromptConfig {
  persona?: string;
  domain?: string;
  timeConstraint?: 'urgent' | 'standard' | 'comprehensive';
  metaInstructions?: Record<string, any>;
}

interface EditorState {
  content: string;
  title: string;
  description: string;
  tags: string[];
  category: string;
  modelId: string;

  // Meta-prompting configuration
  metaPromptConfig: MetaPromptConfig;
  sessionMetaPrompt: string | null;
  metaPromptEnabled: boolean;

  cursorPosition: number;
  selectionStart: number | null;
  selectionEnd: number | null;

  analysis: AnalysisResult | null;
  tokenVisualization: TokenVisualization | null;
  isAnalyzing: boolean;

  toolDefinitions: ToolDefinition[];
  smartVariables: SmartVariable[];
  showVariableSuggestions: boolean;
  variableSuggestionPosition: { x: number; y: number } | null;

  undoStack: string[];
  redoStack: string[];
  isDirty: boolean;
  lastSavedAt: string | null;

  collaborators: Collaborator[];
  isCollaborating: boolean;
  shareCode: string | null;

  setContent: (content: string) => void;
  setTitle: (title: string) => void;
  setDescription: (description: string) => void;
  setTags: (tags: string[]) => void;
  setCategory: (category: string) => void;
  setModelId: (modelId: string) => void;

  // Meta-prompting actions
  setMetaPromptConfig: (config: Partial<MetaPromptConfig>) => void;
  setSessionMetaPrompt: (metaPrompt: string | null) => void;
  setMetaPromptEnabled: (enabled: boolean) => void;
  generateSessionMetaPrompt: (sessionId: string) => Promise<void>;

  setCursorPosition: (position: number) => void;
  setSelection: (start: number | null, end: number | null) => void;

  setAnalysis: (analysis: AnalysisResult | null) => void;
  setTokenVisualization: (visualization: TokenVisualization | null) => void;
  setIsAnalyzing: (analyzing: boolean) => void;

  setToolDefinitions: (tools: ToolDefinition[]) => void;
  addToolDefinition: (tool: ToolDefinition) => void;
  updateToolDefinition: (id: string, updates: Partial<ToolDefinition>) => void;
  removeToolDefinition: (id: string) => void;

  setSmartVariables: (variables: SmartVariable[]) => void;
  setShowVariableSuggestions: (show: boolean) => void;
  setVariableSuggestionPosition: (position: { x: number; y: number } | null) => void;

  pushUndo: (content: string) => void;
  undo: () => string | null;
  redo: () => string | null;
  setIsDirty: (dirty: boolean) => void;
  setLastSavedAt: (timestamp: string | null) => void;

  setCollaborators: (collaborators: Collaborator[]) => void;
  addCollaborator: (collaborator: Collaborator) => void;
  removeCollaborator: (id: string) => void;
  updateCollaboratorCursor: (id: string, position: number) => void;
  setIsCollaborating: (collaborating: boolean) => void;
  setShareCode: (code: string | null) => void;

  resetEditor: () => void;
  loadPrompt: (prompt: { content: string; title: string; description: string; tags: string[]; category: string; model_id: string }) => void;
}

interface Collaborator {
  id: string;
  name: string;
  color: string;
  cursorPosition: number;
  selectionStart?: number;
  selectionEnd?: number;
}

const initialState = {
  content: '',
  title: 'Untitled Prompt',
  description: '',
  tags: [],
  category: 'general',
  modelId: 'gpt-4',
  metaPromptConfig: {
    timeConstraint: 'standard' as const,
  },
  sessionMetaPrompt: null,
  metaPromptEnabled: false,
  cursorPosition: 0,
  selectionStart: null,
  selectionEnd: null,
  analysis: null,
  tokenVisualization: null,
  isAnalyzing: false,
  toolDefinitions: [],
  smartVariables: [],
  showVariableSuggestions: false,
  variableSuggestionPosition: null,
  undoStack: [],
  redoStack: [],
  isDirty: false,
  lastSavedAt: null,
  collaborators: [],
  isCollaborating: false,
  shareCode: null,
};

export const useEditorStore = create<EditorState>((set, get) => ({
  ...initialState,

  setContent: (content) => {
    const current = get().content;
    if (current !== content) {
      set((state) => ({
        content,
        isDirty: true,
        undoStack: [...state.undoStack.slice(-50), current],
        redoStack: [],
      }));
    }
  },
  setTitle: (title) => set({ title, isDirty: true }),
  setDescription: (description) => set({ description, isDirty: true }),
  setTags: (tags) => set({ tags, isDirty: true }),
  setCategory: (category) => set({ category, isDirty: true }),
  setModelId: (modelId) => set({ modelId, isDirty: true }),

  // Meta-prompting actions
  setMetaPromptConfig: (config) => set((state) => ({
    metaPromptConfig: { ...state.metaPromptConfig, ...config },
    isDirty: true,
  })),
  setSessionMetaPrompt: (metaPrompt) => set({ sessionMetaPrompt: metaPrompt }),
  setMetaPromptEnabled: (enabled) => set({ metaPromptEnabled: enabled }),
  generateSessionMetaPrompt: async (sessionId: string) => {
    const { metaPromptConfig } = get();
    try {
      const response = await fetch('/api/prompts/generate-session-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          ...metaPromptConfig,
        }),
      });
      const data = await response.json();
      set({ sessionMetaPrompt: data.metaPrompt });
    } catch (error) {
      console.error('Failed to generate session meta-prompt:', error);
    }
  },

  setCursorPosition: (position) => set({ cursorPosition: position }),
  setSelection: (start, end) => set({ selectionStart: start, selectionEnd: end }),

  setAnalysis: (analysis) => set({ analysis }),
  setTokenVisualization: (visualization) => set({ tokenVisualization: visualization }),
  setIsAnalyzing: (analyzing) => set({ isAnalyzing: analyzing }),

  setToolDefinitions: (tools) => set({ toolDefinitions: tools }),
  addToolDefinition: (tool) => set((state) => ({ toolDefinitions: [...state.toolDefinitions, tool] })),
  updateToolDefinition: (id, updates) => set((state) => ({
    toolDefinitions: state.toolDefinitions.map((t) => t.id === id ? { ...t, ...updates } : t)
  })),
  removeToolDefinition: (id) => set((state) => ({
    toolDefinitions: state.toolDefinitions.filter((t) => t.id !== id)
  })),

  setSmartVariables: (variables) => set({ smartVariables: variables }),
  setShowVariableSuggestions: (show) => set({ showVariableSuggestions: show }),
  setVariableSuggestionPosition: (position) => set({ variableSuggestionPosition: position }),

  pushUndo: (content) => set((state) => ({
    undoStack: [...state.undoStack.slice(-50), content]
  })),
  undo: () => {
    const { undoStack, content } = get();
    if (undoStack.length === 0) return null;
    const previous = undoStack[undoStack.length - 1];
    set((state) => ({
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, content],
      content: previous,
    }));
    return previous;
  },
  redo: () => {
    const { redoStack, content } = get();
    if (redoStack.length === 0) return null;
    const next = redoStack[redoStack.length - 1];
    set((state) => ({
      redoStack: state.redoStack.slice(0, -1),
      undoStack: [...state.undoStack, content],
      content: next,
    }));
    return next;
  },
  setIsDirty: (dirty) => set({ isDirty: dirty }),
  setLastSavedAt: (timestamp) => set({ lastSavedAt: timestamp }),

  setCollaborators: (collaborators) => set({ collaborators }),
  addCollaborator: (collaborator) => set((state) => ({
    collaborators: [...state.collaborators, collaborator]
  })),
  removeCollaborator: (id) => set((state) => ({
    collaborators: state.collaborators.filter((c) => c.id !== id)
  })),
  updateCollaboratorCursor: (id, position) => set((state) => ({
    collaborators: state.collaborators.map((c) => c.id === id ? { ...c, cursorPosition: position } : c)
  })),
  setIsCollaborating: (collaborating) => set({ isCollaborating: collaborating }),
  setShareCode: (code) => set({ shareCode: code }),

  resetEditor: () => set(initialState),
  loadPrompt: (prompt) => set({
    content: prompt.content,
    title: prompt.title,
    description: prompt.description,
    tags: prompt.tags,
    category: prompt.category,
    modelId: prompt.model_id,
    isDirty: false,
    undoStack: [],
    redoStack: [],
  }),
}));
