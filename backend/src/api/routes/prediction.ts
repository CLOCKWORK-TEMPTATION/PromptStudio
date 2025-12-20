import { Router, Request, Response } from 'express';
import { PreSendPredictionService, MODEL_PRICING } from '../../services/PreSendPredictionService.js';

const router = Router();

/**
 * @route POST /api/prediction/analyze
 * @desc Comprehensive pre-send analysis
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const {
      prompt,
      model = 'gpt-4',
      expectedOutputLength = 'medium',
      requestsPerMonth = 100,
      includeHistory = true,
      userId,
    } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required and must be a string',
      });
    }

    const analysis = await PreSendPredictionService.analyze(prompt, model, {
      expectedOutputLength,
      requestsPerMonth,
      includeHistory,
      userId,
    });

    res.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    console.error('Pre-send analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform pre-send analysis',
    });
  }
});

/**
 * @route POST /api/prediction/quick
 * @desc Quick analysis for real-time feedback
 */
router.post('/quick', async (req: Request, res: Response) => {
  try {
    const { prompt, model = 'gpt-4' } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required and must be a string',
      });
    }

    const analysis = PreSendPredictionService.quickAnalyze(prompt, model);

    res.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    console.error('Quick analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform quick analysis',
    });
  }
});

/**
 * @route POST /api/prediction/tokens
 * @desc Estimate token counts
 */
router.post('/tokens', async (req: Request, res: Response) => {
  try {
    const { prompt, model = 'gpt-4', expectedOutputLength = 'medium' } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required',
      });
    }

    const tokenEstimation = PreSendPredictionService.estimateTokens(
      prompt,
      model,
      expectedOutputLength
    );

    res.json({
      success: true,
      data: tokenEstimation,
    });
  } catch (error) {
    console.error('Token estimation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to estimate tokens',
    });
  }
});

/**
 * @route POST /api/prediction/cost
 * @desc Estimate costs
 */
router.post('/cost', async (req: Request, res: Response) => {
  try {
    const {
      prompt,
      model = 'gpt-4',
      expectedOutputLength = 'medium',
      requestsPerMonth = 100,
    } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required',
      });
    }

    const tokenEstimation = PreSendPredictionService.estimateTokens(
      prompt,
      model,
      expectedOutputLength
    );

    const costEstimation = PreSendPredictionService.estimateCost(
      tokenEstimation,
      model,
      requestsPerMonth
    );

    res.json({
      success: true,
      data: {
        ...costEstimation,
        tokens: tokenEstimation,
      },
    });
  } catch (error) {
    console.error('Cost estimation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to estimate cost',
    });
  }
});

/**
 * @route POST /api/prediction/success
 * @desc Predict success probability
 */
router.post('/success', async (req: Request, res: Response) => {
  try {
    const { prompt, model = 'gpt-4' } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required',
      });
    }

    const successPrediction = await PreSendPredictionService.predictSuccess(
      prompt,
      model
    );

    res.json({
      success: true,
      data: successPrediction,
    });
  } catch (error) {
    console.error('Success prediction error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to predict success',
    });
  }
});

/**
 * @route POST /api/prediction/response-time
 * @desc Estimate response time
 */
router.post('/response-time', async (req: Request, res: Response) => {
  try {
    const { prompt, model = 'gpt-4', expectedOutputLength = 'medium' } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required',
      });
    }

    const tokenEstimation = PreSendPredictionService.estimateTokens(
      prompt,
      model,
      expectedOutputLength
    );

    const responseTimeEstimation = PreSendPredictionService.estimateResponseTime(
      tokenEstimation,
      model
    );

    res.json({
      success: true,
      data: responseTimeEstimation,
    });
  } catch (error) {
    console.error('Response time estimation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to estimate response time',
    });
  }
});

/**
 * @route GET /api/prediction/models
 * @desc Get available models with pricing
 */
router.get('/models', async (req: Request, res: Response) => {
  try {
    const models = Object.entries(MODEL_PRICING).map(([id, pricing]) => ({
      id,
      ...pricing,
      inputCostPer1K: pricing.input,
      outputCostPer1K: pricing.output,
    }));

    res.json({
      success: true,
      data: models,
    });
  } catch (error) {
    console.error('Get models error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get models',
    });
  }
});

/**
 * @route POST /api/prediction/compare
 * @desc Compare analysis across multiple models
 */
router.post('/compare', async (req: Request, res: Response) => {
  try {
    const { prompt, models = ['gpt-4', 'gpt-3.5-turbo', 'claude-3-sonnet'] } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required',
      });
    }

    const comparisons = await Promise.all(
      models.map(async (model: string) => {
        const analysis = await PreSendPredictionService.analyze(prompt, model, {
          includeHistory: false,
        });

        return {
          model,
          ...analysis,
        };
      })
    );

    // Find best options
    const bestForCost = comparisons.reduce((best, current) =>
      current.costEstimation.totalCost < best.costEstimation.totalCost ? current : best
    );

    const bestForSuccess = comparisons.reduce((best, current) =>
      current.successPrediction.probability > best.successPrediction.probability ? current : best
    );

    const bestForSpeed = comparisons.reduce((best, current) =>
      current.responseTimeEstimation.estimatedSeconds < best.responseTimeEstimation.estimatedSeconds
        ? current
        : best
    );

    res.json({
      success: true,
      data: {
        comparisons,
        recommendations: {
          bestForCost: bestForCost.model,
          bestForSuccess: bestForSuccess.model,
          bestForSpeed: bestForSpeed.model,
        },
      },
    });
  } catch (error) {
    console.error('Model comparison error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to compare models',
    });
  }
});

export default router;
