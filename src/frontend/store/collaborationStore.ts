import { create } from 'zustand';
import * as Y from 'yjs';
import type { UserPresence, Comment, CollaborationSession, MemberRole } from '@shared/types/collaboration';

interface CursorPosition {
  userId: string;
  userName: string;
  userColor: string;
  x: number;
  y: number;
  selection?: { start: number; end: number };
}

interface CollaborationState {
  // Session state
  currentSession: CollaborationSession | null;
  userRole: MemberRole | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;

  // CRDT document
  doc: Y.Doc | null;
  content: string;

  // Presence
  presence: UserPresence[];
  cursors: Map<string, CursorPosition>;
  typingUsers: Set<string>;

  // Comments
  comments: Comment[];

  // Actions
  setSession: (session: CollaborationSession | null) => void;
  setUserRole: (role: MemberRole | null) => void;
  setConnected: (connected: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  initDoc: (initialState?: Uint8Array) => void;
  updateContent: (content: string) => void;
  applyUpdate: (update: Uint8Array) => void;

  setPresence: (presence: UserPresence[]) => void;
  updateCursor: (cursor: CursorPosition) => void;
  removeCursor: (userId: string) => void;
  setTypingUser: (userId: string, isTyping: boolean) => void;

  setComments: (comments: Comment[]) => void;
  addComment: (comment: Comment) => void;
  updateComment: (commentId: string, updates: Partial<Comment>) => void;
  removeComment: (commentId: string) => void;

  reset: () => void;
}

export const useCollaborationStore = create<CollaborationState>((set, get) => ({
  currentSession: null,
  userRole: null,
  isConnected: false,
  isLoading: false,
  error: null,

  doc: null,
  content: '',

  presence: [],
  cursors: new Map(),
  typingUsers: new Set(),

  comments: [],

  setSession: (session) => set({ currentSession: session }),
  setUserRole: (role) => set({ userRole: role }),
  setConnected: (connected) => set({ isConnected: connected }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  initDoc: (initialState) => {
    const doc = new Y.Doc();

    if (initialState) {
      Y.applyUpdate(doc, initialState);
    }

    const text = doc.getText('content');

    // Listen for changes
    text.observe((event) => {
      set({ content: text.toString() });
    });

    set({ doc, content: text.toString() });
  },

  updateContent: (content) => {
    const { doc } = get();
    if (!doc) return;

    const text = doc.getText('content');
    doc.transact(() => {
      text.delete(0, text.length);
      text.insert(0, content);
    });
  },

  applyUpdate: (update) => {
    const { doc } = get();
    if (!doc) return;

    Y.applyUpdate(doc, update);
  },

  setPresence: (presence) => set({ presence }),

  updateCursor: (cursor) => {
    set((state) => {
      const cursors = new Map(state.cursors);
      cursors.set(cursor.userId, cursor);
      return { cursors };
    });
  },

  removeCursor: (userId) => {
    set((state) => {
      const cursors = new Map(state.cursors);
      cursors.delete(userId);
      return { cursors };
    });
  },

  setTypingUser: (userId, isTyping) => {
    set((state) => {
      const typingUsers = new Set(state.typingUsers);
      if (isTyping) {
        typingUsers.add(userId);
      } else {
        typingUsers.delete(userId);
      }
      return { typingUsers };
    });
  },

  setComments: (comments) => set({ comments }),

  addComment: (comment) => {
    set((state) => ({
      comments: [comment, ...state.comments],
    }));
  },

  updateComment: (commentId, updates) => {
    set((state) => ({
      comments: state.comments.map((c) =>
        c.id === commentId ? { ...c, ...updates } : c
      ),
    }));
  },

  removeComment: (commentId) => {
    set((state) => ({
      comments: state.comments.filter((c) => c.id !== commentId),
    }));
  },

  reset: () => {
    const { doc } = get();
    if (doc) {
      doc.destroy();
    }
    set({
      currentSession: null,
      userRole: null,
      isConnected: false,
      isLoading: false,
      error: null,
      doc: null,
      content: '',
      presence: [],
      cursors: new Map(),
      typingUsers: new Set(),
      comments: [],
    });
  },
}));
