/**
 * Model name mapping utility
 * Maps Anthropic model names to GLM model names
 */

const ANTHROPIC_DEFAULT_OPUS_MODEL = "GLM-4.7";
const ANTHROPIC_DEFAULT_SONNET_MODEL = "GLM-4.7";
const ANTHROPIC_DEFAULT_HAIKU_MODEL = "GLM-4.5-Air";

/**
 * Maps Anthropic model name to GLM model name
 * @param modelName - The model name to map
 * @returns The mapped model name
 */
export function mapModelName(modelName: string): string {
  if (!modelName) {
    return modelName;
  }
  if (modelName.includes("Opus")) return ANTHROPIC_DEFAULT_OPUS_MODEL;
  if (modelName.includes("Sonnet")) return ANTHROPIC_DEFAULT_SONNET_MODEL;
  if (modelName.includes("Haiku")) return ANTHROPIC_DEFAULT_HAIKU_MODEL;
  return modelName;
}
