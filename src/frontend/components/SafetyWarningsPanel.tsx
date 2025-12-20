/**
 * Safety Warnings Panel Component
 * Displays safety check results, warnings, and recommendations to the user
 * Supports auto-fix actions and detailed issue inspection
 */

import { useState } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Eye,
  EyeOff,
  Wand2,
  ChevronDown,
  ChevronUp,
  Info,
  XCircle,
  CheckCircle,
  AlertOctagon,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';
export type IssueType = 'toxicity' | 'pii' | 'drift' | 'injection' | 'bias' | 'security';

export interface SafetyIssue {
  id: string;
  type: IssueType;
  severity: IssueSeverity;
  title: string;
  description: string;
  location?: { start: number; end: number };
  matchedContent?: string;
  suggestion?: string;
  autoFixable: boolean;
  fixedContent?: string;
}

export interface SafetyCheckResult {
  passed: boolean;
  blocked: boolean;
  score: number;
  issues: SafetyIssue[];
  sanitizedContent?: string;
  recommendations: string[];
}

export interface SafetyWarningsPanelProps {
  result: SafetyCheckResult | null;
  isLoading?: boolean;
  onApplyFix?: (issueId: string, fixedContent: string) => void;
  onApplyAllFixes?: (sanitizedContent: string) => void;
  onDismissIssue?: (issueId: string) => void;
  showPreview?: boolean;
  language?: 'en' | 'ar';
}

// =============================================================================
// TRANSLATIONS
// =============================================================================

const translations = {
  en: {
    title: 'Safety Analysis',
    noIssues: 'No safety issues detected',
    passed: 'Passed',
    blocked: 'Blocked',
    warning: 'Warnings',
    score: 'Safety Score',
    issues: 'Issues Found',
    recommendations: 'Recommendations',
    applyFix: 'Apply Fix',
    applyAllFixes: 'Apply All Fixes',
    showDetails: 'Show Details',
    hideDetails: 'Hide Details',
    severity: {
      critical: 'Critical',
      high: 'High',
      medium: 'Medium',
      low: 'Low',
    },
    types: {
      toxicity: 'Toxicity',
      pii: 'Personal Info',
      drift: 'Context Drift',
      injection: 'Prompt Injection',
      bias: 'Bias',
      security: 'Security',
    },
    blockedMessage: 'This prompt has been blocked due to critical safety issues.',
    warningMessage: 'Please review the warnings before sending.',
  },
  ar: {
    title: 'تحليل السلامة',
    noIssues: 'لم يتم اكتشاف مشاكل سلامة',
    passed: 'ناجح',
    blocked: 'محظور',
    warning: 'تحذيرات',
    score: 'درجة السلامة',
    issues: 'المشاكل المكتشفة',
    recommendations: 'التوصيات',
    applyFix: 'تطبيق الإصلاح',
    applyAllFixes: 'تطبيق جميع الإصلاحات',
    showDetails: 'إظهار التفاصيل',
    hideDetails: 'إخفاء التفاصيل',
    severity: {
      critical: 'حرج',
      high: 'عالي',
      medium: 'متوسط',
      low: 'منخفض',
    },
    types: {
      toxicity: 'سمية',
      pii: 'معلومات شخصية',
      drift: 'انحراف السياق',
      injection: 'حقن البرومبت',
      bias: 'تحيز',
      security: 'أمان',
    },
    blockedMessage: 'تم حظر هذا البرومبت بسبب مشاكل سلامة حرجة.',
    warningMessage: 'يرجى مراجعة التحذيرات قبل الإرسال.',
  },
};

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function SeverityBadge({ severity, language }: { severity: IssueSeverity; language: 'en' | 'ar' }) {
  const t = translations[language];

  const config = {
    critical: {
      bg: 'bg-red-100 dark:bg-red-900/30',
      text: 'text-red-700 dark:text-red-400',
      border: 'border-red-200 dark:border-red-800',
      icon: AlertOctagon,
    },
    high: {
      bg: 'bg-orange-100 dark:bg-orange-900/30',
      text: 'text-orange-700 dark:text-orange-400',
      border: 'border-orange-200 dark:border-orange-800',
      icon: XCircle,
    },
    medium: {
      bg: 'bg-yellow-100 dark:bg-yellow-900/30',
      text: 'text-yellow-700 dark:text-yellow-400',
      border: 'border-yellow-200 dark:border-yellow-800',
      icon: AlertTriangle,
    },
    low: {
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      text: 'text-blue-700 dark:text-blue-400',
      border: 'border-blue-200 dark:border-blue-800',
      icon: Info,
    },
  };

  const { bg, text, border, icon: Icon } = config[severity];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text} border ${border}`}>
      <Icon className="w-3 h-3" />
      {t.severity[severity]}
    </span>
  );
}

function TypeBadge({ type, language }: { type: IssueType; language: 'en' | 'ar' }) {
  const t = translations[language];

  const config = {
    toxicity: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
    pii: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
    drift: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
    injection: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400',
    bias: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400',
    security: 'bg-gray-50 text-gray-600 dark:bg-gray-900/20 dark:text-gray-400',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config[type]}`}>
      {t.types[type]}
    </span>
  );
}

function ScoreGauge({ score }: { score: number }) {
  const getColor = () => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const getIcon = () => {
    if (score >= 80) return ShieldCheck;
    if (score >= 60) return Shield;
    if (score >= 40) return ShieldAlert;
    return ShieldX;
  };

  const Icon = getIcon();

  return (
    <div className="flex items-center gap-2">
      <Icon className={`w-8 h-8 ${getColor()}`} />
      <div>
        <div className={`text-2xl font-bold ${getColor()}`}>{score}%</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">Safety Score</div>
      </div>
    </div>
  );
}

// =============================================================================
// ISSUE CARD COMPONENT
// =============================================================================

function IssueCard({
  issue,
  language,
  onApplyFix,
  onDismiss,
}: {
  issue: SafetyIssue;
  language: 'en' | 'ar';
  onApplyFix?: (issueId: string, fixedContent: string) => void;
  onDismiss?: (issueId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const t = translations[language];
  const isRTL = language === 'ar';

  return (
    <div
      className={`border rounded-lg overflow-hidden transition-all ${
        issue.severity === 'critical'
          ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10'
          : issue.severity === 'high'
          ? 'border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/10'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
      }`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <SeverityBadge severity={issue.severity} language={language} />
              <TypeBadge type={issue.type} language={language} />
            </div>
            <h4 className="font-medium text-gray-900 dark:text-white text-sm">
              {issue.title}
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {issue.description}
            </p>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            )}
          </button>
        </div>

        {expanded && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            {issue.matchedContent && (
              <div className="mb-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {isRTL ? 'المحتوى المطابق:' : 'Matched:'}
                </span>
                <code className="block mt-1 px-2 py-1 bg-gray-100 dark:bg-gray-900 rounded text-xs text-red-600 dark:text-red-400">
                  {issue.matchedContent}
                </code>
              </div>
            )}

            {issue.suggestion && (
              <div className="mb-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {isRTL ? 'الاقتراح:' : 'Suggestion:'}
                </span>
                <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                  {issue.suggestion}
                </p>
              </div>
            )}

            {issue.location && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {isRTL ? 'الموقع:' : 'Location:'} {issue.location.start} - {issue.location.end}
              </div>
            )}

            <div className="flex gap-2 mt-3">
              {issue.autoFixable && issue.fixedContent && onApplyFix && (
                <button
                  onClick={() => onApplyFix(issue.id, issue.fixedContent!)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded transition-colors"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  {t.applyFix}
                </button>
              )}
              {onDismiss && (
                <button
                  onClick={() => onDismiss(issue.id)}
                  className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded transition-colors"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  {isRTL ? 'تجاهل' : 'Dismiss'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function SafetyWarningsPanel({
  result,
  isLoading = false,
  onApplyFix,
  onApplyAllFixes,
  onDismissIssue,
  showPreview = false,
  language = 'ar',
}: SafetyWarningsPanelProps) {
  const [showAllIssues, setShowAllIssues] = useState(false);
  const t = translations[language];
  const isRTL = language === 'ar';

  // Loading state
  if (isLoading) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent" />
          <span className="text-gray-600 dark:text-gray-400">
            {isRTL ? 'جاري تحليل السلامة...' : 'Analyzing safety...'}
          </span>
        </div>
      </div>
    );
  }

  // No result
  if (!result) {
    return null;
  }

  // No issues - success state
  if (result.issues.length === 0) {
    return (
      <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
        <div className="flex items-center gap-3" dir={isRTL ? 'rtl' : 'ltr'}>
          <CheckCircle className="w-6 h-6 text-green-500" />
          <div>
            <h4 className="font-medium text-green-700 dark:text-green-400">
              {t.noIssues}
            </h4>
            <p className="text-sm text-green-600 dark:text-green-500">
              {isRTL ? 'البرومبت آمن للإرسال' : 'The prompt is safe to send'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Sort issues by severity
  const sortedIssues = [...result.issues].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return order[a.severity] - order[b.severity];
  });

  const criticalCount = result.issues.filter(i => i.severity === 'critical').length;
  const highCount = result.issues.filter(i => i.severity === 'high').length;
  const fixableCount = result.issues.filter(i => i.autoFixable).length;

  const displayedIssues = showAllIssues ? sortedIssues : sortedIssues.slice(0, 3);

  return (
    <div
      className={`rounded-lg border overflow-hidden ${
        result.blocked
          ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10'
          : 'border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/10'
      }`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {result.blocked ? (
              <ShieldX className="w-6 h-6 text-red-500" />
            ) : (
              <ShieldAlert className="w-6 h-6 text-yellow-500" />
            )}
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {t.title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {result.blocked ? t.blockedMessage : t.warningMessage}
              </p>
            </div>
          </div>
          <ScoreGauge score={result.score} />
        </div>

        {/* Stats */}
        <div className="flex gap-4 mt-4">
          {criticalCount > 0 && (
            <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
              <AlertOctagon className="w-4 h-4" />
              <span className="text-sm font-medium">{criticalCount}</span>
              <span className="text-xs">{t.severity.critical}</span>
            </div>
          )}
          {highCount > 0 && (
            <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
              <XCircle className="w-4 h-4" />
              <span className="text-sm font-medium">{highCount}</span>
              <span className="text-xs">{t.severity.high}</span>
            </div>
          )}
          <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">{result.issues.length}</span>
            <span className="text-xs">{isRTL ? 'إجمالي' : 'Total'}</span>
          </div>
        </div>
      </div>

      {/* Issues List */}
      <div className="p-4 space-y-3">
        {displayedIssues.map(issue => (
          <IssueCard
            key={issue.id}
            issue={issue}
            language={language}
            onApplyFix={onApplyFix}
            onDismiss={onDismissIssue}
          />
        ))}

        {sortedIssues.length > 3 && (
          <button
            onClick={() => setShowAllIssues(!showAllIssues)}
            className="w-full py-2 text-center text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
          >
            {showAllIssues
              ? t.hideDetails
              : `${t.showDetails} (${sortedIssues.length - 3} ${isRTL ? 'المزيد' : 'more'})`}
          </button>
        )}
      </div>

      {/* Actions */}
      {(fixableCount > 0 || result.recommendations.length > 0) && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          {/* Apply All Fixes Button */}
          {fixableCount > 0 && result.sanitizedContent && onApplyAllFixes && (
            <button
              onClick={() => onApplyAllFixes(result.sanitizedContent!)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors mb-3"
            >
              <Wand2 className="w-4 h-4" />
              {t.applyAllFixes} ({fixableCount})
            </button>
          )}

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t.recommendations}
              </h4>
              <ul className="space-y-1">
                {result.recommendations.map((rec, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400"
                  >
                    <span className="text-blue-500 mt-1">•</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Sanitized Content Preview */}
      {showPreview && result.sanitizedContent && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-4 h-4 text-gray-500" />
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {isRTL ? 'المحتوى بعد الإصلاح' : 'Sanitized Content Preview'}
            </h4>
          </div>
          <pre className="p-3 bg-gray-100 dark:bg-gray-900 rounded text-sm text-gray-800 dark:text-gray-200 overflow-x-auto whitespace-pre-wrap">
            {result.sanitizedContent}
          </pre>
        </div>
      )}
    </div>
  );
}

export default SafetyWarningsPanel;
