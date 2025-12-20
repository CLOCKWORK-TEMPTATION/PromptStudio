import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { RAGIngestService } from '../../services/RAGIngestService.js';

const router = Router();

// Validation Schemas
const IngestDocumentSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(10),
  source: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  trustScore: z.number().min(0).max(1).optional(),
  metadata: z.record(z.any()).optional(),
});

const IngestOptionsSchema = z.object({
  preprocessing: z.object({
    removeExtraWhitespace: z.boolean().optional(),
    normalizeUnicode: z.boolean().optional(),
    removeHtmlTags: z.boolean().optional(),
    lowercase: z.boolean().optional(),
    removeUrls: z.boolean().optional(),
    removeEmails: z.boolean().optional(),
  }).optional(),
  chunking: z.object({
    chunkSize: z.number().min(100).max(5000).optional(),
    overlap: z.number().min(0).max(1000).optional(),
    respectSentences: z.boolean().optional(),
    respectParagraphs: z.boolean().optional(),
  }).optional(),
  skipDuplicates: z.boolean().optional(),
});

const RetrieveCriteriaSchema = z.object({
  query: z.string().min(1),
  minRelevance: z.number().min(0).max(1).optional(),
  minTrust: z.number().min(0).max(1).optional(),
  maxChunks: z.number().min(1).max(50).optional(),
  verifiedOnly: z.boolean().optional(),
  weightRelevance: z.number().min(0).max(1).optional(),
  weightTrust: z.number().min(0).max(1).optional(),
  includeMetadata: z.boolean().optional(),
});

/**
 * إدخال مستند واحد
 * POST /api/rag-ingest/:knowledgeBaseId/document
 */
router.post('/:knowledgeBaseId/document', async (req: Request, res: Response) => {
  try {
    const { knowledgeBaseId } = req.params;
    const documentData = IngestDocumentSchema.parse(req.body.document);
    const options = IngestOptionsSchema.parse(req.body.options || {});

    const result = await RAGIngestService.ingestDocument(
      knowledgeBaseId,
      documentData,
      options
    );

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }
    console.error('Ingest document error:', error);
    res.status(500).json({
      error: 'Failed to ingest document',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * إدخال عدة مستندات دفعة واحدة
 * POST /api/rag-ingest/:knowledgeBaseId/batch
 */
router.post('/:knowledgeBaseId/batch', async (req: Request, res: Response) => {
  try {
    const { knowledgeBaseId } = req.params;
    const documents = z.array(IngestDocumentSchema).parse(req.body.documents);
    const options = IngestOptionsSchema.extend({
      concurrency: z.number().min(1).max(10).optional(),
    }).parse(req.body.options || {});

    const result = await RAGIngestService.batchIngest(
      knowledgeBaseId,
      documents,
      options
    );

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }
    console.error('Batch ingest error:', error);
    res.status(500).json({
      error: 'Failed to batch ingest documents',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * استرجاع مع معايير trust/relevance
 * POST /api/rag-ingest/:knowledgeBaseId/retrieve
 */
router.post('/:knowledgeBaseId/retrieve', async (req: Request, res: Response) => {
  try {
    const { knowledgeBaseId } = req.params;
    const criteria = RetrieveCriteriaSchema.parse(req.body);

    const result = await RAGIngestService.retrieveWithCriteria(
      knowledgeBaseId,
      criteria.query,
      {
        minRelevance: criteria.minRelevance,
        minTrust: criteria.minTrust,
        maxChunks: criteria.maxChunks,
        verifiedOnly: criteria.verifiedOnly,
        weightRelevance: criteria.weightRelevance,
        weightTrust: criteria.weightTrust,
        includeMetadata: criteria.includeMetadata,
      }
    );

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }
    console.error('Retrieve error:', error);
    res.status(500).json({
      error: 'Failed to retrieve documents',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * تحديث Trust Score بناءً على الاستخدام
 * POST /api/rag-ingest/documents/:documentId/feedback
 */
router.post('/documents/:documentId/feedback', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const { feedback } = z.object({
      feedback: z.enum(['helpful', 'not_helpful', 'inaccurate']),
    }).parse(req.body);

    await RAGIngestService.updateTrustFromUsage(documentId, feedback);

    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }
    console.error('Update trust error:', error);
    res.status(500).json({ error: 'Failed to update trust score' });
  }
});

/**
 * الحصول على إحصائيات الإدخال
 * GET /api/rag-ingest/:knowledgeBaseId/stats
 */
router.get('/:knowledgeBaseId/stats', async (req: Request, res: Response) => {
  try {
    const { knowledgeBaseId } = req.params;

    const stats = await RAGIngestService.getIngestStats(knowledgeBaseId);

    res.json(stats);
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get ingest stats' });
  }
});

/**
 * تقسيم نص (Preview)
 * POST /api/rag-ingest/preview-chunks
 */
router.post('/preview-chunks', async (req: Request, res: Response) => {
  try {
    const { text, options } = z.object({
      text: z.string().min(10),
      options: z.object({
        chunkSize: z.number().optional(),
        overlap: z.number().optional(),
        respectSentences: z.boolean().optional(),
        respectParagraphs: z.boolean().optional(),
      }).optional(),
    }).parse(req.body);

    // معالجة النص أولاً
    const preprocessed = RAGIngestService.preprocessText(text);

    // تقسيم النص
    const chunks = RAGIngestService.smartChunk(preprocessed, options);

    res.json({
      originalLength: text.length,
      preprocessedLength: preprocessed.length,
      chunkCount: chunks.length,
      chunks: chunks.map(c => ({
        index: c.index,
        length: c.content.length,
        tokenEstimate: c.tokenEstimate,
        preview: c.content.slice(0, 100) + (c.content.length > 100 ? '...' : ''),
      })),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }
    console.error('Preview chunks error:', error);
    res.status(500).json({ error: 'Failed to preview chunks' });
  }
});

/**
 * تنظيف المستندات منخفضة الجودة
 * POST /api/rag-ingest/:knowledgeBaseId/cleanup
 */
router.post('/:knowledgeBaseId/cleanup', async (req: Request, res: Response) => {
  try {
    const { knowledgeBaseId } = req.params;
    const options = z.object({
      minTrustScore: z.number().min(0).max(1).optional(),
      minRetrievalCount: z.number().min(0).optional(),
      olderThanDays: z.number().min(1).optional(),
    }).parse(req.body);

    const result = await RAGIngestService.cleanupLowQuality(knowledgeBaseId, options);

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }
    console.error('Cleanup error:', error);
    res.status(500).json({ error: 'Failed to cleanup documents' });
  }
});

export default router;
