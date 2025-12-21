// ============================================================
// Techniques Service Tests - Epic 4.5
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TechniquesService, TechniqueCategory, TechniquePatch } from '../TechniquesService.js';

// Mock prisma
vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    technique: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

import { prisma } from '../../lib/prisma.js';

// ============================================================
// Test Fixtures
// ============================================================

const mockTechnique = {
  id: 'tech-1',
  name: 'JSON Output Format',
  descriptionShort: 'Force model to output valid JSON',
  descriptionFull: 'Full description...',
  category: 'output_structuring',
  tags: ['json', 'structured'],
  whenToUse: 'When you need machine-readable output',
  antiPatternExample: 'Bad example',
  goodExample: 'Good example',
  applyPatchJson: {
    operations: [
      {
        path: 'system.suffix',
        value: 'Respond with valid JSON only.',
        insertPosition: 'after',
      },
    ],
  },
  workspaceId: null,
  createdById: null,
  isBuiltIn: true,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ============================================================
// Tests
// ============================================================

describe('TechniquesService', () => {
  let service: TechniquesService;

  beforeEach(() => {
    service = new TechniquesService();
    vi.clearAllMocks();
  });

  describe('listTechniques', () => {
    it('should list all active techniques by default', async () => {
      vi.mocked(prisma.technique.findMany).mockResolvedValue([mockTechnique]);

      const result = await service.listTechniques();

      expect(prisma.technique.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        })
      );
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('JSON Output Format');
    });

    it('should filter by category', async () => {
      vi.mocked(prisma.technique.findMany).mockResolvedValue([mockTechnique]);

      await service.listTechniques({ category: 'output_structuring' });

      expect(prisma.technique.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: 'output_structuring' }),
        })
      );
    });

    it('should filter by tags', async () => {
      vi.mocked(prisma.technique.findMany).mockResolvedValue([mockTechnique]);

      await service.listTechniques({ tags: ['json'] });

      expect(prisma.technique.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tags: { hasSome: ['json'] } }),
        })
      );
    });

    it('should include workspace and built-in techniques', async () => {
      vi.mocked(prisma.technique.findMany).mockResolvedValue([mockTechnique]);

      await service.listTechniques({ workspaceId: 'ws-123' });

      expect(prisma.technique.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { workspaceId: 'ws-123' },
              { isBuiltIn: true },
            ]),
          }),
        })
      );
    });
  });

  describe('getTechniquesGrouped', () => {
    it('should group techniques by category', async () => {
      const techniques = [
        { ...mockTechnique, category: 'output_structuring' },
        { ...mockTechnique, id: 'tech-2', category: 'role_instruction' },
        { ...mockTechnique, id: 'tech-3', category: 'few_shot_demos' },
      ];

      vi.mocked(prisma.technique.findMany).mockResolvedValue(techniques);

      const result = await service.getTechniquesGrouped();

      expect(result.output_structuring).toHaveLength(1);
      expect(result.role_instruction).toHaveLength(1);
      expect(result.few_shot_demos).toHaveLength(1);
      expect(result.evaluation_robustness).toHaveLength(0);
    });
  });

  describe('getTechniqueById', () => {
    it('should return technique by ID', async () => {
      vi.mocked(prisma.technique.findUnique).mockResolvedValue(mockTechnique);

      const result = await service.getTechniqueById('tech-1');

      expect(prisma.technique.findUnique).toHaveBeenCalledWith({
        where: { id: 'tech-1' },
      });
      expect(result).toEqual(mockTechnique);
    });

    it('should return null for non-existent ID', async () => {
      vi.mocked(prisma.technique.findUnique).mockResolvedValue(null);

      const result = await service.getTechniqueById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('createTechnique', () => {
    it('should create a new technique', async () => {
      const input = {
        name: 'New Technique',
        descriptionShort: 'Short description',
        category: 'output_structuring' as TechniqueCategory,
      };

      vi.mocked(prisma.technique.create).mockResolvedValue({
        ...mockTechnique,
        ...input,
        isBuiltIn: false,
      });

      const result = await service.createTechnique(input);

      expect(prisma.technique.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'New Technique',
          isBuiltIn: false,
        }),
      });
      expect(result.name).toBe('New Technique');
    });
  });

  describe('updateTechnique', () => {
    it('should update a custom technique', async () => {
      const customTechnique = { ...mockTechnique, isBuiltIn: false };
      vi.mocked(prisma.technique.findUnique).mockResolvedValue(customTechnique);
      vi.mocked(prisma.technique.update).mockResolvedValue({
        ...customTechnique,
        name: 'Updated Name',
      });

      const result = await service.updateTechnique('tech-1', { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
    });

    it('should throw error for built-in techniques', async () => {
      vi.mocked(prisma.technique.findUnique).mockResolvedValue(mockTechnique);

      await expect(
        service.updateTechnique('tech-1', { name: 'New Name' })
      ).rejects.toThrow('Cannot modify built-in techniques');
    });
  });

  describe('deleteTechnique', () => {
    it('should soft-delete a custom technique', async () => {
      const customTechnique = { ...mockTechnique, isBuiltIn: false };
      vi.mocked(prisma.technique.findUnique).mockResolvedValue(customTechnique);
      vi.mocked(prisma.technique.update).mockResolvedValue({
        ...customTechnique,
        isActive: false,
      });

      const result = await service.deleteTechnique('tech-1');

      expect(prisma.technique.update).toHaveBeenCalledWith({
        where: { id: 'tech-1' },
        data: { isActive: false },
      });
    });

    it('should throw error for built-in techniques', async () => {
      vi.mocked(prisma.technique.findUnique).mockResolvedValue(mockTechnique);

      await expect(service.deleteTechnique('tech-1')).rejects.toThrow(
        'Cannot delete built-in techniques'
      );
    });
  });

  describe('applyTechniqueToPrompt', () => {
    it('should apply patch to prompt', () => {
      const prompt = {
        system: 'You are an assistant.',
        developer: 'Help users.',
        user: 'Question?',
      };

      const technique = {
        applyPatchJson: {
          operations: [
            {
              path: 'system.suffix',
              value: '\n\nAlways respond in JSON.',
              insertPosition: 'after',
            },
          ],
        },
      };

      const result = service.applyTechniqueToPrompt(prompt, technique);

      expect(result.system).toContain('Always respond in JSON');
      expect(result.system).toContain('You are an assistant');
    });

    it('should apply prefix insertions', () => {
      const prompt = {
        system: 'Base instructions.',
      };

      const technique = {
        applyPatchJson: {
          operations: [
            {
              path: 'system',
              value: 'IMPORTANT: ',
              insertPosition: 'before',
            },
          ],
        },
      };

      const result = service.applyTechniqueToPrompt(prompt, technique);

      expect(result.system).toStartWith('IMPORTANT:');
    });

    it('should apply replacement', () => {
      const prompt = {
        system: 'Old content.',
      };

      const technique = {
        applyPatchJson: {
          operations: [
            {
              path: 'system',
              value: 'New content.',
              insertPosition: 'replace',
            },
          ],
        },
      };

      const result = service.applyTechniqueToPrompt(prompt, technique);

      expect(result.system).toBe('New content.');
    });

    it('should handle missing sections', () => {
      const prompt = {
        user: 'Question?',
      };

      const technique = {
        applyPatchJson: {
          operations: [
            {
              path: 'system',
              value: 'New system prompt.',
              insertPosition: 'after',
            },
          ],
        },
      };

      const result = service.applyTechniqueToPrompt(prompt, technique);

      expect(result.system).toContain('New system prompt');
    });

    it('should return unchanged prompt if no patch', () => {
      const prompt = {
        system: 'Test',
      };

      const technique = {};

      const result = service.applyTechniqueToPrompt(prompt, technique);

      expect(result.system).toBe('Test');
    });
  });

  describe('seedBuiltInTechniques', () => {
    it('should seed all 12 built-in techniques', async () => {
      vi.mocked(prisma.technique.upsert).mockResolvedValue(mockTechnique);

      const result = await service.seedBuiltInTechniques();

      expect(result.seeded).toBe(12);
      expect(prisma.technique.upsert).toHaveBeenCalledTimes(12);
    });

    it('should mark techniques as built-in', async () => {
      vi.mocked(prisma.technique.upsert).mockResolvedValue(mockTechnique);

      await service.seedBuiltInTechniques();

      expect(prisma.technique.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ isBuiltIn: true }),
          update: expect.objectContaining({ isBuiltIn: true }),
        })
      );
    });
  });
});
