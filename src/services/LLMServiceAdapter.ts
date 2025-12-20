import OpenAI from 'openai';

export class LLMServiceAdapter {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  async translate({
    prompt,
    sourceLanguage,
    targetLanguage,
    systemPrompt = 'You are a professional localization assistant. Translate and localize the following text.',
    cache,
  }: {
    prompt: string;
    sourceLanguage: string;
    targetLanguage: string;
    systemPrompt?: string;
    cache?: (key: string, value?: string) => Promise<string | undefined>;
  }): Promise<string> {
    const cacheKey = `${sourceLanguage}:${targetLanguage}:${prompt}`;
    if (cache) {
      const cached = await cache(cacheKey);
      if (cached) return cached;
    }
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Translate from ${sourceLanguage} to ${targetLanguage}: ${prompt}` },
      ],
      temperature: 0.2,
      max_tokens: 512,
    });
    const result = completion.choices[0]?.message?.content?.trim() || '';
    if (cache) await cache(cacheKey, result);
    return result;
  }
}
