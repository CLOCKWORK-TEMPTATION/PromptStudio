import { useState } from 'react';
import { Sparkles, Loader2, Wand2, ArrowRight, RefreshCw } from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { useAppStore } from '../../stores/appStore';
import clsx from 'clsx';

type DetailLevel = 'minimal' | 'standard' | 'comprehensive';

export function AIGenerator() {
  const { theme } = useAppStore();
  const { setContent, content } = useEditorStore();
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [detailLevel, setDetailLevel] = useState<DetailLevel>('standard');
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);

  const generatePrompt = async () => {
    if (!description.trim()) return;

    setIsGenerating(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const generated = buildPromptFromDescription(description, detailLevel);
    setGeneratedPrompt(generated);
    setIsGenerating(false);
  };

  const buildPromptFromDescription = (desc: string, level: DetailLevel): string => {
    const lowerDesc = desc.toLowerCase();

    let role = 'You are a helpful AI assistant';
    if (lowerDesc.includes('code') || lowerDesc.includes('program') || lowerDesc.includes('develop')) {
      role = 'You are an expert software engineer with deep knowledge of programming best practices, design patterns, and modern development workflows';
    } else if (lowerDesc.includes('write') || lowerDesc.includes('content') || lowerDesc.includes('article')) {
      role = 'You are a professional content writer with expertise in creating engaging, well-structured content for various audiences';
    } else if (lowerDesc.includes('analy') || lowerDesc.includes('data')) {
      role = 'You are a senior data analyst with expertise in extracting insights, identifying patterns, and presenting findings clearly';
    } else if (lowerDesc.includes('translate') || lowerDesc.includes('language')) {
      role = 'You are a professional translator with expertise in maintaining meaning, tone, and cultural context across languages';
    }

    let context = '';
    let constraints = '';
    let outputFormat = '';

    if (level === 'minimal') {
      return `${role}.\n\nTask: ${desc}`;
    }

    if (level === 'standard') {
      context = '\n\n## Context\nThe user needs assistance with a specific task. Provide helpful, accurate, and actionable guidance.';
      constraints = '\n\n## Guidelines\n- Be concise but thorough\n- Provide practical examples when helpful\n- Ask clarifying questions if needed';
      outputFormat = '\n\n## Output\nProvide a clear, well-organized response.';
    }

    if (level === 'comprehensive') {
      context = `\n\n## Context
You are helping with the following task. Consider all aspects carefully and provide expert-level assistance.

### Background
- Understand the user's underlying goal
- Consider potential edge cases
- Account for best practices in this domain`;

      constraints = `\n\n## Guidelines

### Do:
- Provide detailed, well-reasoned responses
- Include relevant examples and code snippets where applicable
- Explain your reasoning and methodology
- Consider alternative approaches when relevant

### Don't:
- Make assumptions without stating them
- Skip important steps or details
- Provide outdated or deprecated solutions
- Ignore potential errors or edge cases`;

      outputFormat = `\n\n## Output Format

Structure your response as follows:

1. **Summary**: Brief overview of your approach
2. **Solution**: Detailed implementation or response
3. **Explanation**: Why this approach works
4. **Alternatives**: Other options to consider (if applicable)
5. **Next Steps**: Recommended follow-up actions`;
    }

    return `${role}.
${context}

## Task
${desc}
${constraints}
${outputFormat}`;
  };

  const applyGenerated = () => {
    if (generatedPrompt) {
      setContent(generatedPrompt);
      setGeneratedPrompt(null);
      setDescription('');
    }
  };

  const appendToExisting = () => {
    if (generatedPrompt) {
      setContent(content ? `${content}\n\n${generatedPrompt}` : generatedPrompt);
      setGeneratedPrompt(null);
      setDescription('');
    }
  };

  const enhanceExisting = async () => {
    if (!content.trim()) return;
    setIsGenerating(true);
    await new Promise((resolve) => setTimeout(resolve, 800));

    let enhanced = content;

    if (!content.toLowerCase().includes('you are')) {
      enhanced = `You are an expert assistant.\n\n${enhanced}`;
    }

    if (!content.includes('##') && !content.includes('**')) {
      const lines = enhanced.split('\n').filter(l => l.trim());
      if (lines.length > 3) {
        enhanced = lines.map((line, i) => {
          if (i === 0 && line.toLowerCase().includes('you are')) return line;
          if (line.length > 50 && !line.startsWith('-') && !line.startsWith('#')) {
            return `\n## ${line.slice(0, 30).trim()}...\n${line}`;
          }
          return line;
        }).join('\n');
      }
    }

    if (!content.toLowerCase().includes('output') && !content.toLowerCase().includes('format')) {
      enhanced += '\n\n## Output\nProvide a clear, well-structured response.';
    }

    setGeneratedPrompt(enhanced);
    setIsGenerating(false);
  };

  return (
    <div className={clsx(
      'rounded-lg border overflow-hidden',
      theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
    )}>
      <div className={clsx(
        'px-4 py-3 flex items-center gap-2',
        theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
      )}>
        <Sparkles className={clsx('w-5 h-5', theme === 'dark' ? 'text-amber-400' : 'text-amber-600')} />
        <span className={clsx('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          AI Prompt Generator
        </span>
      </div>

      <div className={clsx(
        'px-4 py-4 border-t space-y-4',
        theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
      )}>
        <div>
          <label className={clsx(
            'block text-sm font-medium mb-2',
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          )}>
            Describe what you need in plain language
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="E.g., I want to analyze code and suggest improvements..."
            rows={3}
            className={clsx(
              'w-full px-3 py-2 rounded-lg border resize-none transition-colors',
              theme === 'dark'
                ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400',
              'focus:outline-none focus:ring-2 focus:ring-emerald-500/50'
            )}
          />
        </div>

        <div>
          <label className={clsx(
            'block text-sm font-medium mb-2',
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          )}>
            Detail Level
          </label>
          <div className="flex gap-2">
            {(['minimal', 'standard', 'comprehensive'] as DetailLevel[]).map((level) => (
              <button
                key={level}
                onClick={() => setDetailLevel(level)}
                className={clsx(
                  'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors capitalize',
                  detailLevel === level
                    ? theme === 'dark'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                      : 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                    : theme === 'dark'
                      ? 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'
                      : 'bg-gray-50 text-gray-600 border border-gray-200 hover:border-gray-300'
                )}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={generatePrompt}
            disabled={!description.trim() || isGenerating}
            className={clsx(
              'flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors',
              theme === 'dark'
                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50'
                : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-50'
            )}
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Wand2 className="w-4 h-4" />
            )}
            Generate Prompt
          </button>

          {content && (
            <button
              onClick={enhanceExisting}
              disabled={isGenerating}
              className={clsx(
                'py-2.5 px-4 rounded-lg flex items-center gap-2 font-medium transition-colors',
                theme === 'dark'
                  ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 disabled:opacity-50'
                  : 'bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:opacity-50'
              )}
              title="Enhance existing prompt"
            >
              <RefreshCw className="w-4 h-4" />
              Enhance
            </button>
          )}
        </div>

        {generatedPrompt && (
          <div className="space-y-3">
            <div className={clsx(
              'p-3 rounded-lg max-h-48 overflow-y-auto',
              theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
            )}>
              <pre className={clsx(
                'text-sm whitespace-pre-wrap font-mono',
                theme === 'dark' ? 'text-gray-200' : 'text-gray-800'
              )}>
                {generatedPrompt}
              </pre>
            </div>

            <div className="flex gap-2">
              <button
                onClick={applyGenerated}
                className={clsx(
                  'flex-1 py-2 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors',
                  theme === 'dark'
                    ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                    : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                )}
              >
                <ArrowRight className="w-4 h-4" />
                Replace Editor
              </button>
              <button
                onClick={appendToExisting}
                className={clsx(
                  'flex-1 py-2 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors',
                  theme === 'dark'
                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                )}
              >
                Append
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
