import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RAGIngestService, ChunkResult } from '../services/RAGIngestService.js';

// Mock prisma
vi.mock('../lib/prisma.js', () => ({
  default: {
    knowledgeBase: {
      findUnique: vi.fn(),
    },
    knowledgeDocument: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      groupBy: vi.fn(),
      aggregate: vi.fn(),
    },
  },
}));

// Mock EmbeddingUtil
vi.mock('../services/embedding-util.js', () => ({
  EmbeddingUtil: {
    generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    estimateTokenCount: vi.fn((text: string) => Math.ceil(text.length / 4)),
    cosineSimilarity: vi.fn().mockReturnValue(0.85),
  },
}));

describe('RAGIngestService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('preprocessText', () => {
    it('should remove HTML tags', () => {
      const input = '<p>Hello <b>World</b></p>';
      const result = RAGIngestService.preprocessText(input, { removeHtmlTags: true });
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
      expect(result).toContain('Hello');
      expect(result).toContain('World');
    });

    it('should normalize extra whitespace', () => {
      const input = 'Hello   World\n\n\n\nTest';
      const result = RAGIngestService.preprocessText(input, { removeExtraWhitespace: true });
      expect(result).not.toContain('   ');
      expect(result).not.toContain('\n\n\n');
    });

    it('should replace emails with placeholder', () => {
      const input = 'Contact us at test@example.com for help';
      const result = RAGIngestService.preprocessText(input, { removeEmails: true });
      expect(result).toContain('[EMAIL]');
      expect(result).not.toContain('test@example.com');
    });

    it('should replace URLs with placeholder when enabled', () => {
      const input = 'Visit https://example.com for more info';
      const result = RAGIngestService.preprocessText(input, { removeUrls: true });
      expect(result).toContain('[URL]');
      expect(result).not.toContain('https://example.com');
    });

    it('should normalize Unicode', () => {
      const input = 'ﬁ ﬂ'; // ligatures
      const result = RAGIngestService.preprocessText(input, { normalizeUnicode: true });
      expect(result).toBe('fi fl');
    });

    it('should convert to lowercase when enabled', () => {
      const input = 'Hello WORLD';
      const result = RAGIngestService.preprocessText(input, { lowercase: true });
      expect(result).toBe('hello world');
    });
  });

  describe('smartChunk', () => {
    it('should split text into chunks', () => {
      const text = 'First paragraph here.\n\nSecond paragraph here.\n\nThird paragraph here.';
      const chunks = RAGIngestService.smartChunk(text, { chunkSize: 50, overlap: 10 });

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]).toHaveProperty('content');
      expect(chunks[0]).toHaveProperty('index');
      expect(chunks[0]).toHaveProperty('hash');
    });

    it('should respect paragraph boundaries', () => {
      const text = 'Paragraph one.\n\nParagraph two.\n\nParagraph three.';
      const chunks = RAGIngestService.smartChunk(text, {
        chunkSize: 200,
        respectParagraphs: true
      });

      expect(chunks.length).toBe(1); // All fit in one chunk
      expect(chunks[0].content).toContain('Paragraph one');
    });

    it('should create unique hashes for different chunks', () => {
      const text = 'First chunk content here.\n\nSecond chunk content here.\n\nThird chunk content here.';
      const chunks = RAGIngestService.smartChunk(text, { chunkSize: 30 });

      if (chunks.length > 1) {
        const hashes = chunks.map(c => c.hash);
        const uniqueHashes = new Set(hashes);
        expect(uniqueHashes.size).toBe(hashes.length);
      }
    });

    it('should include token estimates', () => {
      const text = 'This is a test paragraph.';
      const chunks = RAGIngestService.smartChunk(text);

      expect(chunks[0].tokenEstimate).toBeGreaterThan(0);
    });

    it('should handle empty text', () => {
      const chunks = RAGIngestService.smartChunk('');
      expect(chunks.length).toBe(0);
    });

    it('should handle very long paragraphs by splitting on sentences', () => {
      const longSentence = 'This is a sentence. '.repeat(50);
      const chunks = RAGIngestService.smartChunk(longSentence, {
        chunkSize: 100,
        respectSentences: true
      });

      expect(chunks.length).toBeGreaterThan(1);
    });
  });

  describe('chunk result properties', () => {
    it('should have correct chunk structure', () => {
      const text = 'Test content here.';
      const chunks = RAGIngestService.smartChunk(text);

      expect(chunks[0]).toMatchObject({
        id: expect.any(String),
        content: expect.any(String),
        index: expect.any(Number),
        startOffset: expect.any(Number),
        endOffset: expect.any(Number),
        tokenEstimate: expect.any(Number),
        hash: expect.any(String),
      });
    });

    it('should have incrementing indices', () => {
      const text = 'Para 1.\n\nPara 2.\n\nPara 3.\n\nPara 4.\n\nPara 5.';
      const chunks = RAGIngestService.smartChunk(text, { chunkSize: 20 });

      for (let i = 0; i < chunks.length; i++) {
        expect(chunks[i].index).toBe(i);
      }
    });
  });

  describe('Arabic and multilingual support', () => {
    it('should handle Arabic text', () => {
      const arabicText = 'مرحباً بالعالم. هذا نص عربي للاختبار.';
      const chunks = RAGIngestService.smartChunk(arabicText);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].content).toContain('مرحباً');
    });

    it('should split Arabic sentences correctly', () => {
      const arabicText = 'الجملة الأولى؟ الجملة الثانية! الجملة الثالثة.';
      const chunks = RAGIngestService.smartChunk(arabicText, { chunkSize: 30 });

      expect(chunks.length).toBeGreaterThan(0);
    });
  });
});
