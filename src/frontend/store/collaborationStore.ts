// @ts-ignore - zustand module
import { create } from 'zustand';
// @ts-ignore - yjs module
import * as Y from 'yjs';

// Local type definitions since collaboration.js module may not exist
interface UserPresence {
  id: string;
  name: string;
  color: string;
  isOnline: boolean;
}

interface Comment {
  id: string;
  userId: string;
  content: string;
  createdAt: Date;
}

interface CollaborationSession {
  id: string;
  name: string;
  createdAt: Date;
  members: string[];
}

type MemberRole = 'owner' | 'editor' | 'viewer';

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

type SetState = (partial: Partial<CollaborationState> | ((state: CollaborationState) => Partial<CollaborationState>)) => void;
type GetState = () => CollaborationState;

export const useCollaborationStore = create<CollaborationState>((set: SetState, get: GetState) => ({
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

  setSession: (session: CollaborationSession | null) => set({ currentSession: session }),
  setUserRole: (role: MemberRole | null) => set({ userRole: role }),
  setConnected: (connected: boolean) => set({ isConnected: connected }),
  setLoading: (loading: boolean) => set({ isLoading: loading }),
  setError: (error: string | null) => set({ error }),

  initDoc: (initialState?: Uint8Array) => {
    const doc = new Y.Doc();

    if (initialState) {
      Y.applyUpdate(doc, initialState);
    }

    const text = doc.getText('content');

    // Listen for changes
    text.observe((_event: unknown) => {
      set({ content: text.toString() });
    });

    set({ doc, content: text.toString() });
  },

  updateContent: (content: string) => {
    const { doc } = get();
    if (!doc) return;

    const text = doc.getText('content');
    doc.transact(() => {
      text.delete(0, text.length);
      text.insert(0, content);
    });
  },

  applyUpdate: (update: Uint8Array) => {
    const { doc } = get();
    if (!doc) return;

    Y.applyUpdate(doc, update);
  },

  setPresence: (presence: UserPresence[]) => set({ presence }),

  updateCursor: (cursor: CursorPosition) => {
    set((state: CollaborationState) => {
      const cursors = new Map(state.cursors);
      cursors.set(cursor.userId, cursor);
      return { cursors };
    });
  },

  removeCursor: (userId: string) => {
    set((state: CollaborationState) => {
      const cursors = new Map(state.cursors);
      cursors.delete(userId);
      return { cursors };
    });
  },

  setTypingUser: (userId: string, isTyping: boolean) => {
    set((state: CollaborationState) => {
      const typingUsers = new Set(state.typingUsers);
      if (isTyping) {
        typingUsers.add(userId);
      } else {
        typingUsers.delete(userId);
      }
      return { typingUsers };
    });
  },

  setComments: (comments: Comment[]) => set({ comments }),

  addComment: (comment: Comment) => {
    set((state: CollaborationState) => ({
      comments: [comment, ...state.comments],
    }));
  },

  updateComment: (commentId: string, updates: Partial<Comment>) => {
    set((state: CollaborationState) => ({
      comments: state.comments.map((c: Comment) =>
        c.id === commentId ? { ...c, ...updates } : c
      ),
    }));
  },

  removeComment: (commentId: string) => {
    set((state: CollaborationState) => ({
      comments: state.comments.filter((c: Comment) => c.id !== commentId),
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
