import { Router } from 'express';
import { TranslationService } from '../../services/TranslationService.js';

export const translationRouter = Router();

translationRouter.post('/', async (req, res, next) => {
  try {
    const { text, targetLang, context } = req.body;

    if (!text || !targetLang) {
      return res.status(400).json({ error: 'Missing text or targetLang' });
    }

    const translatedText = await TranslationService.translate(text, targetLang, context);
    res.json({ translatedText });
  } catch (error) {
    next(error);
  }
});
