/**
 * Helper functions for extracting data from SessionContext
 */

import type { SessionContext } from "../types.js";

/**
 * Get model display name from session context
 * @param context - Session context object
 * @returns Model display name or undefined
 */
export function getModelName(context: SessionContext): string | undefined {
  return context.model?.display_name;
}

/**
 * Get current working directory name from session context
 * Returns the basename of the current directory path
 * @param context - Session context object
 * @returns Current directory name or undefined
 */
export function getCurrentDirName(context: SessionContext): string | undefined {
  const currentDir = context.workspace?.current_dir;
  if (!currentDir) return undefined;
  // Extract basename from the full path
  const parts = currentDir.split(/\/|\\/);
  return parts[parts.length - 1] || currentDir;
}

/**
 * Get context window size from session context
 * @param context - Session context object
 * @returns Context window size or undefined
 */
export function getContextWindowSize(context: SessionContext): number | undefined {
  return context.context_window?.context_window_size;
}

/**
 * Get total input tokens from session context
 * @param context - Session context object
 * @returns Total input tokens or undefined
 */
export function getInputTokens(context: SessionContext): number | undefined {
  return context.context_window?.total_input_tokens;
}

/**
 * Get total output tokens from session context
 * @param context - Session context object
 * @returns Total output tokens or undefined
 */
export function getOutputTokens(context: SessionContext): number | undefined {
  return context.context_window?.total_output_tokens;
}

/**
 * Get total tokens (input + output) from session context
 * @param context - Session context object
 * @returns Total tokens or undefined
 */
export function getTotalTokens(context: SessionContext): number | undefined {
  const input = context.context_window?.total_input_tokens;
  const output = context.context_window?.total_output_tokens;
  if (input === undefined) return undefined;
  return input + (output ?? 0);
}

/**
 * Get workspace current directory from session context
 * @param context - Session context object
 * @returns Workspace current directory or undefined
 */
export function getWorkspaceCurrentDir(context: SessionContext): string | undefined {
  return context.workspace?.current_dir;
}

/**
 * Get workspace project directory from session context
 * @param context - Session context object
 * @returns Workspace project directory or undefined
 */
export function getProjectDir(context: SessionContext): string | undefined {
  return context.workspace?.project_dir;
}

/**
 * Get version from session context
 * @param context - Session context object
 * @returns Version string or undefined
 */
export function getVersion(context: SessionContext): string | undefined {
  return context.version;
}

/**
 * Get total cost in USD from session context
 * @param context - Session context object
 * @returns Total cost in USD or undefined
 */
export function getCost(context: SessionContext): number | undefined {
  return context.cost?.total_cost_usd;
}

/**
 * Get total duration in milliseconds from session context
 * @param context - Session context object
 * @returns Total duration in milliseconds or undefined
 */
export function getDuration(context: SessionContext): number | undefined {
  return context.cost?.total_duration_ms;
}

/**
 * Get total lines added from session context
 * @param context - Session context object
 * @returns Total lines added or undefined
 */
export function getLinesAdded(context: SessionContext): number | undefined {
  return context.cost?.total_lines_added;
}

/**
 * Get total lines removed from session context
 * @param context - Session context object
 * @returns Total lines removed or undefined
 */
export function getLinesRemoved(context: SessionContext): number | undefined {
  return context.cost?.total_lines_removed;
}
