/**
 * Type definitions for glm-coding-plan-statusline
 */

/**
 * Platform type identifier
 */
export type Platform = "ZAI" | "ZHIPU" | null;

/**
 * Environment variables from Claude settings files
 */
export interface ClaudeEnv {
  ANTHROPIC_BASE_URL: string;
  ANTHROPIC_AUTH_TOKEN: string;
}

/**
 * Quota limit usage detail item
 */
export interface QuotaUsageDetail {
  modelCode: string;
  usage: number;
}

/**
 * Quota limit item from API
 */
export interface QuotaLimit {
  type: string; // "TIME_LIMIT" | "TOKENS_LIMIT"
  unit: number;
  number: number;
  usage: number;
  currentValue: number;
  remaining: number;
  percentage: number;
  usageDetails?: QuotaUsageDetail[];
  nextResetTime?: number;
}

/**
 * Quota limit API response
 */
export interface QuotaLimitResponse {
  code: number;
  msg: string;
  data: {
    limits: QuotaLimit[];
  };
  success: boolean;
}

/**
 * Model usage total summary
 */
export interface ModelUsageTotal {
  totalModelCallCount: number;
  totalTokensUsage: number;
}

/**
 * Model usage API response
 */
export interface ModelUsageResponse {
  code: number;
  msg: string;
  data: {
    x_time: string[]; // Time series labels (e.g., "2026-01-21 12:00")
    modelCallCount: number[]; // Model call counts per time period
    tokensUsage: number[]; // Token usage per time period
    totalUsage: ModelUsageTotal;
  };
  success: boolean;
}

/**
 * Tool usage detail item
 */
export interface ToolUsageDetail {
  modelName: string;
  totalUsageCount: number;
}

/**
 * Tool usage total summary
 */
export interface ToolUsageTotal {
  totalNetworkSearchCount: number;
  totalWebReadMcpCount: number;
  totalZreadMcpCount: number;
  totalSearchMcpCount: number;
  toolDetails: ToolUsageDetail[];
}

/**
 * Tool usage API response
 */
export interface ToolUsageResponse {
  code: number;
  msg: string;
  data: {
    x_time: string[]; // Time series labels
    networkSearchCount: (number | null)[]; // Network search counts per time period
    webReadMcpCount: (number | null)[]; // Web read MCP counts per time period
    zreadMcpCount: (number | null)[]; // Zread MCP counts per time period
    totalUsage: ToolUsageTotal;
  };
  success: boolean;
}

/**
 * Context window information
 */
export interface ContextWindow {
  context_window_size: number;
  total_input_tokens: number;
  total_output_tokens?: number;
}

/**
 * Model information from session context
 */
export interface SessionModel {
  display_name: string;
}

/**
 * Session context from stdin JSON
 */
export interface SessionContext {
  model?: SessionModel;
  context_window?: ContextWindow;
}

/**
 * Internal usage data structure
 */
export interface UsageData {
  tokenPercent?: number;
  mcpPercent?: number;
  totalCost?: string;
  modelName?: string;
  timestamp?: number;
  nextResetTime?: number; // Token limit reset timestamp (ms)
  nextResetTimeStr?: string; // Formatted reset time string
  error?: string;
}

/**
 * Cache data structure
 */
export interface CacheData {
  data: UsageData;
  timestamp: number;
}

/**
 * Quota data result
 */
export interface QuotaData {
  tokenPercent: number;
  mcpPercent: number;
  nextResetTime?: number; // Token limit reset timestamp (ms)
  nextResetTimeStr?: string; // Formatted reset time string
}

/**
 * Model usage result
 */
export interface ModelUsageResult {
  totalCost: string;
  modelName: string;
  hasData: boolean;
}

/**
 * ANSI color name
 */
export type ColorName = "reset" | "orange" | "blue" | "green" | "yellow" | "gray" | "red";

/**
 * ANSI color codes mapping
 */
export interface Colors {
  reset: string;
  orange: string;
  blue: string;
  green: string;
  yellow: string;
  gray: string;
  red: string;
}
