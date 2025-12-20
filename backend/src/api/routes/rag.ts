import { Router, Request, Response } from 'express';
import { RAGService } from '../../services/RAGService';
import { adaptiveRAGService } from '../../services/AdaptiveRAGService';

const router = Router();

// Create knowledge base
router.post('/knowledge-bases', async (req: Request, res: Response) => {
  try {
    const { name, description, domain, embeddingModel, chunkSize, chunkOverlap } = req.body;

    const knowledgeBase = await RAGService.createKnowledgeBase({
      name,
      description,
      domain,
      embeddingModel,
      chunkSize,
      chunkOverlap,
    });

    res.json(knowledgeBase);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create knowledge base' });
  }
});

// Add documents to knowledge base
router.post('/knowledge-bases/:id/documents', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { documents } = req.body;

    const addedDocs = await RAGService.addToKnowledgeBase(id, documents);

    res.json({ count: addedDocs.length, documents: addedDocs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add documents' });
  }
});

// Retrieve context for query
router.post('/knowledge-bases/:id/retrieve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { query, topK, minRelevance, minTrust } = req.body;

    const context = await RAGService.retrieveContext(id, query, {
      topK,
      minRelevance,
      minTrust,
    });

    res.json(context);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve context' });
  }
});

// Build RAG-enhanced prompt
router.post('/build-prompt', async (req: Request, res: Response) => {
  try {
    const { originalPrompt, knowledgeBaseId, query, options } = req.body;

    const context = await RAGService.retrieveContext(knowledgeBaseId, query, options);
    const ragPrompt = RAGService.buildRAGPrompt(originalPrompt, context, options);

    res.json({ ragPrompt, context });
  } catch (error) {
    res.status(500).json({ error: 'Failed to build RAG prompt' });
  }
});

// Update trust scores
router.post('/knowledge-bases/:id/trust-scores', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { feedback } = req.body;

    await RAGService.updateTrustScores(id, feedback);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update trust scores' });
  }
});

// Chunk text
router.post('/chunk', async (req: Request, res: Response) => {
  try {
    const { text, chunkSize, overlap } = req.body;

    const chunks = RAGService.chunkText(text, { chunkSize, overlap });

    res.json({ chunks, count: chunks.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to chunk text' });
  }
});

// ==================== Adaptive RAG Endpoints ====================

/**
 * Retrieve adaptive context with dynamic context packing
 * استرجاع سياق تكيفي مع حزم سياق ديناميكية
 */
router.post('/adaptive/retrieve', async (req: Request, res: Response) => {
  try {
    const {
      knowledgeBaseId,
      query,
      maxChunks = 5,
      minRelevance = 0.7,
      minTrust = 0.5,
      enableSummarization = true,
      maxContextLength = 4000,
      includeSourceTrace = true,
    } = req.body;

    if (!knowledgeBaseId || !query) {
      return res.status(400).json({
        error: 'knowledgeBaseId and query are required',
      });
    }

    const result = await adaptiveRAGService.retrieveAdaptiveContext(
      knowledgeBaseId,
      query,
      {
        maxChunks,
        minRelevance,
        minTrust,
        enableSummarization,
        maxContextLength,
        includeSourceTrace,
      }
    );

    res.json(result);
  } catch (error) {
    console.error('Adaptive RAG retrieval error:', error);
    res.status(500).json({
      error: 'Failed to retrieve adaptive context',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Build context mask for trusted sources
 * بناء ماسك سياق للمصادر الموثوقة
 */
router.post('/adaptive/context-mask', async (req: Request, res: Response) => {
  try {
    const {
      knowledgeBaseId,
      trustThreshold = 0.5,
      verifiedOnly = false,
      allowedDomains = [],
      blockedDomains = [],
    } = req.body;

    if (!knowledgeBaseId) {
      return res.status(400).json({ error: 'knowledgeBaseId is required' });
    }

    const contextMask = await adaptiveRAGService.buildContextMask(
      knowledgeBaseId,
      {
        trustThreshold,
        verifiedOnly,
        allowedDomains,
        blockedDomains,
      }
    );

    res.json(contextMask);
  } catch (error) {
    console.error('Context mask error:', error);
    res.status(500).json({ error: 'Failed to build context mask' });
  }
});

/**
 * Get RAG session history
 * الحصول على سجل جلسة RAG
 */
router.get('/adaptive/sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const session = await adaptiveRAGService.getSessionHistory(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(session);
  } catch (error) {
    console.error('Session history error:', error);
    res.status(500).json({ error: 'Failed to retrieve session history' });
  }
});

/**
 * Register a trusted source
 * تسجيل مصدر موثوق
 */
router.post('/adaptive/trusted-sources', async (req: Request, res: Response) => {
  try {
    const {
      name,
      domain,
      url,
      sourceType = 'document',
      baseTrustScore = 0.8,
      autoVerify = false,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const trustedSource = await adaptiveRAGService.registerTrustedSource({
      name,
      domain,
      url,
      sourceType,
      baseTrustScore,
      autoVerify,
    });

    res.json(trustedSource);
  } catch (error) {
    console.error('Register trusted source error:', error);
    res.status(500).json({
      error: 'Failed to register trusted source',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Summarize chunks with confidence indicators
 * تلخيص المقتطفات مع مؤشرات الثقة
 */
router.post('/adaptive/summarize', async (req: Request, res: Response) => {
  try {
    const { chunks, query } = req.body;

    if (!chunks || !Array.isArray(chunks) || chunks.length === 0) {
      return res.status(400).json({ error: 'chunks array is required' });
    }

    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }

    const enrichedChunks = await adaptiveRAGService.summarizeChunks(chunks, query);

    res.json({
      enrichedChunks,
      count: enrichedChunks.length,
      avgConfidence: enrichedChunks.reduce((sum, c) => sum + c.confidenceScore, 0) / enrichedChunks.length,
    });
  } catch (error) {
    console.error('Summarize chunks error:', error);
    res.status(500).json({ error: 'Failed to summarize chunks' });
  }
});

export default router;
