import OpenAI from 'openai';
import { config } from '../config/index.js';

export class TranslationService {
  static async translate(text: string, targetLang: string, context?: unknown): Promise<string> {
    if (!config.openai.apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const openai = new OpenAI({ apiKey: config.openai.apiKey });

    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: `You are a professional software localization engine. Translate the user message to ${targetLang}. Preserve terminology and tone. Return only the translated text.`,
        },
        {
          role: 'user',
          content: typeof text === 'string' ? text : String(text),
        },
      ],
      temperature: 0.3,
      max_tokens: 512,
    });

    const translatedText = response.choices[0]?.message?.content?.trim();
    return translatedText ?? text;
  }
}
