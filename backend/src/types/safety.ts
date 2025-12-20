/**
 * Safety Policy Types and Configurations
 * Defines types for toxicity, PII, drift detection, and policy enforcement
 */

// Severity levels for safety issues
export type SafetySeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

// Types of safety checks
export type SafetyCheckType =
  | 'toxicity'
  | 'pii'
  | 'drift'
  | 'injection'
  | 'bias'
  | 'harmful-content'
  | 'security'
  | 'compliance';

// Action to take when a safety issue is detected
export type SafetyAction = 'block' | 'warn' | 'sanitize' | 'log';

// Location in the content where an issue was found
export interface ContentLocation {
  start: number;
  end: number;
  line?: number;
  column?: number;
}

// Individual safety issue detected
export interface SafetyIssue {
  id: string;
  type: SafetyCheckType;
  severity: SafetySeverity;
  title: string;
  description: string;
  location?: ContentLocation;
  matchedContent?: string;
  suggestion?: string;
  autoFixable: boolean;
  fixedContent?: string;
}

// Policy rule definition
export interface SafetyPolicyRule {
  id: string;
  name: string;
  description: string;
  type: SafetyCheckType;
  enabled: boolean;
  severity: SafetySeverity;
  action: SafetyAction;
  patterns?: RegExp[];
  customValidator?: (content: string) => SafetyIssue[];
}

// Safety policy configuration
export interface SafetyPolicy {
  id: string;
  name: string;
  description: string;
  version: string;
  enabled: boolean;
  rules: SafetyPolicyRule[];
  settings: SafetyPolicySettings;
}

// Policy settings
export interface SafetyPolicySettings {
  blockOnCritical: boolean;
  blockOnHigh: boolean;
  autoSanitize: boolean;
  logAllChecks: boolean;
  customBlockMessage?: string;
  allowedDomains?: string[];
  maxPromptLength?: number;
  minPromptLength?: number;
}

// Result of a safety check
export interface SafetyCheckResult {
  passed: boolean;
  blocked: boolean;
  issues: SafetyIssue[];
  sanitizedContent?: string;
  recommendations: string[];
  score: number; // 0-100
  checksPerformed: SafetyCheckType[];
  processingTimeMs: number;
  policyId?: string;
}

// Drift detection configuration
export interface DriftDetectionConfig {
  enabled: boolean;
  baselineContext?: string;
  topicKeywords?: string[];
  maxDriftScore: number; // 0-1, threshold for drift warning
  checkSemanticDrift: boolean;
  checkTopicDrift: boolean;
  checkIntentDrift: boolean;
}

// Drift detection result
export interface DriftAnalysis {
  driftScore: number; // 0-1
  driftType: 'semantic' | 'topic' | 'intent' | 'none';
  originalIntent?: string;
  detectedIntent?: string;
  driftingKeywords: string[];
  recommendation?: string;
}

// PII detection categories
export interface PIICategory {
  type: string;
  pattern: RegExp;
  severity: SafetySeverity;
  redactionPattern: string;
  examples: string[];
}

// Toxicity categories
export interface ToxicityCategory {
  name: string;
  patterns: RegExp[];
  severity: SafetySeverity;
  description: string;
}

// Request body for safety check endpoint
export interface SafetyCheckRequest {
  content: string;
  policyId?: string;
  options?: {
    checkToxicity?: boolean;
    checkPII?: boolean;
    checkDrift?: boolean;
    checkInjection?: boolean;
    checkBias?: boolean;
    autoSanitize?: boolean;
    baselineContext?: string;
  };
}

// Middleware configuration
export interface SafetyMiddlewareConfig {
  enabled: boolean;
  policyId?: string;
  blockOnFail: boolean;
  logRequests: boolean;
  customHandler?: (result: SafetyCheckResult) => void;
}

// Pre-configured policies
export const DEFAULT_POLICIES = {
  STRICT: 'strict',
  MODERATE: 'moderate',
  PERMISSIVE: 'permissive',
  CUSTOM: 'custom',
} as const;

export type PolicyPreset = typeof DEFAULT_POLICIES[keyof typeof DEFAULT_POLICIES];
