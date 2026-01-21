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
 * Quota limit item from API
 */
export interface QuotaLimit {
  type: string;
  percentage: number;
}

/**
 * Quota limit API response
 */
export interface QuotaLimitResponse {
  data: {
    limits: QuotaLimit[];
  };
}

/**
 * Model usage item from API
 */
export interface ModelUsageItem {
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Model usage API response
 */
export interface ModelUsageResponse {
  data: {
    list: ModelUsageItem[];
  };
}

/**
 * Tool usage API response
 */
export interface ToolUsageResponse {
  data: {
    list: unknown[];
  };
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
