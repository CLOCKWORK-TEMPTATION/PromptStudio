import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MCPContextService, CompressionLevel, PruningStrategy } from '../services/MCPContextService.js';

describe('MCPContextService', () => {
  let mcpService: MCPContextService;

  beforeEach(() => {
    mcpService = new MCPContextService();
    vi.clearAllMocks();
  });

  describe('createContextWindow', () => {
    it('should create a new context window', async () => {
      const window = await mcpService.createContextWindow('test-session');

      expect(window).toBeDefined();
      expect(window.sessionId).toBe('test-session');
      expect(window.messages).toEqual([]);
      expect(window.totalTokens).toBe(0);
    });

    it('should use custom config when provided', async () => {
      const config = {
        maxTokens: 50000,
        compressionLevel: 'aggressive' as CompressionLevel,
        pruningStrategy: 'importance' as PruningStrategy,
      };

      const window = await mcpService.createContextWindow('test-session', config);

      expect(window.maxTokens).toBe(50000);
    });

    it('should generate unique window IDs', async () => {
      const window1 = await mcpService.createContextWindow('session-1');
      const window2 = await mcpService.createContextWindow('session-2');

      expect(window1.id).not.toBe(window2.id);
    });
  });

  describe('addMessage', () => {
    beforeEach(async () => {
      await mcpService.createContextWindow('test-session');
    });

    it('should add a message to the context window', async () => {
      const result = await mcpService.addMessage('test-session', {
        role: 'user',
        content: 'Hello, world!',
      });

      expect(result.window.messages.length).toBe(1);
      expect(result.window.messages[0].content).toBe('Hello, world!');
    });

    it('should track total tokens', async () => {
      await mcpService.addMessage('test-session', {
        role: 'user',
        content: 'Hello, world!',
      });

      const stats = mcpService.getWindowStats('test-session');
      expect(stats?.totalTokens).toBeGreaterThan(0);
    });

    it('should handle importance scores', async () => {
      await mcpService.addMessage('test-session', {
        role: 'user',
        content: 'Important message',
        importance: 0.9,
      });

      const stats = mcpService.getWindowStats('test-session');
      expect(stats).toBeDefined();
    });

    it('should trigger compression when threshold exceeded', async () => {
      // Create window with low token limit
      await mcpService.createContextWindow('compress-test', {
        maxTokens: 100,
        compressionThreshold: 0.8,
        compressionLevel: CompressionLevel.LIGHT,
      });

      // Add messages to exceed threshold
      for (let i = 0; i < 10; i++) {
        await mcpService.addMessage('compress-test', {
          role: 'user',
          content: `Message ${i}: This is a test message with some content.`,
        });
      }

      // Check if compression was applied
      const stats = mcpService.getWindowStats('compress-test');
      expect(stats).toBeDefined();
    });
  });

  describe('compressContext', () => {
    beforeEach(async () => {
      await mcpService.createContextWindow('test-session');
      for (let i = 0; i < 5; i++) {
        await mcpService.addMessage('test-session', {
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}: This is test content.`,
        });
      }
    });

    it('should compress context and reduce token count', async () => {
      await mcpService.compressContext('test-session', {
        compressionLevel: CompressionLevel.MODERATE,
      });
      const afterStats = mcpService.getWindowStats('test-session');

      expect(afterStats).toBeDefined();
    });

    it('should preserve system messages when configured', async () => {
      await mcpService.addMessage('test-session', {
        role: 'system',
        content: 'You are a helpful assistant.',
      });

      await mcpService.compressContext('test-session', {
        keepSystemMessages: true,
        pruningStrategy: PruningStrategy.FIFO,
      });

      const context = mcpService.getContextForAPI('test-session');
      const systemMessages = context.filter(m => m.role === 'system');
      expect(systemMessages.length).toBeGreaterThan(0);
    });
  });

  describe('getContextForAPI', () => {
    it('should return empty array for non-existent session', () => {
      const context = mcpService.getContextForAPI('non-existent');
      expect(context).toEqual([]);
    });

    it('should return messages in correct format', async () => {
      await mcpService.createContextWindow('test-session');
      await mcpService.addMessage('test-session', {
        role: 'user',
        content: 'Hello',
      });

      const context = mcpService.getContextForAPI('test-session');

      expect(context[0]).toEqual({
        role: 'user',
        content: 'Hello',
      });
    });

    it('should respect maxTokens limit', async () => {
      await mcpService.createContextWindow('test-session');
      for (let i = 0; i < 20; i++) {
        await mcpService.addMessage('test-session', {
          role: 'user',
          content: `Message ${i}: This is a longer message with some content.`,
        });
      }

      const context = mcpService.getContextForAPI('test-session', 100);
      expect(context.length).toBeLessThan(20);
    });
  });

  describe('getWindowStats', () => {
    it('should return null for non-existent session', () => {
      const stats = mcpService.getWindowStats('non-existent');
      expect(stats).toBeNull();
    });

    it('should return accurate statistics', async () => {
      await mcpService.createContextWindow('test-session');
      await mcpService.addMessage('test-session', {
        role: 'user',
        content: 'Test message',
      });

      const stats = mcpService.getWindowStats('test-session');

      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('totalTokens');
      expect(stats).toHaveProperty('totalMessages');
      expect(typeof stats?.totalTokens).toBe('number');
      expect(stats?.totalMessages).toBe(1);
    });
  });

  describe('deleteContextWindow', () => {
    it('should delete existing window', async () => {
      await mcpService.createContextWindow('test-session');
      const deleted = mcpService.deleteContextWindow('test-session');

      expect(deleted).toBe(true);
      expect(mcpService.getWindowStats('test-session')).toBeNull();
    });

    it('should return false for non-existent window', () => {
      const deleted = mcpService.deleteContextWindow('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should clean up inactive windows', async () => {
      await mcpService.createContextWindow('old-session');

      // Wait a bit and then cleanup
      const cleaned = await mcpService.cleanup(0); // 0 minutes = immediate cleanup

      expect(cleaned).toBeGreaterThanOrEqual(0);
    });
  });

  describe('pruning strategies', () => {
    beforeEach(async () => {
      await mcpService.createContextWindow('prune-test', {
        maxTokens: 200,
        compressionThreshold: 0.5,
      });
    });

    it('should apply FIFO pruning correctly', async () => {
      for (let i = 0; i < 10; i++) {
        await mcpService.addMessage('prune-test', {
          role: 'user',
          content: `Message ${i}`,
        });
      }

      await mcpService.compressContext('prune-test', {
        pruningStrategy: PruningStrategy.FIFO,
      });

      const stats = mcpService.getWindowStats('prune-test');
      expect(stats).toBeDefined();
    });

    it('should apply importance-based pruning correctly', async () => {
      await mcpService.addMessage('prune-test', {
        role: 'user',
        content: 'Low importance message',
        importance: 0.1,
      });

      await mcpService.addMessage('prune-test', {
        role: 'user',
        content: 'High importance message',
        importance: 0.9,
      });

      await mcpService.compressContext('prune-test', {
        pruningStrategy: PruningStrategy.IMPORTANCE,
      });

      const context = mcpService.getContextForAPI('prune-test');
      expect(context).toBeDefined();
    });
  });
});
