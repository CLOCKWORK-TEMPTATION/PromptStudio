import { Configuration, OpenAIApi } from 'openai';

export class LLMServiceAdapter {
  private openai: OpenAIApi;

  constructor(apiKey: string) {
    const configuration = new Configuration({ apiKey });
    this.openai = new OpenAIApi(configuration);
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
    const completion = await this.openai.createChatCompletion({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Translate from ${sourceLanguage} to ${targetLanguage}: ${prompt}` },
      ],
      temperature: 0.2,
      max_tokens: 512,
    });
    const result = completion.data.choices[0]?.message?.content?.trim() || '';
    if (cache) await cache(cacheKey, result);
    return result;
  }
}
