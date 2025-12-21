// ============================================================
// Techniques Service - Epic 4.2
// Manages prompt engineering techniques library
// ============================================================

import { prisma } from '../lib/prisma.js';

// ============================================================
// Types
// ============================================================

export type TechniqueCategory =
  | 'output_structuring'
  | 'role_instruction'
  | 'few_shot_demos'
  | 'evaluation_robustness';

export interface TechniquePatch {
  operations: Array<{
    path: string; // e.g., "system", "developer.prefix", "user.suffix"
    value: string;
    insertPosition?: 'before' | 'after' | 'replace';
  }>;
}

export interface CreateTechniqueInput {
  name: string;
  descriptionShort: string;
  descriptionFull?: string;
  category: TechniqueCategory;
  tags?: string[];
  whenToUse?: string;
  antiPatternExample?: string;
  goodExample?: string;
  applyPatchJson?: TechniquePatch;
  workspaceId?: string;
  createdById?: string;
}

export interface UpdateTechniqueInput {
  name?: string;
  descriptionShort?: string;
  descriptionFull?: string;
  category?: TechniqueCategory;
  tags?: string[];
  whenToUse?: string;
  antiPatternExample?: string;
  goodExample?: string;
  applyPatchJson?: TechniquePatch;
  isActive?: boolean;
}

export interface TechniqueFilters {
  category?: TechniqueCategory;
  tags?: string[];
  isBuiltIn?: boolean;
  isActive?: boolean;
  workspaceId?: string;
  search?: string;
}

// ============================================================
// Techniques Service
// ============================================================

export class TechniquesService {
  /**
   * Get all techniques with optional filters
   */
  async listTechniques(filters: TechniqueFilters = {}) {
    const where: Record<string, unknown> = {};

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.tags && filters.tags.length > 0) {
      where.tags = { hasSome: filters.tags };
    }

    if (filters.isBuiltIn !== undefined) {
      where.isBuiltIn = filters.isBuiltIn;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    } else {
      where.isActive = true; // Default to active only
    }

    // Include workspace techniques or built-in ones
    if (filters.workspaceId) {
      where.OR = [
        { workspaceId: filters.workspaceId },
        { isBuiltIn: true },
      ];
    }

    if (filters.search) {
      where.OR = [
        ...(where.OR as unknown[] || []),
        { name: { contains: filters.search, mode: 'insensitive' } },
        { descriptionShort: { contains: filters.search, mode: 'insensitive' } },
        { tags: { has: filters.search } },
      ];
    }

    const techniques = await prisma.technique.findMany({
      where,
      orderBy: [
        { category: 'asc' },
        { name: 'asc' },
      ],
    });

    return techniques;
  }

  /**
   * Get techniques grouped by category
   */
  async getTechniquesGrouped(workspaceId?: string) {
    const techniques = await this.listTechniques({
      workspaceId,
      isActive: true,
    });

    const grouped: Record<TechniqueCategory, typeof techniques> = {
      output_structuring: [],
      role_instruction: [],
      few_shot_demos: [],
      evaluation_robustness: [],
    };

    for (const technique of techniques) {
      const category = technique.category as TechniqueCategory;
      if (grouped[category]) {
        grouped[category].push(technique);
      }
    }

    return grouped;
  }

  /**
   * Get a single technique by ID
   */
  async getTechniqueById(id: string) {
    return prisma.technique.findUnique({
      where: { id },
    });
  }

  /**
   * Create a new technique
   */
  async createTechnique(input: CreateTechniqueInput) {
    return prisma.technique.create({
      data: {
        name: input.name,
        descriptionShort: input.descriptionShort,
        descriptionFull: input.descriptionFull,
        category: input.category,
        tags: input.tags || [],
        whenToUse: input.whenToUse,
        antiPatternExample: input.antiPatternExample,
        goodExample: input.goodExample,
        applyPatchJson: input.applyPatchJson as unknown as Record<string, unknown>,
        workspaceId: input.workspaceId,
        createdById: input.createdById,
        isBuiltIn: false,
      },
    });
  }

  /**
   * Update an existing technique
   */
  async updateTechnique(id: string, input: UpdateTechniqueInput) {
    // Check if it's a built-in technique
    const existing = await prisma.technique.findUnique({
      where: { id },
    });

    if (existing?.isBuiltIn) {
      throw new Error('Cannot modify built-in techniques');
    }

    const updateData: Record<string, unknown> = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.descriptionShort !== undefined) updateData.descriptionShort = input.descriptionShort;
    if (input.descriptionFull !== undefined) updateData.descriptionFull = input.descriptionFull;
    if (input.category !== undefined) updateData.category = input.category;
    if (input.tags !== undefined) updateData.tags = input.tags;
    if (input.whenToUse !== undefined) updateData.whenToUse = input.whenToUse;
    if (input.antiPatternExample !== undefined) updateData.antiPatternExample = input.antiPatternExample;
    if (input.goodExample !== undefined) updateData.goodExample = input.goodExample;
    if (input.applyPatchJson !== undefined) updateData.applyPatchJson = input.applyPatchJson;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;

    return prisma.technique.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete a technique (soft delete by setting isActive = false)
   */
  async deleteTechnique(id: string) {
    const existing = await prisma.technique.findUnique({
      where: { id },
    });

    if (existing?.isBuiltIn) {
      throw new Error('Cannot delete built-in techniques');
    }

    return prisma.technique.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Apply a technique to a prompt
   */
  applyTechniqueToPrompt(
    prompt: {
      system?: string;
      developer?: string;
      user?: string;
      context?: string;
    },
    technique: { applyPatchJson?: unknown }
  ): typeof prompt {
    if (!technique.applyPatchJson) {
      return prompt;
    }

    const patch = technique.applyPatchJson as TechniquePatch;
    const result = { ...prompt };

    for (const operation of patch.operations) {
      const [section, modifier] = operation.path.split('.');
      const key = section as keyof typeof result;

      if (result[key] === undefined) {
        result[key] = '';
      }

      const currentValue = result[key] || '';
      const insertPosition = operation.insertPosition || 'after';

      if (modifier === 'prefix' || insertPosition === 'before') {
        result[key] = operation.value + '\n\n' + currentValue;
      } else if (modifier === 'suffix' || insertPosition === 'after') {
        result[key] = currentValue + '\n\n' + operation.value;
      } else if (insertPosition === 'replace') {
        result[key] = operation.value;
      }
    }

    return result;
  }

  /**
   * Seed built-in techniques
   */
  async seedBuiltInTechniques() {
    const builtInTechniques: CreateTechniqueInput[] = [
      // ============================================================
      // Category 1: Output Structuring (3 techniques)
      // ============================================================
      {
        name: 'JSON Output Format',
        descriptionShort: 'Force model to output valid JSON with specified schema',
        descriptionFull: 'Instruct the model to format its response as valid JSON conforming to a specific schema. This ensures machine-readable output that can be directly parsed.',
        category: 'output_structuring',
        tags: ['json', 'structured', 'parsing', 'api'],
        whenToUse: 'When you need machine-readable output for downstream processing',
        antiPatternExample: 'Tell me about the weather in a structured way.',
        goodExample: 'Respond ONLY with valid JSON matching this schema: { "temperature": number, "conditions": string, "humidity": number }. No additional text.',
        applyPatchJson: {
          operations: [
            {
              path: 'system.suffix',
              value: 'You MUST respond with valid JSON only. No markdown, no explanation, no additional text. Just the JSON object.',
              insertPosition: 'after',
            },
          ],
        },
      },
      {
        name: 'Markdown Sections',
        descriptionShort: 'Structure output with clear markdown headings',
        descriptionFull: 'Use markdown headings to organize the response into clear, navigable sections. This improves readability and allows for easy extraction of specific parts.',
        category: 'output_structuring',
        tags: ['markdown', 'sections', 'headings', 'organization'],
        whenToUse: 'For long-form content that benefits from clear organization',
        antiPatternExample: 'Write a report about climate change.',
        goodExample: 'Write a report with these sections:\n## Executive Summary\n## Key Findings\n## Recommendations\n## Conclusion',
        applyPatchJson: {
          operations: [
            {
              path: 'developer.suffix',
              value: 'Structure your response with clear markdown headings (##) for each major section. Use bullet points for lists.',
              insertPosition: 'after',
            },
          ],
        },
      },
      {
        name: 'Step-by-Step Numbering',
        descriptionShort: 'Number each step in sequential processes',
        descriptionFull: 'For procedural content, explicitly number each step to ensure clarity and enable easy reference.',
        category: 'output_structuring',
        tags: ['steps', 'numbered', 'process', 'procedure'],
        whenToUse: 'For tutorials, instructions, or any sequential process',
        antiPatternExample: 'Explain how to deploy a web app.',
        goodExample: 'Explain deployment in numbered steps:\n1. First step\n2. Second step\n...',
        applyPatchJson: {
          operations: [
            {
              path: 'developer.suffix',
              value: 'Present your response as numbered steps (1., 2., 3., etc.). Each step should be a single, clear action.',
              insertPosition: 'after',
            },
          ],
        },
      },

      // ============================================================
      // Category 2: Role & Instruction Hygiene (3 techniques)
      // ============================================================
      {
        name: 'Expert Persona',
        descriptionShort: 'Assign specific expert role with credentials',
        descriptionFull: 'Define the model as a specific expert with relevant experience. This primes the model to respond with domain-appropriate knowledge and terminology.',
        category: 'role_instruction',
        tags: ['persona', 'expert', 'role', 'specialist'],
        whenToUse: 'When domain expertise significantly impacts response quality',
        antiPatternExample: 'Help me with my code.',
        goodExample: 'You are a senior software architect with 15 years of experience in distributed systems and microservices. You have worked at major tech companies and led teams through complex migrations.',
        applyPatchJson: {
          operations: [
            {
              path: 'system.prefix',
              value: 'You are an expert specialist with deep knowledge and years of practical experience in the relevant domain.',
              insertPosition: 'before',
            },
          ],
        },
      },
      {
        name: 'Constraint Boundaries',
        descriptionShort: 'Define clear boundaries on what model should NOT do',
        descriptionFull: 'Explicitly state what the model should avoid, refuse, or not include in its response. Negative constraints can be as important as positive instructions.',
        category: 'role_instruction',
        tags: ['constraints', 'boundaries', 'limitations', 'safety'],
        whenToUse: 'When there are specific things the model should avoid',
        antiPatternExample: 'Answer the question about finance.',
        goodExample: 'Answer financial questions but: 1) Never give specific investment advice 2) Always recommend consulting a professional 3) Do not make predictions about specific stocks',
        applyPatchJson: {
          operations: [
            {
              path: 'system.suffix',
              value: '\n\nIMPORTANT CONSTRAINTS:\n- Do NOT make up information if you are unsure\n- Do NOT provide advice outside your expertise\n- Always cite sources or acknowledge uncertainty',
              insertPosition: 'after',
            },
          ],
        },
      },
      {
        name: 'Task Decomposition',
        descriptionShort: 'Break complex task into explicit subtasks',
        descriptionFull: 'For complex tasks, explicitly decompose them into smaller, manageable subtasks. This helps the model approach the problem systematically.',
        category: 'role_instruction',
        tags: ['decomposition', 'subtasks', 'complex', 'systematic'],
        whenToUse: 'For complex tasks that benefit from systematic approach',
        antiPatternExample: 'Analyze this codebase and suggest improvements.',
        goodExample: 'Analyze this code by:\n1. First, identify the main components\n2. Then, evaluate code quality metrics\n3. Next, find potential bugs\n4. Finally, suggest prioritized improvements',
        applyPatchJson: {
          operations: [
            {
              path: 'developer.prefix',
              value: 'Approach this task systematically by breaking it into clear subtasks. Address each subtask thoroughly before moving to the next.',
              insertPosition: 'before',
            },
          ],
        },
      },

      // ============================================================
      // Category 3: Few-Shot & Demonstrations (3 techniques)
      // ============================================================
      {
        name: 'Input-Output Examples',
        descriptionShort: 'Provide explicit input→output example pairs',
        descriptionFull: 'Include concrete examples showing the expected input and corresponding output. This grounds the model\'s understanding of the task.',
        category: 'few_shot_demos',
        tags: ['examples', 'few-shot', 'demonstrations', 'patterns'],
        whenToUse: 'When the expected format or transformation is not obvious',
        antiPatternExample: 'Convert dates to ISO format.',
        goodExample: 'Convert dates to ISO format.\n\nExamples:\nInput: "January 5, 2024" → Output: "2024-01-05"\nInput: "Dec 31, 23" → Output: "2023-12-31"\n\nNow convert: "March 15, 2024"',
        applyPatchJson: {
          operations: [
            {
              path: 'developer.suffix',
              value: '\n\nHere are examples of expected input-output pairs:\n[Add 2-3 specific examples here]\n\nFollow this exact pattern for new inputs.',
              insertPosition: 'after',
            },
          ],
        },
      },
      {
        name: 'Chain-of-Thought Demo',
        descriptionShort: 'Show reasoning process in examples',
        descriptionFull: 'Demonstrate not just the final answer but the complete reasoning process. This helps the model understand how to approach similar problems.',
        category: 'few_shot_demos',
        tags: ['chain-of-thought', 'reasoning', 'explanation', 'thinking'],
        whenToUse: 'For problems requiring multi-step reasoning',
        antiPatternExample: 'Solve: If a train travels 120km in 2 hours, what is its speed?',
        goodExample: 'Solve step-by-step:\n\nExample: "A car travels 150km in 3 hours. Speed?"\nStep 1: Identify given values: distance = 150km, time = 3 hours\nStep 2: Recall formula: speed = distance ÷ time\nStep 3: Calculate: 150 ÷ 3 = 50\nStep 4: Answer: 50 km/h\n\nNow solve: "A train travels 120km in 2 hours. Speed?"',
        applyPatchJson: {
          operations: [
            {
              path: 'developer.suffix',
              value: '\n\nShow your reasoning step-by-step:\nStep 1: [Identify key information]\nStep 2: [Choose approach]\nStep 3: [Execute solution]\nStep 4: [State final answer]',
              insertPosition: 'after',
            },
          ],
        },
      },
      {
        name: 'Contrastive Examples',
        descriptionShort: 'Show both good and bad examples',
        descriptionFull: 'Provide examples of both correct and incorrect outputs, explaining what makes each good or bad. This helps define boundaries clearly.',
        category: 'few_shot_demos',
        tags: ['contrastive', 'good-bad', 'comparison', 'boundaries'],
        whenToUse: 'When subtle distinctions between good and bad outputs matter',
        antiPatternExample: 'Write a professional email.',
        goodExample: 'Write a professional email.\n\n❌ BAD: "Hey! Need that report ASAP!!!"\n(Too casual, demanding, overuse of punctuation)\n\n✓ GOOD: "Hello, I hope this message finds you well. When you have a moment, could you please share the quarterly report? Thank you."\n(Polite, professional, clear request)',
        applyPatchJson: {
          operations: [
            {
              path: 'developer.suffix',
              value: '\n\nHere is what to AVOID:\n❌ [Bad example with explanation]\n\nHere is what to DO:\n✓ [Good example with explanation]',
              insertPosition: 'after',
            },
          ],
        },
      },

      // ============================================================
      // Category 4: Evaluation & Robustness (3 techniques)
      // ============================================================
      {
        name: 'Self-Verification',
        descriptionShort: 'Ask model to verify its own answer',
        descriptionFull: 'Instruct the model to check its answer before finalizing. This catches errors and improves accuracy.',
        category: 'evaluation_robustness',
        tags: ['verification', 'self-check', 'accuracy', 'quality'],
        whenToUse: 'For tasks where accuracy is critical',
        antiPatternExample: 'Calculate the compound interest.',
        goodExample: 'Calculate the compound interest.\n\nAfter computing, verify your answer by:\n1. Checking the formula used\n2. Validating the arithmetic\n3. Confirming the result makes sense\n4. If any errors found, correct and explain',
        applyPatchJson: {
          operations: [
            {
              path: 'developer.suffix',
              value: '\n\nBefore finalizing your response:\n1. Review your answer for accuracy\n2. Check for any logical errors\n3. Verify calculations if applicable\n4. Correct any issues found',
              insertPosition: 'after',
            },
          ],
        },
      },
      {
        name: 'Confidence Scoring',
        descriptionShort: 'Request confidence level with each answer',
        descriptionFull: 'Ask the model to provide a confidence score or level with its response. This helps identify uncertain areas.',
        category: 'evaluation_robustness',
        tags: ['confidence', 'uncertainty', 'calibration', 'reliability'],
        whenToUse: 'When knowing the reliability of the answer matters',
        antiPatternExample: 'What caused the server crash?',
        goodExample: 'Analyze the crash and for each potential cause:\n1. State the cause\n2. Provide confidence level (High/Medium/Low)\n3. Explain what would increase your confidence\n\nFormat: "Cause: [X] | Confidence: [H/M/L] | To verify: [how to confirm]"',
        applyPatchJson: {
          operations: [
            {
              path: 'developer.suffix',
              value: '\n\nFor each claim or conclusion, indicate your confidence:\n- HIGH: Well-established, verified information\n- MEDIUM: Likely correct but some uncertainty\n- LOW: Educated guess, needs verification',
              insertPosition: 'after',
            },
          ],
        },
      },
      {
        name: 'Edge Case Handling',
        descriptionShort: 'Explicitly address edge cases and exceptions',
        descriptionFull: 'Instruct the model to consider and address edge cases, exceptions, and boundary conditions in its response.',
        category: 'evaluation_robustness',
        tags: ['edge-cases', 'exceptions', 'robustness', 'completeness'],
        whenToUse: 'For solutions that need to handle various scenarios',
        antiPatternExample: 'Write a function to divide two numbers.',
        goodExample: 'Write a divide function that handles:\n- Normal case: a ÷ b\n- Edge case: division by zero\n- Edge case: very large numbers\n- Edge case: negative numbers\n\nFor each edge case, explain the handling strategy.',
        applyPatchJson: {
          operations: [
            {
              path: 'developer.suffix',
              value: '\n\nAlso consider and address:\n- Edge cases and boundary conditions\n- Potential exceptions or errors\n- Special scenarios that might break the solution',
              insertPosition: 'after',
            },
          ],
        },
      },
    ];

    // Upsert each technique
    for (const technique of builtInTechniques) {
      await prisma.technique.upsert({
        where: {
          name_workspaceId: {
            name: technique.name,
            workspaceId: technique.workspaceId || '',
          },
        },
        update: {
          descriptionShort: technique.descriptionShort,
          descriptionFull: technique.descriptionFull,
          category: technique.category,
          tags: technique.tags || [],
          whenToUse: technique.whenToUse,
          antiPatternExample: technique.antiPatternExample,
          goodExample: technique.goodExample,
          applyPatchJson: technique.applyPatchJson as unknown as Record<string, unknown>,
          isBuiltIn: true,
          isActive: true,
        },
        create: {
          name: technique.name,
          descriptionShort: technique.descriptionShort,
          descriptionFull: technique.descriptionFull,
          category: technique.category,
          tags: technique.tags || [],
          whenToUse: technique.whenToUse,
          antiPatternExample: technique.antiPatternExample,
          goodExample: technique.goodExample,
          applyPatchJson: technique.applyPatchJson as unknown as Record<string, unknown>,
          workspaceId: null,
          isBuiltIn: true,
          isActive: true,
        },
      });
    }

    return { seeded: builtInTechniques.length };
  }
}

// ============================================================
// Singleton Export
// ============================================================

export const techniquesService = new TechniquesService();
