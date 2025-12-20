import { useState, useCallback, useEffect } from 'react';
import { AlertCircle, Brain, Shield, DollarSign, Zap, GitBranch, Wrench, ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';
import { ToolPlanViewer } from './ToolPlanViewer';
import { SafetyWarningsPanel, SafetyCheckResult, SafetyIssue } from './SafetyWarningsPanel';

interface HierarchicalPrompt {
  systemPrompt: string;
  processPrompt: string;
  taskPrompt: string;
  outputPrompt: string;
}

interface AdvancedSettings {
  persona?: string;
  domain?: string;
  reasoningMode: 'default' | 'tree-of-thought' | 'graph-of-thought';
  ragEnabled: boolean;
  toolPlanning: boolean;
  selfRefinement: boolean;
  safetyChecks: boolean;
  autoSanitize: boolean;
  blockOnCritical: boolean;
}

interface PreSendAnalysis {
  estimatedTokens: number;
  estimatedCost: number;
  successProbability: number;
  safetyScore: number;
  recommendations: string[];
  safetyResult?: SafetyCheckResult;
}

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

interface ToolDefinition {
  name: string;
  description: string;
  parameters?: Record<string, { type: string; description: string; required?: boolean }>;
  category?: string;
}

export function AdvancedPromptEditor() {
  const [hierarchical, setHierarchical] = useState<HierarchicalPrompt>({
    systemPrompt: '',
    processPrompt: '',
    taskPrompt: '',
    outputPrompt: '',
  });

  const [settings, setSettings] = useState<AdvancedSettings>({
    reasoningMode: 'default',
    ragEnabled: false,
    toolPlanning: false,
    selfRefinement: false,
    safetyChecks: true,
    autoSanitize: false,
    blockOnCritical: true,
  });

  const [analysis, setAnalysis] = useState<PreSendAnalysis | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [toolPlanResult, setToolPlanResult] = useState<ToolPlanningResult | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [safetyResult, setSafetyResult] = useState<SafetyCheckResult | null>(null);

  // Sample available tools - in production, these would come from an API
  const availableTools: ToolDefinition[] = [
    {
      name: 'web_search',
      description: 'Search the web for information and retrieve results',
      parameters: {
        query: { type: 'string', description: 'Search query', required: true },
        limit: { type: 'number', description: 'Max results' },
      },
      category: 'search',
    },
    {
      name: 'code_analyzer',
      description: 'Analyze and review code for issues and improvements',
      parameters: {
        code: { type: 'string', description: 'Code to analyze', required: true },
        language: { type: 'string', description: 'Programming language' },
      },
      category: 'development',
    },
    {
      name: 'data_fetcher',
      description: 'Fetch and retrieve data from APIs and databases',
      parameters: {
        url: { type: 'string', description: 'API URL', required: true },
        method: { type: 'string', description: 'HTTP method' },
      },
      category: 'api',
    },
    {
      name: 'text_translator',
      description: 'Translate text between different languages',
      parameters: {
        text: { type: 'string', description: 'Text to translate', required: true },
        targetLang: { type: 'string', description: 'Target language', required: true },
      },
      category: 'translation',
    },
    {
      name: 'file_processor',
      description: 'Process and transform files including documents and images',
      parameters: {
        filePath: { type: 'string', description: 'Path to file', required: true },
        operation: { type: 'string', description: 'Operation to perform' },
      },
      category: 'file',
    },
    {
      name: 'calculator',
      description: 'Calculate mathematical expressions and formulas',
      parameters: {
        expression: { type: 'string', description: 'Math expression', required: true },
      },
      category: 'math',
    },
  ];

  // Perform safety check on content
  const performSafetyCheck = useCallback((content: string): SafetyCheckResult => {
    const issues: SafetyIssue[] = [];
    let issueId = 0;

    // Toxicity patterns
    const toxicityPatterns = [
      { pattern: /\b(hate|attack|kill|destroy)\s+(all|every)?\s*(people|humans|users)/gi, category: 'hate_speech', severity: 'critical' as const },
      { pattern: /\b(racist|sexist|homophobic|transphobic)\b/gi, category: 'discrimination', severity: 'high' as const },
      { pattern: /\b(stupid|idiot|dumb|moron)\b/gi, category: 'insults', severity: 'medium' as const },
    ];

    // PII patterns
    const piiPatterns = [
      { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, type: 'email', severity: 'high' as const, redaction: '[بريد_محذوف]' },
      { pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, type: 'phone', severity: 'high' as const, redaction: '[هاتف_محذوف]' },
      { pattern: /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g, type: 'ssn', severity: 'critical' as const, redaction: '[رقم_ضمان_محذوف]' },
      { pattern: /(?:api[_-]?key|apikey|secret[_-]?key)[=:]\s*['"]?[\w-]+['"]?/gi, type: 'api_key', severity: 'critical' as const, redaction: '[مفتاح_API_محذوف]' },
    ];

    // Injection patterns
    const injectionPatterns = [
      { pattern: /ignore\s+(all\s+)?previous\s+instructions?/gi, message: 'محاولة تجاوز التعليمات', severity: 'critical' as const },
      { pattern: /disregard\s+(all\s+)?(previous|above)/gi, message: 'محاولة تجاهل التعليمات', severity: 'critical' as const },
      { pattern: /you\s+are\s+now\s+(?:a|an)?\s*\w+/gi, message: 'محاولة تغيير الدور', severity: 'high' as const },
      { pattern: /jailbreak|DAN\s+mode|bypass/gi, message: 'محاولة كسر القيود', severity: 'critical' as const },
    ];

    // Check toxicity
    for (const { pattern, category, severity } of toxicityPatterns) {
      pattern.lastIndex = 0;
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        issues.push({
          id: `issue_${++issueId}`,
          type: 'toxicity',
          severity,
          title: `محتوى سام: ${category}`,
          description: `تم اكتشاف لغة سامة: "${match[0]}"`,
          location: match.index !== undefined ? { start: match.index, end: match.index + match[0].length } : undefined,
          matchedContent: match[0],
          suggestion: 'قم بإزالة أو إعادة صياغة هذا المحتوى',
          autoFixable: true,
          fixedContent: '[تم الحذف]',
        });
      }
    }

    // Check PII
    for (const { pattern, type, severity, redaction } of piiPatterns) {
      pattern.lastIndex = 0;
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        issues.push({
          id: `issue_${++issueId}`,
          type: 'pii',
          severity,
          title: `معلومات شخصية: ${type}`,
          description: `تم اكتشاف ${type} محتمل`,
          location: match.index !== undefined ? { start: match.index, end: match.index + match[0].length } : undefined,
          matchedContent: match[0].substring(0, 4) + '****',
          suggestion: `قم بإخفاء ${type} قبل الإرسال`,
          autoFixable: true,
          fixedContent: redaction,
        });
      }
    }

    // Check injection
    for (const { pattern, message, severity } of injectionPatterns) {
      pattern.lastIndex = 0;
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        issues.push({
          id: `issue_${++issueId}`,
          type: 'injection',
          severity,
          title: 'محاولة حقن',
          description: message,
          location: match.index !== undefined ? { start: match.index, end: match.index + match[0].length } : undefined,
          matchedContent: match[0],
          suggestion: 'قم بإزالة نمط الحقن',
          autoFixable: false,
        });
      }
    }

    // Calculate score
    let score = 100;
    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical': score -= 30; break;
        case 'high': score -= 20; break;
        case 'medium': score -= 10; break;
        case 'low': score -= 5; break;
      }
    }
    score = Math.max(0, score);

    // Generate recommendations
    const recommendations: string[] = [];
    const issueTypes = new Set(issues.map(i => i.type));
    if (issueTypes.has('toxicity')) recommendations.push('قم بإزالة اللغة السامة قبل الإرسال');
    if (issueTypes.has('pii')) recommendations.push('قم بإخفاء المعلومات الشخصية');
    if (issueTypes.has('injection')) recommendations.push('قم بإزالة أنماط الحقن');

    // Sanitize content if needed
    let sanitizedContent: string | undefined;
    if (settings.autoSanitize) {
      sanitizedContent = content;
      const fixableIssues = [...issues]
        .filter(i => i.autoFixable && i.location && i.fixedContent)
        .sort((a, b) => (b.location?.start ?? 0) - (a.location?.start ?? 0));

      for (const issue of fixableIssues) {
        if (issue.location && issue.fixedContent) {
          sanitizedContent =
            sanitizedContent.substring(0, issue.location.start) +
            issue.fixedContent +
            sanitizedContent.substring(issue.location.end);
        }
      }
    }

    const blocked = issues.some(i => i.severity === 'critical') && settings.blockOnCritical;

    return {
      passed: !blocked && score >= 50,
      blocked,
      score,
      issues,
      sanitizedContent,
      recommendations,
    };
  }, [settings.autoSanitize, settings.blockOnCritical]);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);

    // Simulate async analysis
    await new Promise(resolve => setTimeout(resolve, 500));

    const fullPrompt = buildFullPrompt();
    const tokens = Math.ceil(fullPrompt.length / 4);

    // Perform safety check if enabled
    let safetyCheckResult: SafetyCheckResult | undefined;
    if (settings.safetyChecks) {
      safetyCheckResult = performSafetyCheck(fullPrompt);
      setSafetyResult(safetyCheckResult);
    }

    setAnalysis({
      estimatedTokens: tokens,
      estimatedCost: tokens * 0.00003,
      successProbability: safetyCheckResult?.blocked ? 0 : 0.85,
      safetyScore: safetyCheckResult ? safetyCheckResult.score / 100 : 0.92,
      recommendations: safetyCheckResult?.recommendations ?? [
        'Consider adding more specific examples',
        'Output format could be more structured',
      ],
      safetyResult: safetyCheckResult,
    });

    // If tool planning is enabled, generate a plan
    if (settings.toolPlanning) {
      await handleGenerateToolPlan();
    }

    setIsAnalyzing(false);
  };

  const handleGenerateToolPlan = async () => {
    setIsPlanning(true);
    const fullPrompt = buildFullPrompt();

    try {
      const response = await fetch('/api/prompts/plan-tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: fullPrompt,
          availableTools,
          maxTools: 5,
          requireApproval: true,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setToolPlanResult(result);
      }
    } catch (error) {
      console.error('Failed to generate tool plan:', error);
    } finally {
      setIsPlanning(false);
    }
  };

  const handleApprovePlan = async (plan: ToolPlan[]) => {
    try {
      const response = await fetch('/api/prompts/execute-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          approved: true,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Execution result:', result);
        // Handle execution result
      }
    } catch (error) {
      console.error('Failed to execute plan:', error);
    }
  };

  const handleRejectPlan = () => {
    setToolPlanResult(null);
  };

  const handleSelectAlternative = (plan: ToolPlan[]) => {
    if (toolPlanResult) {
      setToolPlanResult({
        ...toolPlanResult,
        plan,
      });
    }
  };

  const handleDisableToolPlanning = () => {
    setSettings({ ...settings, toolPlanning: false });
    setToolPlanResult(null);
  };

  // Handle applying a single fix
  const handleApplyFix = useCallback((issueId: string, fixedContent: string) => {
    if (!safetyResult) return;

    const issue = safetyResult.issues.find(i => i.id === issueId);
    if (!issue?.location) return;

    const fullPrompt = buildFullPrompt();
    const newContent =
      fullPrompt.substring(0, issue.location.start) +
      fixedContent +
      fullPrompt.substring(issue.location.end);

    // Update the hierarchical prompts based on the fix
    // For simplicity, we'll update the task prompt
    setHierarchical(prev => ({
      ...prev,
      taskPrompt: newContent.replace(/# System\n.*?(?=# Process|# Task|# Output|$)/s, '')
                           .replace(/# Process\n.*?(?=# Task|# Output|$)/s, '')
                           .replace(/# Task\n/s, '')
                           .replace(/# Output\n.*$/s, ''),
    }));

    // Re-run analysis
    handleAnalyze();
  }, [safetyResult]);

  // Handle applying all fixes
  const handleApplyAllFixes = useCallback((sanitizedContent: string) => {
    // Parse the sanitized content back to hierarchical structure
    const systemMatch = sanitizedContent.match(/# System\n([\s\S]*?)(?=# Process|# Task|# Output|$)/);
    const processMatch = sanitizedContent.match(/# Process\n([\s\S]*?)(?=# Task|# Output|$)/);
    const taskMatch = sanitizedContent.match(/# Task\n([\s\S]*?)(?=# Output|$)/);
    const outputMatch = sanitizedContent.match(/# Output\n([\s\S]*)$/);

    setHierarchical({
      systemPrompt: systemMatch?.[1]?.trim() ?? '',
      processPrompt: processMatch?.[1]?.trim() ?? '',
      taskPrompt: taskMatch?.[1]?.trim() ?? '',
      outputPrompt: outputMatch?.[1]?.trim() ?? '',
    });

    // Re-run analysis
    setTimeout(handleAnalyze, 100);
  }, []);

  // Auto-analyze on content change (debounced)
  useEffect(() => {
    if (!settings.safetyChecks) return;

    const timer = setTimeout(() => {
      const fullPrompt = buildFullPrompt();
      if (fullPrompt.length > 10) {
        const result = performSafetyCheck(fullPrompt);
        setSafetyResult(result);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [hierarchical, settings.safetyChecks, performSafetyCheck]);

  const buildFullPrompt = () => {
    const parts: string[] = [];
    if (hierarchical.systemPrompt) parts.push(`# System\n${hierarchical.systemPrompt}`);
    if (hierarchical.processPrompt) parts.push(`# Process\n${hierarchical.processPrompt}`);
    if (hierarchical.taskPrompt) parts.push(`# Task\n${hierarchical.taskPrompt}`);
    if (hierarchical.outputPrompt) parts.push(`# Output\n${hierarchical.outputPrompt}`);
    return parts.join('\n\n');
  };

  return (
    <div className="space-y-6 p-6 bg-gray-50 dark:bg-gray-900 rounded-lg">
      {/* Hierarchical Prompt Sections */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <GitBranch className="w-5 h-5" />
          Hierarchical Prompt Structure
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              System Instructions
            </label>
            <textarea
              value={hierarchical.systemPrompt}
              onChange={(e) =>
                setHierarchical({ ...hierarchical, systemPrompt: e.target.value })
              }
              className="w-full h-32 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder="Define the role and context..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Process Guidelines
            </label>
            <textarea
              value={hierarchical.processPrompt}
              onChange={(e) =>
                setHierarchical({ ...hierarchical, processPrompt: e.target.value })
              }
              className="w-full h-32 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder="How should the task be approached..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Task Description
            </label>
            <textarea
              value={hierarchical.taskPrompt}
              onChange={(e) =>
                setHierarchical({ ...hierarchical, taskPrompt: e.target.value })
              }
              className="w-full h-32 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder="What needs to be done..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Output Format
            </label>
            <textarea
              value={hierarchical.outputPrompt}
              onChange={(e) =>
                setHierarchical({ ...hierarchical, outputPrompt: e.target.value })
              }
              className="w-full h-32 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder="How should the output be structured..."
            />
          </div>
        </div>
      </div>

      {/* Meta-Prompting */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Meta-Prompting
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Persona
            </label>
            <input
              type="text"
              value={settings.persona || ''}
              onChange={(e) => setSettings({ ...settings, persona: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder="e.g., Expert Data Scientist"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Domain
            </label>
            <input
              type="text"
              value={settings.domain || ''}
              onChange={(e) => setSettings({ ...settings, domain: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder="e.g., Machine Learning"
            />
          </div>
        </div>
      </div>

      {/* Advanced Features */}
      <div className="space-y-4">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2"
        >
          <Brain className="w-5 h-5" />
          Advanced Features
          <span className="text-sm font-normal text-gray-500">
            {showAdvanced ? '(Hide)' : '(Show)'}
          </span>
        </button>

        {showAdvanced && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.ragEnabled}
                onChange={(e) =>
                  setSettings({ ...settings, ragEnabled: e.target.checked })
                }
                className="w-4 h-4"
              />
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Enable RAG (Retrieval-Augmented Generation)
              </label>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.toolPlanning}
                onChange={(e) =>
                  setSettings({ ...settings, toolPlanning: e.target.checked })
                }
                className="w-4 h-4"
              />
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Enable Tool Planning
              </label>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.selfRefinement}
                onChange={(e) =>
                  setSettings({ ...settings, selfRefinement: e.target.checked })
                }
                className="w-4 h-4"
              />
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Enable Self-Refinement
              </label>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.safetyChecks}
                onChange={(e) =>
                  setSettings({ ...settings, safetyChecks: e.target.checked })
                }
                className="w-4 h-4"
              />
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Enable Safety Checks
              </label>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.autoSanitize}
                onChange={(e) =>
                  setSettings({ ...settings, autoSanitize: e.target.checked })
                }
                className="w-4 h-4"
                disabled={!settings.safetyChecks}
              />
              <label className={`text-sm font-medium ${settings.safetyChecks ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>
                Auto-Sanitize Content
              </label>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.blockOnCritical}
                onChange={(e) =>
                  setSettings({ ...settings, blockOnCritical: e.target.checked })
                }
                className="w-4 h-4"
                disabled={!settings.safetyChecks}
              />
              <label className={`text-sm font-medium ${settings.safetyChecks ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>
                Block on Critical Issues
              </label>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Reasoning Mode
              </label>
              <select
                value={settings.reasoningMode}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    reasoningMode: e.target.value as any,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="default">Default</option>
                <option value="tree-of-thought">Tree of Thought</option>
                <option value="graph-of-thought">Graph of Thought</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Safety Warnings Panel */}
      {settings.safetyChecks && safetyResult && safetyResult.issues.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-yellow-500" />
            تحذيرات السلامة
          </h3>
          <SafetyWarningsPanel
            result={safetyResult}
            isLoading={isAnalyzing}
            onApplyFix={handleApplyFix}
            onApplyAllFixes={handleApplyAllFixes}
            showPreview={settings.autoSanitize}
            language="ar"
          />
        </div>
      )}

      {/* Pre-Send Analysis */}
      <div className="space-y-4">
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          className={`px-4 py-2 ${
            isAnalyzing ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'
          } text-white rounded-lg flex items-center gap-2 transition-colors`}
        >
          {isAnalyzing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Zap className="w-4 h-4" />
          )}
          {isAnalyzing ? 'جاري التحليل...' : 'تحليل قبل الإرسال'}
        </button>

        {analysis && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-2">
                <Zap className="w-4 h-4" />
                <span className="text-sm font-medium">Tokens</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {analysis.estimatedTokens.toLocaleString()}
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-2">
                <DollarSign className="w-4 h-4" />
                <span className="text-sm font-medium">Cost</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                ${analysis.estimatedCost.toFixed(4)}
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-2">
                <Brain className="w-4 h-4" />
                <span className="text-sm font-medium">Success Probability</span>
              </div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {(analysis.successProbability * 100).toFixed(0)}%
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-2">
                <Shield className="w-4 h-4" />
                <span className="text-sm font-medium">Safety Score</span>
              </div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {(analysis.safetyScore * 100).toFixed(0)}%
              </div>
            </div>

            {analysis.recommendations.length > 0 && (
              <div className="col-span-full p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-amber-900 dark:text-amber-100 mb-2">
                      Recommendations
                    </h4>
                    <ul className="space-y-1 text-sm text-amber-800 dark:text-amber-200">
                      {analysis.recommendations.map((rec, idx) => (
                        <li key={idx}>• {rec}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tool Plan Section */}
      {settings.toolPlanning && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Wrench className="w-5 h-5" />
              Tool Planning
            </h3>
            {!toolPlanResult && !isPlanning && (
              <button
                onClick={handleGenerateToolPlan}
                className="px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white text-sm rounded-lg flex items-center gap-2"
              >
                <Wrench className="w-4 h-4" />
                Generate Tool Plan
              </button>
            )}
          </div>

          <ToolPlanViewer
            planResult={toolPlanResult}
            isLoading={isPlanning}
            onApprove={handleApprovePlan}
            onReject={handleRejectPlan}
            onSelectAlternative={handleSelectAlternative}
            onDisable={handleDisableToolPlanning}
          />
        </div>
      )}

      {/* Preview */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Full Prompt Preview
        </h3>
        <pre className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
          {buildFullPrompt() || 'No prompt content yet...'}
        </pre>
      </div>
    </div>
  );
}
