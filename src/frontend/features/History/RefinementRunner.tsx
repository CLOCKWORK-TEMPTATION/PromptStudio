import { useState } from 'react';
import {
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  Sparkles,
  Settings,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import { refinementApi, RefinementConfig } from './refinementApi';
import { RefinementResult, RefinementSuggestion, QuickEvaluationResult } from './types';

interface RefinementRunnerProps {
  promptId: string;
  onRefinementComplete?: (result: RefinementResult) => void;
}

export default function RefinementRunner({
  promptId,
  onRefinementComplete,
}: RefinementRunnerProps) {
  const [testOutput, setTestOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<RefinementResult | null>(null);
  const [quickResult, setQuickResult] = useState<QuickEvaluationResult | null>(null);
  const [suggestions, setSuggestions] = useState<RefinementSuggestion[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [expandedIteration, setExpandedIteration] = useState<number | null>(null);
  const [config, setConfig] = useState<RefinementConfig>({
    maxIterations: 3,
    targetScore: 0.85,
    autoApply: false,
    preserveIntent: true,
    evaluateSafety: true,
    evaluateStyle: true,
    evaluateAccuracy: true,
  });

  const handleQuickEvaluate = async () => {
    if (!testOutput.trim()) return;

    try {
      const evaluation = await refinementApi.quickEvaluate(promptId, testOutput);
      setQuickResult(evaluation);
    } catch (error) {
      console.error('Quick evaluation failed:', error);
    }
  };

  const handleGetSuggestions = async () => {
    if (!testOutput.trim()) return;

    setIsRunning(true);
    try {
      const result = await refinementApi.suggestRefinements(promptId, testOutput);
      setSuggestions(result.suggestions);
      setQuickResult({
        score: result.currentScore,
        category: result.currentScore >= 0.8 ? 'excellent' : result.currentScore >= 0.6 ? 'good' : 'fair',
        quickFeedback: `Estimated improvement: +${(result.estimatedImprovement * 100).toFixed(1)}%`,
      });
    } catch (error) {
      console.error('Failed to get suggestions:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunRefinement = async () => {
    if (!testOutput.trim()) return;

    setIsRunning(true);
    setResult(null);
    setSuggestions([]);

    try {
      const refinementResult = await refinementApi.refinePrompt(promptId, testOutput, config);
      setResult(refinementResult);
      onRefinementComplete?.(refinementResult);
    } catch (error) {
      console.error('Refinement failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'excellent':
        return 'text-green-500';
      case 'good':
        return 'text-blue-500';
      case 'fair':
        return 'text-yellow-500';
      case 'poor':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'low':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium flex items-center gap-2">
          <Sparkles size={18} className="text-purple-500" />
          Self-Refinement
        </h3>
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <Settings size={18} />
        </button>
      </div>

      {/* Configuration panel */}
      {showConfig && (
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Max Iterations</label>
              <input
                type="number"
                min={1}
                max={10}
                value={config.maxIterations}
                onChange={(e) => setConfig({ ...config, maxIterations: parseInt(e.target.value) })}
                className="w-full px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Target Score</label>
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={config.targetScore}
                onChange={(e) => setConfig({ ...config, targetScore: parseFloat(e.target.value) })}
                className="w-full px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={config.preserveIntent}
                onChange={(e) => setConfig({ ...config, preserveIntent: e.target.checked })}
              />
              Preserve original intent
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={config.evaluateSafety}
                onChange={(e) => setConfig({ ...config, evaluateSafety: e.target.checked })}
              />
              Evaluate safety
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={config.evaluateStyle}
                onChange={(e) => setConfig({ ...config, evaluateStyle: e.target.checked })}
              />
              Evaluate style
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={config.evaluateAccuracy}
                onChange={(e) => setConfig({ ...config, evaluateAccuracy: e.target.checked })}
              />
              Evaluate accuracy
            </label>
          </div>
        </div>
      )}

      {/* Test output input */}
      <div>
        <label className="block text-sm text-gray-500 mb-1">
          Paste LLM output to evaluate and refine prompt
        </label>
        <textarea
          value={testOutput}
          onChange={(e) => setTestOutput(e.target.value)}
          onBlur={handleQuickEvaluate}
          placeholder="Paste the output from your prompt execution here..."
          rows={4}
          className="w-full px-3 py-2 text-sm border rounded dark:bg-gray-800 dark:border-gray-700 resize-none"
        />
      </div>

      {/* Quick evaluation result */}
      {quickResult && (
        <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded">
          <div className="text-center">
            <div className={`text-2xl font-bold ${getCategoryColor(quickResult.category)}`}>
              {(quickResult.score * 100).toFixed(0)}%
            </div>
            <div className={`text-xs capitalize ${getCategoryColor(quickResult.category)}`}>
              {quickResult.category}
            </div>
          </div>
          <div className="flex-1 text-sm text-gray-600 dark:text-gray-400">
            {quickResult.quickFeedback}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleGetSuggestions}
          disabled={isRunning || !testOutput.trim()}
          className="flex-1 px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <AlertTriangle size={16} />
          Get Suggestions
        </button>
        <button
          onClick={handleRunRefinement}
          disabled={isRunning || !testOutput.trim()}
          className="flex-1 px-4 py-2 text-sm bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isRunning ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Refining...
            </>
          ) : (
            <>
              <Play size={16} />
              Run Refinement
            </>
          )}
        </button>
      </div>

      {/* Suggestions list */}
      {suggestions.length > 0 && !result && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Suggested Improvements
          </h4>
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              className="p-3 border rounded dark:border-gray-700 space-y-2"
            >
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 text-xs rounded ${getPriorityColor(suggestion.priority)}`}>
                  {suggestion.priority}
                </span>
                <span className="text-xs text-gray-500">{suggestion.type}</span>
              </div>
              <p className="text-sm">{suggestion.description}</p>
              <p className="text-xs text-gray-500 italic">{suggestion.suggestedChange}</p>
            </div>
          ))}
        </div>
      )}

      {/* Refinement result */}
      {result && (
        <div className="space-y-4">
          {/* Summary */}
          <div className={`p-4 rounded ${result.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-yellow-50 dark:bg-yellow-900/20'}`}>
            <div className="flex items-center gap-2 mb-2">
              {result.success ? (
                <CheckCircle className="text-green-500" size={20} />
              ) : (
                <XCircle className="text-yellow-500" size={20} />
              )}
              <span className="font-medium">
                {result.success ? 'Refinement Successful' : 'No Improvement Found'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-gray-500">Iterations</div>
                <div className="font-medium">{result.iterations.length}</div>
              </div>
              <div>
                <div className="text-gray-500">Final Score</div>
                <div className="font-medium">{(result.finalScore * 100).toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-gray-500">Improvement</div>
                <div className={`font-medium flex items-center gap-1 ${result.totalImprovement >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  <TrendingUp size={14} />
                  {result.totalImprovement >= 0 ? '+' : ''}
                  {(result.totalImprovement * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          {/* Iterations */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Refinement Iterations
            </h4>
            {result.iterations.map((iteration, index) => (
              <div
                key={index}
                className="border rounded dark:border-gray-700"
              >
                <button
                  onClick={() => setExpandedIteration(expandedIteration === index ? null : index)}
                  className="w-full p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs flex items-center justify-center dark:bg-purple-900 dark:text-purple-300">
                      {iteration.iteration}
                    </span>
                    <span className="text-sm">
                      Score: {(iteration.evaluation.overallScore * 100).toFixed(1)}%
                    </span>
                    <span className={`text-xs ${iteration.improvementDelta >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      ({iteration.improvementDelta >= 0 ? '+' : ''}
                      {(iteration.improvementDelta * 100).toFixed(1)}%)
                    </span>
                  </div>
                  {expandedIteration === index ? (
                    <ChevronUp size={16} />
                  ) : (
                    <ChevronDown size={16} />
                  )}
                </button>

                {expandedIteration === index && (
                  <div className="p-3 border-t dark:border-gray-700 space-y-3">
                    {/* Applied suggestions */}
                    {iteration.appliedSuggestions.length > 0 && (
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Applied Suggestions:</div>
                        <ul className="text-xs space-y-1">
                          {iteration.appliedSuggestions.map((s, i) => (
                            <li key={i} className="flex items-start gap-1">
                              <span className={`px-1 rounded ${getPriorityColor(s.priority)}`}>
                                {s.type}
                              </span>
                              <span>{s.description}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Refined prompt preview */}
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Refined Prompt:</div>
                      <pre className="text-xs bg-gray-50 dark:bg-gray-800 p-2 rounded overflow-x-auto max-h-32 overflow-y-auto whitespace-pre-wrap">
                        {iteration.refinedPrompt.slice(0, 500)}
                        {iteration.refinedPrompt.length > 500 && '...'}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Final prompt */}
          {result.success && (
            <div>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Final Refined Prompt
              </div>
              <pre className="text-sm bg-green-50 dark:bg-green-900/20 p-3 rounded border border-green-200 dark:border-green-800 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                {result.finalPrompt}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
