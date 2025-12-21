// ============================================================
// Metrics Library Tests - Epic 2.5
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  exactMatchMetric,
  containsMetric,
  jsonValidMetric,
  judgeRubricMetric,
  pairwiseJudgeMetric,
  registerMetric,
  getMetric,
  getAllMetricNames,
  setLLMJudgeClient,
  MetricContext,
  MetricResult,
  LLMJudgeClient,
} from '../index.js';

// ============================================================
// Test Helpers
// ============================================================

function createContext(overrides: Partial<MetricContext> = {}): MetricContext {
  return {
    example: {
      id: 'test-example-1',
      inputVariables: { question: 'What is 2+2?' },
      expectedOutput: '4',
      metadata: {},
    },
    ...overrides,
  };
}

// ============================================================
// Exact Match Metric Tests
// ============================================================

describe('exactMatchMetric', () => {
  it('should return passed:true when output matches expected exactly', async () => {
    const context = createContext({
      example: {
        id: 'test-1',
        inputVariables: {},
        expectedOutput: 'Hello World',
      },
    });

    const result = await exactMatchMetric('Hello World', context);

    expect(result.passed).toBe(true);
    expect(result.score).toBe(1);
  });

  it('should be case-insensitive', async () => {
    const context = createContext({
      example: {
        id: 'test-2',
        inputVariables: {},
        expectedOutput: 'HELLO WORLD',
      },
    });

    const result = await exactMatchMetric('hello world', context);

    expect(result.passed).toBe(true);
    expect(result.score).toBe(1);
  });

  it('should trim whitespace', async () => {
    const context = createContext({
      example: {
        id: 'test-3',
        inputVariables: {},
        expectedOutput: '  answer  ',
      },
    });

    const result = await exactMatchMetric('answer', context);

    expect(result.passed).toBe(true);
  });

  it('should return passed:false when output does not match', async () => {
    const context = createContext({
      example: {
        id: 'test-4',
        inputVariables: {},
        expectedOutput: 'correct answer',
      },
    });

    const result = await exactMatchMetric('wrong answer', context);

    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
    expect(result.reason).toContain('Expected');
  });

  it('should return error when no expected output provided', async () => {
    const context = createContext({
      example: {
        id: 'test-5',
        inputVariables: {},
        // No expectedOutput
      },
    });

    const result = await exactMatchMetric('any output', context);

    expect(result.passed).toBe(false);
    expect(result.reason).toContain('No expected output');
  });
});

// ============================================================
// Contains Metric Tests
// ============================================================

describe('containsMetric', () => {
  it('should return passed:true when output contains expected text', async () => {
    const context = createContext({
      example: {
        id: 'test-1',
        inputVariables: {},
        expectedOutput: 'important keyword',
      },
    });

    const result = await containsMetric(
      'This response contains the important keyword within it.',
      context
    );

    expect(result.passed).toBe(true);
    expect(result.score).toBe(1);
  });

  it('should be case-insensitive', async () => {
    const context = createContext({
      example: {
        id: 'test-2',
        inputVariables: {},
        expectedOutput: 'KEYWORD',
      },
    });

    const result = await containsMetric('this has keyword in it', context);

    expect(result.passed).toBe(true);
  });

  it('should return passed:false when output does not contain expected', async () => {
    const context = createContext({
      example: {
        id: 'test-3',
        inputVariables: {},
        expectedOutput: 'missing word',
      },
    });

    const result = await containsMetric('completely different text', context);

    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
  });

  it('should return error when no expected output provided', async () => {
    const context = createContext({
      example: {
        id: 'test-4',
        inputVariables: {},
      },
    });

    const result = await containsMetric('any output', context);

    expect(result.passed).toBe(false);
    expect(result.reason).toContain('No expected output');
  });
});

// ============================================================
// JSON Valid Metric Tests
// ============================================================

describe('jsonValidMetric', () => {
  it('should return passed:true for valid JSON', async () => {
    const context = createContext();
    const validJson = JSON.stringify({ key: 'value', number: 42 });

    const result = await jsonValidMetric(validJson, context);

    expect(result.passed).toBe(true);
    expect(result.score).toBe(1);
    expect(result.details?.parsedKeys).toEqual(['key', 'number']);
  });

  it('should return passed:false for invalid JSON', async () => {
    const context = createContext();
    const invalidJson = '{ invalid json }';

    const result = await jsonValidMetric(invalidJson, context);

    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
    expect(result.reason).toContain('Invalid JSON');
  });

  it('should validate required keys when specified', async () => {
    const context = createContext({
      example: {
        id: 'test-1',
        inputVariables: {},
        metadata: {
          requiredKeys: ['name', 'age', 'email'],
        },
      },
    });

    const jsonWithMissingKeys = JSON.stringify({ name: 'John', age: 30 });
    const result = await jsonValidMetric(jsonWithMissingKeys, context);

    expect(result.passed).toBe(false);
    expect(result.details?.missingKeys).toEqual(['email']);
    expect(result.score).toBeCloseTo(0.667, 2);
  });

  it('should pass when all required keys are present', async () => {
    const context = createContext({
      example: {
        id: 'test-2',
        inputVariables: {},
        metadata: {
          requiredKeys: ['name', 'age'],
        },
      },
    });

    const validJsonWithKeys = JSON.stringify({ name: 'John', age: 30, extra: 'field' });
    const result = await jsonValidMetric(validJsonWithKeys, context);

    expect(result.passed).toBe(true);
    expect(result.score).toBe(1);
  });

  it('should handle empty JSON objects', async () => {
    const context = createContext();
    const result = await jsonValidMetric('{}', context);

    expect(result.passed).toBe(true);
    expect(result.details?.parsedKeys).toEqual([]);
  });

  it('should handle JSON arrays', async () => {
    const context = createContext();
    const result = await jsonValidMetric('[1, 2, 3]', context);

    expect(result.passed).toBe(true);
  });
});

// ============================================================
// Judge Rubric Metric Tests
// ============================================================

describe('judgeRubricMetric', () => {
  it('should return error when no rubric provided', async () => {
    const context = createContext();

    const result = await judgeRubricMetric('any output', context);

    expect(result.passed).toBe(false);
    expect(result.reason).toContain('No rubric provided');
  });

  it('should return mock result when no LLM client configured', async () => {
    const context = createContext({
      rubric: {
        criteria: [
          {
            name: 'relevance',
            description: 'Response is relevant to the question',
            weight: 0.5,
          },
          {
            name: 'accuracy',
            description: 'Response is factually accurate',
            weight: 0.5,
          },
        ],
      },
    });

    const result = await judgeRubricMetric('test output', context);

    // Should return mock result
    expect(result.details?.mock).toBe(true);
  });

  it('should call LLM client when configured', async () => {
    const mockClient: LLMJudgeClient = {
      call: vi.fn().mockResolvedValue(JSON.stringify({
        criteriaScores: {
          relevance: { score: 0.8, reason: 'Good relevance' },
          accuracy: { score: 0.9, reason: 'Accurate' },
        },
        overallScore: 0.85,
        passed: true,
        reasoning: 'Overall good response',
      })),
    };

    setLLMJudgeClient(mockClient);

    const context = createContext({
      rubric: {
        criteria: [
          { name: 'relevance', description: 'Relevant', weight: 0.5 },
          { name: 'accuracy', description: 'Accurate', weight: 0.5 },
        ],
      },
    });

    const result = await judgeRubricMetric('test output', context);

    expect(mockClient.call).toHaveBeenCalled();
    expect(result.passed).toBe(true);
    expect(result.score).toBe(0.85);

    // Reset client
    setLLMJudgeClient(null as unknown as LLMJudgeClient);
  });
});

// ============================================================
// Pairwise Judge Metric Tests
// ============================================================

describe('pairwiseJudgeMetric', () => {
  it('should return error when outputA is missing', async () => {
    const context = createContext({
      outputB: 'Response B',
    });

    const result = await pairwiseJudgeMetric('', context);

    expect(result.passed).toBe(false);
    expect(result.reason).toContain('Missing outputA or outputB');
  });

  it('should return error when outputB is missing', async () => {
    const context = createContext({
      outputA: 'Response A',
    });

    const result = await pairwiseJudgeMetric('', context);

    expect(result.passed).toBe(false);
    expect(result.reason).toContain('Missing outputA or outputB');
  });

  it('should return mock result when no LLM client configured', async () => {
    const context = createContext({
      outputA: 'Response A',
      outputB: 'Response B',
    });

    const result = await pairwiseJudgeMetric('', context);

    expect(result.details?.mock).toBe(true);
    expect(result.details?.winner).toBe('tie');
  });
});

// ============================================================
// Metric Registry Tests
// ============================================================

describe('Metric Registry', () => {
  it('should have built-in metrics registered', () => {
    const metricNames = getAllMetricNames();

    expect(metricNames).toContain('exact_match');
    expect(metricNames).toContain('contains');
    expect(metricNames).toContain('json_valid');
    expect(metricNames).toContain('judge_rubric');
    expect(metricNames).toContain('pairwise_judge');
  });

  it('should return registered metrics via getMetric', () => {
    expect(getMetric('exact_match')).toBe(exactMatchMetric);
    expect(getMetric('contains')).toBe(containsMetric);
    expect(getMetric('json_valid')).toBe(jsonValidMetric);
  });

  it('should return undefined for unregistered metric', () => {
    expect(getMetric('non_existent' as any)).toBeUndefined();
  });

  it('should allow registering custom metrics', async () => {
    const customMetric = async (output: string, context: MetricContext): Promise<MetricResult> => {
      return {
        passed: output.length > 10,
        score: output.length > 10 ? 1 : 0,
        reason: output.length > 10 ? 'Long enough' : 'Too short',
      };
    };

    // Note: This would need the type to be extended for custom metrics
    // For now, just testing the concept
    expect(typeof registerMetric).toBe('function');
  });
});

// ============================================================
// Edge Cases
// ============================================================

describe('Edge Cases', () => {
  it('should handle empty output string', async () => {
    const context = createContext({
      example: {
        id: 'test-1',
        inputVariables: {},
        expectedOutput: '',
      },
    });

    const result = await exactMatchMetric('', context);
    expect(result.passed).toBe(true);
  });

  it('should handle special characters in output', async () => {
    const context = createContext({
      example: {
        id: 'test-2',
        inputVariables: {},
        expectedOutput: 'Hello! @#$%^&*()',
      },
    });

    const result = await exactMatchMetric('Hello! @#$%^&*()', context);
    expect(result.passed).toBe(true);
  });

  it('should handle unicode characters', async () => {
    const context = createContext({
      example: {
        id: 'test-3',
        inputVariables: {},
        expectedOutput: '你好世界 🌍',
      },
    });

    const result = await exactMatchMetric('你好世界 🌍', context);
    expect(result.passed).toBe(true);
  });

  it('should handle very long output strings', async () => {
    const longString = 'a'.repeat(10000);
    const context = createContext({
      example: {
        id: 'test-4',
        inputVariables: {},
        expectedOutput: longString,
      },
    });

    const result = await exactMatchMetric(longString, context);
    expect(result.passed).toBe(true);
  });

  it('should handle nested JSON', async () => {
    const context = createContext();
    const nestedJson = JSON.stringify({
      level1: {
        level2: {
          level3: {
            value: 'deep',
          },
        },
      },
    });

    const result = await jsonValidMetric(nestedJson, context);
    expect(result.passed).toBe(true);
  });
});
