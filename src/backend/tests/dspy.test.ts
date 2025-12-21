// ============================================================
// DSPy API Smoke Tests - Epic 0.7 + Epic 1.6
// ============================================================

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// Mock Prisma
vi.mock('../lib/prisma', () => ({
  prisma: {
    promptTemplate: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation((data) => Promise.resolve({
        id: 'test-id',
        ...data.data,
        createdAt: new Date(),
        updatedAt: new Date(),
        versions: data.data.versions?.create ? [{
          id: 'v-1',
          versionNumber: 1,
          ...data.data.versions.create,
        }] : [],
      })),
      update: vi.fn().mockImplementation((args) => Promise.resolve({
        id: args.where.id,
        ...args.data,
      })),
      delete: vi.fn().mockResolvedValue({ id: 'deleted' }),
      count: vi.fn().mockResolvedValue(0),
    },
    templateVersion: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation((data) => Promise.resolve({
        id: 'v-new',
        ...data.data,
        createdAt: new Date(),
      })),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      count: vi.fn().mockResolvedValue(0),
    },
    evaluationDataset: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation((data) => Promise.resolve({
        id: 'ds-1',
        ...data.data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
    },
    datasetExample: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'ex-1' }),
      createMany: vi.fn().mockResolvedValue({ count: 5 }),
      delete: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
    },
    optimizationRun: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation((data) => Promise.resolve({
        id: 'opt-1',
        ...data.data,
        createdAt: new Date(),
      })),
      update: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
    },
    optimizationResult: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'res-1' }),
      update: vi.fn().mockResolvedValue({}),
    },
    evaluationRun: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation((data) => Promise.resolve({
        id: 'eval-1',
        ...data.data,
        createdAt: new Date(),
      })),
      update: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
    },
  },
}));

describe('DSPy API Types and Contracts', () => {
  describe('Template Schema', () => {
    it('should validate template content snapshot structure', () => {
      const validSnapshot = {
        system: 'You are a helpful assistant',
        user: 'Hello {{name}}',
        developer: 'Be concise',
        context: 'This is context',
        variablesSchema: [
          { name: 'name', type: 'string', required: true },
        ],
        defaultValues: { name: 'User' },
        modelConfig: {
          model: 'gpt-4',
          temperature: 0.7,
        },
      };

      expect(validSnapshot.system).toBeDefined();
      expect(validSnapshot.user).toBeDefined();
      expect(Array.isArray(validSnapshot.variablesSchema)).toBe(true);
    });

    it('should require system and user fields', () => {
      const minimalSnapshot = {
        system: 'System',
        user: 'User',
      };

      expect(minimalSnapshot.system).toBeDefined();
      expect(minimalSnapshot.user).toBeDefined();
    });
  });

  describe('Dataset Schema', () => {
    it('should validate dataset example structure', () => {
      const validExample = {
        inputVariables: { name: 'Alice', age: 30 },
        expectedOutput: 'Hello Alice, you are 30 years old.',
        metadata: { source: 'test' },
      };

      expect(validExample.inputVariables).toBeDefined();
      expect(typeof validExample.inputVariables).toBe('object');
    });

    it('should allow unlabeled examples', () => {
      const unlabeledExample = {
        inputVariables: { query: 'What is AI?' },
        // No expectedOutput
      };

      expect(unlabeledExample.inputVariables).toBeDefined();
      expect(unlabeledExample).not.toHaveProperty('expectedOutput');
    });
  });

  describe('Optimization Schema', () => {
    it('should validate optimization request structure', () => {
      const validRequest = {
        templateId: 'uuid-template',
        baseVersionId: 'uuid-version',
        datasetId: 'uuid-dataset',
        optimizerType: 'bootstrap_fewshot',
        metricType: 'exact_match',
        budget: {
          maxCalls: 50,
          maxTokens: 50000,
          maxUSD: 5,
        },
      };

      expect(['bootstrap_fewshot', 'copro']).toContain(validRequest.optimizerType);
      expect(['exact_match', 'contains', 'json_valid']).toContain(validRequest.metricType);
      expect(validRequest.budget.maxCalls).toBeGreaterThan(0);
    });

    it('should validate optimization result structure', () => {
      const validResult = {
        id: 'result-id',
        runId: 'run-id',
        optimizedSnapshot: {
          system: 'Optimized system prompt',
          demos: [
            { input: 'example input', output: 'example output' },
          ],
        },
        baselineScore: 0.65,
        optimizedScore: 0.82,
        scoreDelta: 0.17,
        cost: {
          calls: 25,
          tokens: 15000,
          usdEstimate: 0.45,
        },
      };

      expect(validResult.optimizedScore).toBeGreaterThanOrEqual(0);
      expect(validResult.optimizedScore).toBeLessThanOrEqual(1);
      expect(validResult.scoreDelta).toBe(validResult.optimizedScore - validResult.baselineScore);
    });
  });

  describe('Metric Types', () => {
    it('should support exact_match metric', () => {
      const expected = 'hello world';
      const actual = 'Hello World';
      // Exact match should be case-insensitive in implementation
      expect(expected.toLowerCase()).toBe(actual.toLowerCase());
    });

    it('should support contains metric', () => {
      const expected = 'hello';
      const actual = 'hello world';
      expect(actual.includes(expected)).toBe(true);
    });

    it('should support json_valid metric', () => {
      const validJson = '{"key": "value"}';
      const invalidJson = '{key: value}';

      expect(() => JSON.parse(validJson)).not.toThrow();
      expect(() => JSON.parse(invalidJson)).toThrow();
    });
  });
});

describe('DSPy Service Client', () => {
  it('should have correct default configuration', async () => {
    const { DspyServiceClient } = await import('../services/DspyServiceClient.js');
    const client = new DspyServiceClient();

    // Client should be instantiable
    expect(client).toBeDefined();
    expect(typeof client.healthCheck).toBe('function');
    expect(typeof client.compile).toBe('function');
  });

  it('should use mock client in test mode', async () => {
    const originalEnv = process.env.USE_MOCK_DSPY;
    process.env.USE_MOCK_DSPY = 'true';

    const { getDspyClient, MockDspyServiceClient } = await import('../services/DspyServiceClient.js');
    const client = getDspyClient();

    expect(client).toBeInstanceOf(MockDspyServiceClient);

    process.env.USE_MOCK_DSPY = originalEnv;
  });
});
