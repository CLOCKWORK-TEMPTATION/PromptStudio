// ============================================================
// Tests for Prompt Renderer Utility - Epic 0.7
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  extractVariables,
  replaceVariables,
  renderPromptParts,
  validateVariables,
  getAllVariablesFromSnapshot,
  parseContentSnapshot,
  createContentSnapshot,
} from './promptRenderer';
import type { TemplateContentSnapshot } from '../types/dspy';

describe('promptRenderer', () => {
  describe('extractVariables', () => {
    it('should extract simple variables', () => {
      const text = 'Hello {{name}}, welcome to {{location}}!';
      const vars = extractVariables(text);
      expect(vars).toEqual(['name', 'location']);
    });

    it('should handle text without variables', () => {
      const text = 'No variables here';
      const vars = extractVariables(text);
      expect(vars).toEqual([]);
    });

    it('should extract unique variables only', () => {
      const text = '{{name}} said hello to {{name}}';
      const vars = extractVariables(text);
      expect(vars).toEqual(['name']);
    });

    it('should handle nested braces correctly', () => {
      const text = '{{ {{invalid}} }} but {{valid}}';
      const vars = extractVariables(text);
      expect(vars).toContain('valid');
    });
  });

  describe('replaceVariables', () => {
    it('should replace variables with values', () => {
      const text = 'Hello {{name}}!';
      const result = replaceVariables(text, { name: 'Alice' });
      expect(result).toBe('Hello Alice!');
    });

    it('should replace missing variables with empty string by default', () => {
      const text = 'Hello {{name}}!';
      const result = replaceVariables(text, {});
      expect(result).toBe('Hello !');
    });

    it('should use custom default value', () => {
      const text = 'Hello {{name}}!';
      const result = replaceVariables(text, {}, { defaultValue: 'Unknown' });
      expect(result).toBe('Hello Unknown!');
    });

    it('should throw on missing variable when configured', () => {
      const text = 'Hello {{name}}!';
      expect(() => {
        replaceVariables(text, {}, { throwOnMissingVariable: true });
      }).toThrow('Missing required variable: name');
    });

    it('should stringify object values', () => {
      const text = 'Data: {{obj}}';
      const result = replaceVariables(text, { obj: { key: 'value' } });
      expect(result).toContain('"key"');
      expect(result).toContain('"value"');
    });

    it('should handle null and undefined values', () => {
      const text = '{{a}} and {{b}}';
      const result = replaceVariables(text, { a: null, b: undefined });
      expect(result).toBe(' and ');
    });
  });

  describe('renderPromptParts', () => {
    const snapshot: TemplateContentSnapshot = {
      system: 'You are {{role}}',
      developer: 'Handle {{task}}',
      user: 'Hello {{name}}',
      context: 'Context: {{context}}',
      defaultValues: { role: 'assistant' },
    };

    it('should render all parts with variables', () => {
      const result = renderPromptParts(snapshot, {
        name: 'Alice',
        task: 'support',
        context: 'demo',
      });

      expect(result.system).toBe('You are assistant');
      expect(result.developer).toBe('Handle support');
      expect(result.user).toBe('Hello Alice');
      expect(result.context).toBe('Context: demo');
    });

    it('should merge default values with provided variables', () => {
      const result = renderPromptParts(snapshot, { name: 'Bob' });
      expect(result.system).toBe('You are assistant');
      expect(result.user).toBe('Hello Bob');
    });

    it('should generate merged preview', () => {
      const result = renderPromptParts(snapshot, { name: 'Alice' });
      expect(result.mergedPreview).toContain('[SYSTEM]');
      expect(result.mergedPreview).toContain('[USER]');
    });

    it('should handle snapshot without optional fields', () => {
      const minimalSnapshot: TemplateContentSnapshot = {
        system: 'System',
        user: 'User',
      };
      const result = renderPromptParts(minimalSnapshot, {});
      expect(result.system).toBe('System');
      expect(result.user).toBe('User');
      expect(result.developer).toBeUndefined();
      expect(result.context).toBeUndefined();
    });
  });

  describe('validateVariables', () => {
    it('should return valid when all variables present', () => {
      const text = 'Hello {{name}}';
      const result = validateVariables(text, { name: 'Alice' });
      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('should return missing variables', () => {
      const text = 'Hello {{name}}, from {{location}}';
      const result = validateVariables(text, { name: 'Alice' });
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('location');
    });

    it('should check only required vars when specified', () => {
      const text = 'Hello {{name}}, from {{location}}';
      const result = validateVariables(text, { name: 'Alice' }, ['name']);
      expect(result.valid).toBe(true);
    });

    it('should treat empty string as missing', () => {
      const text = 'Hello {{name}}';
      const result = validateVariables(text, { name: '' });
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('name');
    });
  });

  describe('getAllVariablesFromSnapshot', () => {
    it('should extract variables from all parts', () => {
      const snapshot: TemplateContentSnapshot = {
        system: '{{a}}',
        developer: '{{b}}',
        user: '{{c}}',
        context: '{{d}}',
      };
      const vars = getAllVariablesFromSnapshot(snapshot);
      expect(vars.sort()).toEqual(['a', 'b', 'c', 'd']);
    });

    it('should handle undefined optional fields', () => {
      const snapshot: TemplateContentSnapshot = {
        system: '{{a}}',
        user: '{{b}}',
      };
      const vars = getAllVariablesFromSnapshot(snapshot);
      expect(vars.sort()).toEqual(['a', 'b']);
    });
  });

  describe('parseContentSnapshot', () => {
    it('should parse valid JSON', () => {
      const json = {
        system: 'System prompt',
        user: 'User prompt',
        developer: 'Dev prompt',
      };
      const result = parseContentSnapshot(json);
      expect(result.system).toBe('System prompt');
      expect(result.user).toBe('User prompt');
      expect(result.developer).toBe('Dev prompt');
    });

    it('should throw on invalid input', () => {
      expect(() => parseContentSnapshot(null)).toThrow();
      expect(() => parseContentSnapshot('string')).toThrow();
    });

    it('should handle missing optional fields', () => {
      const json = { system: 'S', user: 'U' };
      const result = parseContentSnapshot(json);
      expect(result.developer).toBeUndefined();
      expect(result.context).toBeUndefined();
    });
  });

  describe('createContentSnapshot', () => {
    it('should create snapshot from parts', () => {
      const result = createContentSnapshot({
        system: 'System',
        user: 'User',
      });
      expect(result.system).toBe('System');
      expect(result.user).toBe('User');
    });

    it('should include options when provided', () => {
      const result = createContentSnapshot(
        { system: 'S', user: 'U' },
        {
          defaultValues: { name: 'test' },
          modelConfig: { model: 'gpt-4' },
        }
      );
      expect(result.defaultValues).toEqual({ name: 'test' });
      expect(result.modelConfig?.model).toBe('gpt-4');
    });
  });
});
