import * as Y from 'yjs';
import redis from '../../lib/redis.js';

interface DocumentState {
  doc: Y.Doc;
  lastModified: number;
  pendingUpdates: Uint8Array[];
}

export class CRDTManager {
  private documents: Map<string, DocumentState> = new Map();
  private readonly PERSIST_INTERVAL = 5000; // 5 seconds
  private persistTimers: Map<string, NodeJS.Timeout> = new Map();

  async getDocument(sessionId: string): Promise<Y.Doc> {
    let state = this.documents.get(sessionId);

    if (!state) {
      const doc = new Y.Doc();

      // Try to load from Redis first
      const savedState = await redis.getBuffer(`crdt:${sessionId}`);
      if (savedState) {
        Y.applyUpdate(doc, savedState);
      }

      state = {
        doc,
        lastModified: Date.now(),
        pendingUpdates: [],
      };

      this.documents.set(sessionId, state);

      // Set up persistence
      this.setupPersistence(sessionId);
    }

    return state.doc;
  }

  async applyUpdate(sessionId: string, update: Uint8Array, origin?: string): Promise<void> {
    const doc = await this.getDocument(sessionId);
    const state = this.documents.get(sessionId)!;

    Y.applyUpdate(doc, update, origin);
    state.lastModified = Date.now();
    state.pendingUpdates.push(update);

    // Schedule persistence
    this.schedulePersistence(sessionId);
  }

  async getStateVector(sessionId: string): Promise<Uint8Array> {
    const doc = await this.getDocument(sessionId);
    return Y.encodeStateVector(doc);
  }

  async getStateAsUpdate(sessionId: string, targetStateVector?: Uint8Array): Promise<Uint8Array> {
    const doc = await this.getDocument(sessionId);
    return Y.encodeStateAsUpdate(doc, targetStateVector);
  }

  async getText(sessionId: string): Promise<string> {
    const doc = await this.getDocument(sessionId);
    const text = doc.getText('content');
    return text.toString();
  }

  async setText(sessionId: string, content: string): Promise<Uint8Array> {
    const doc = await this.getDocument(sessionId);
    const text = doc.getText('content');

    doc.transact(() => {
      text.delete(0, text.length);
      text.insert(0, content);
    });

    const state = this.documents.get(sessionId)!;
    state.lastModified = Date.now();

    return Y.encodeStateAsUpdate(doc);
  }

  async insertText(sessionId: string, index: number, content: string, userId: string): Promise<Uint8Array> {
    const doc = await this.getDocument(sessionId);
    const text = doc.getText('content');

    doc.transact(() => {
      text.insert(index, content);
    }, userId);

    const update = Y.encodeStateAsUpdate(doc);

    const state = this.documents.get(sessionId)!;
    state.lastModified = Date.now();
    state.pendingUpdates.push(update);

    this.schedulePersistence(sessionId);

    return update;
  }

  async deleteText(sessionId: string, index: number, length: number, userId: string): Promise<Uint8Array> {
    const doc = await this.getDocument(sessionId);
    const text = doc.getText('content');

    doc.transact(() => {
      text.delete(index, length);
    }, userId);

    const update = Y.encodeStateAsUpdate(doc);

    const state = this.documents.get(sessionId)!;
    state.lastModified = Date.now();
    state.pendingUpdates.push(update);

    this.schedulePersistence(sessionId);

    return update;
  }

  private setupPersistence(sessionId: string): void {
    const state = this.documents.get(sessionId);
    if (!state) return;

    // Listen for updates
    state.doc.on('update', (update: Uint8Array, origin: unknown) => {
      state.pendingUpdates.push(update);
      this.schedulePersistence(sessionId);
    });
  }

  private schedulePersistence(sessionId: string): void {
    // Clear existing timer
    const existingTimer = this.persistTimers.get(sessionId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Schedule new persistence
    const timer = setTimeout(() => {
      this.persistDocument(sessionId);
    }, this.PERSIST_INTERVAL);

    this.persistTimers.set(sessionId, timer);
  }

  private async persistDocument(sessionId: string): Promise<void> {
    const state = this.documents.get(sessionId);
    if (!state) return;

    try {
      const fullState = Y.encodeStateAsUpdate(state.doc);
      await redis.set(`crdt:${sessionId}`, Buffer.from(fullState), 'EX', 86400); // 24 hours

      // Clear pending updates after successful persist
      state.pendingUpdates = [];

      console.log(`📦 Persisted CRDT document for session ${sessionId}`);
    } catch (error) {
      console.error(`Error persisting CRDT document for session ${sessionId}:`, error);
    }
  }

  async syncWithClient(sessionId: string, clientStateVector: Uint8Array): Promise<Uint8Array> {
    const doc = await this.getDocument(sessionId);
    return Y.encodeStateAsUpdate(doc, clientStateVector);
  }

  async mergeClientState(sessionId: string, clientUpdate: Uint8Array): Promise<void> {
    await this.applyUpdate(sessionId, clientUpdate, 'client');
  }

  removeDocument(sessionId: string): void {
    const state = this.documents.get(sessionId);
    if (state) {
      // Persist before removing
      this.persistDocument(sessionId);

      // Clear timer
      const timer = this.persistTimers.get(sessionId);
      if (timer) {
        clearTimeout(timer);
        this.persistTimers.delete(sessionId);
      }

      // Destroy doc
      state.doc.destroy();
      this.documents.delete(sessionId);
    }
  }

  // Get awareness info (user cursors, selections, etc.)
  getAwareness(sessionId: string): Map<string, unknown> {
    // Awareness is typically handled separately, but we can store it here
    return new Map();
  }
}

export default CRDTManager;
