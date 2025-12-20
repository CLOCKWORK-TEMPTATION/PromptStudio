import { useState } from 'react';
import {
  Wrench,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Play,
  RefreshCw,
  GitBranch,
  Zap,
} from 'lucide-react';

interface ToolPlan {
  toolName: string;
  reason: string;
  parameters: Record<string, any>;
  order: number;
  confidence: number;
  estimatedDuration?: string;
  dependencies?: string[];
}

interface ToolPlanningResult {
  plan: ToolPlan[];
  reasoning: string;
  alternativePlans?: ToolPlan[][];
  warnings?: string[];
  totalEstimatedDuration?: string;
  planEnabled: boolean;
}

interface ToolPlanViewerProps {
  planResult: ToolPlanningResult | null;
  isLoading?: boolean;
  onApprove?: (plan: ToolPlan[]) => void;
  onReject?: () => void;
  onSelectAlternative?: (plan: ToolPlan[]) => void;
  onDisable?: () => void;
}

export function ToolPlanViewer({
  planResult,
  isLoading = false,
  onApprove,
  onReject,
  onSelectAlternative,
  onDisable,
}: ToolPlanViewerProps) {
  const [showReasoning, setShowReasoning] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  const toggleStep = (index: number) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedSteps(newExpanded);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.7) return 'text-emerald-600 dark:text-emerald-400';
    if (confidence >= 0.5) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getConfidenceBg = (confidence: number) => {
    if (confidence >= 0.7) return 'bg-emerald-100 dark:bg-emerald-900/30';
    if (confidence >= 0.5) return 'bg-amber-100 dark:bg-amber-900/30';
    return 'bg-red-100 dark:bg-red-900/30';
  };

  if (isLoading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
          <span className="text-gray-700 dark:text-gray-300">
            Analyzing and planning tool usage...
          </span>
        </div>
      </div>
    );
  }

  if (!planResult) {
    return null;
  }

  const { plan, reasoning, alternativePlans, warnings, totalEstimatedDuration, planEnabled } = planResult;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Wrench className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Tool Execution Plan
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {plan.length} tool(s) selected
                {totalEstimatedDuration && ` • Est. ${totalEstimatedDuration}`}
              </p>
            </div>
          </div>

          {planEnabled && (
            <button
              onClick={onDisable}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Disable Planning
            </button>
          )}
        </div>

        {/* Warnings */}
        {warnings && warnings.length > 0 && (
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Warnings
                </p>
                <ul className="mt-1 space-y-1">
                  {warnings.map((warning, idx) => (
                    <li key={idx} className="text-sm text-amber-700 dark:text-amber-300">
                      • {warning}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Reasoning Toggle */}
        <button
          onClick={() => setShowReasoning(!showReasoning)}
          className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          {showReasoning ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          View Planning Reasoning
        </button>

        {showReasoning && (
          <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
              {reasoning}
            </pre>
          </div>
        )}
      </div>

      {/* Plan Steps */}
      <div className="space-y-2">
        {plan.map((step, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg border ${getConfidenceBg(step.confidence)} border-gray-200 dark:border-gray-700`}
          >
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => toggleStep(index)}
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold text-sm">
                  {step.order}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {step.toolName}
                    </span>
                    {step.dependencies && step.dependencies.length > 0 && (
                      <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <GitBranch className="w-3 h-3" />
                        Depends on: {step.dependencies.join(', ')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {step.reason}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {step.estimatedDuration && (
                  <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                    <Clock className="w-4 h-4" />
                    {step.estimatedDuration}
                  </div>
                )}
                <div className={`flex items-center gap-1 text-sm ${getConfidenceColor(step.confidence)}`}>
                  <Zap className="w-4 h-4" />
                  {(step.confidence * 100).toFixed(0)}%
                </div>
                {expandedSteps.has(index) ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
              </div>
            </div>

            {expandedSteps.has(index) && Object.keys(step.parameters).length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Parameters:
                </p>
                <div className="space-y-1">
                  {Object.entries(step.parameters).map(([key, value]) => (
                    <div key={key} className="flex items-start gap-2 text-sm">
                      <span className="text-gray-500 dark:text-gray-400">{key}:</span>
                      <span className="text-gray-900 dark:text-white font-mono">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Alternative Plans */}
      {alternativePlans && alternativePlans.length > 0 && (
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setShowAlternatives(!showAlternatives)}
            className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            {showAlternatives ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            View Alternative Plans ({alternativePlans.length})
          </button>

          {showAlternatives && (
            <div className="mt-4 space-y-4">
              {alternativePlans.map((altPlan, planIndex) => (
                <div
                  key={planIndex}
                  className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Alternative {planIndex + 1}
                    </span>
                    <button
                      onClick={() => onSelectAlternative?.(altPlan)}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Use this plan
                    </button>
                  </div>
                  <div className="space-y-1">
                    {altPlan.map((step, stepIndex) => (
                      <div
                        key={stepIndex}
                        className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
                      >
                        <span className="w-5 h-5 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 text-xs">
                          {step.order}
                        </span>
                        {step.toolName}
                        <span className={`text-xs ${getConfidenceColor(step.confidence)}`}>
                          ({(step.confidence * 100).toFixed(0)}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      {planEnabled && plan.length > 0 && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => onApprove?.(plan)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            Approve & Execute
          </button>
          <button
            onClick={onReject}
            className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 rounded-lg transition-colors"
          >
            <XCircle className="w-4 h-4" />
            Reject Plan
          </button>
          <button
            onClick={() => {/* Regenerate plan */}}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Regenerate
          </button>
        </div>
      )}

      {/* No Plan Message */}
      {plan.length === 0 && (
        <div className="p-6 text-center text-gray-500 dark:text-gray-400">
          <Wrench className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No tools were selected for this task.</p>
          <p className="text-sm mt-1">Try rephrasing your request or adding more details.</p>
        </div>
      )}
    </div>
  );
}
