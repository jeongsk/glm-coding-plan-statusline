/**
 * Z.ai/ZHIPU Usage Statusline Display
 * Displays real-time usage information in Claude Code statusline
 *
 * Features:
 * - Async API calls with caching (5-second intervals)
 * - ANSI color codes for visual distinction
 * - One-line output format
 */

import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { mapModelName } from "./utils/modelMapper.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Reads Claude environment variables from settings files
 * Priority: .claude/settings.local.json > .claude/settings.json > ~/.claude/settings.json
 * @param {string} projectDir - Project directory (defaults to current working directory)
 * @returns {Object|null} Environment variables object or null if not found
 */
const getClaudeEnv = (projectDir = process.cwd()) => {
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  if (!homeDir) {
    return null; // Cannot determine home directory
  }

  const candidates = [
    path.join(projectDir, ".claude", "settings.local.json"), // 최우선 (git ignored)
    path.join(projectDir, ".claude", "settings.json"), // 프로젝트 레벨
    path.join(homeDir, ".claude", "settings.json"), // 전역 설정
  ];

  for (const filePath of candidates) {
    try {
      const content = fs.readFileSync(filePath, "utf8");
      const config = JSON.parse(content);
      if (config.env && typeof config.env === "object") {
        // Validate and extract only string environment variables
        const env = {};
        if (typeof config.env.ANTHROPIC_BASE_URL === "string") {
          env.ANTHROPIC_BASE_URL = config.env.ANTHROPIC_BASE_URL;
        }
        if (typeof config.env.ANTHROPIC_AUTH_TOKEN === "string") {
          env.ANTHROPIC_AUTH_TOKEN = config.env.ANTHROPIC_AUTH_TOKEN;
        }
        if (Object.keys(env).length > 0) {
          return env;
        }
      }
    } catch (err) {
      // Log error if file exists but cannot be read/parsed
      try {
        if (fs.existsSync(filePath)) {
          console.error(`Warning: Failed to read ${filePath}: ${err.message}`);
        }
      } catch {
        // Ignore stat errors
      }
    }
  }

  return null;
};

// Configuration
const CACHE_FILE = path.join(
  process.env.HOME || "~",
  ".claude",
  "zai-usage-cache.json",
);
const CACHE_DURATION = 5000; // 5 seconds
const REQUEST_TIMEOUT = 2000; // 2 seconds

// ANSI Color codes
const colors = {
  reset: "\x1b[0m",
  orange: "\x1b[38;5;208m",
  blue: "\x1b[38;5;39m",
  green: "\x1b[38;5;76m",
  yellow: "\x1b[38;5;226m",
  gray: "\x1b[38;5;245m",
  red: "\x1b[38;5;196m",
};

// Read environment variables with fallback to Claude settings files
const claudeEnv = getClaudeEnv();
const baseUrl =
  process.env.ANTHROPIC_BASE_URL || claudeEnv?.ANTHROPIC_BASE_URL || "";
const authToken =
  process.env.ANTHROPIC_AUTH_TOKEN || claudeEnv?.ANTHROPIC_AUTH_TOKEN || "";

// Determine platform and endpoints
let platform = null;
let modelUsageUrl = null;
let toolUsageUrl = null;
let quotaLimitUrl = null;

if (baseUrl) {
  if (baseUrl.includes("api.z.ai")) {
    platform = "ZAI";
    const baseDomain = `${new URL(baseUrl).protocol}//${new URL(baseUrl).host}`;
    modelUsageUrl = `${baseDomain}/api/monitor/usage/model-usage`;
    toolUsageUrl = `${baseDomain}/api/monitor/usage/tool-usage`;
    quotaLimitUrl = `${baseDomain}/api/monitor/usage/quota/limit`;
  } else if (
    baseUrl.includes("open.bigmodel.cn") ||
    baseUrl.includes("dev.bigmodel.cn")
  ) {
    platform = "ZHIPU";
    const baseDomain = `${new URL(baseUrl).protocol}//${new URL(baseUrl).host}`;
    modelUsageUrl = `${baseDomain}/api/monitor/usage/model-usage`;
    toolUsageUrl = `${baseDomain}/api/monitor/usage/tool-usage`;
    quotaLimitUrl = `${baseDomain}/api/monitor/usage/quota/limit`;
  }
}

// Cache management
const loadCache = () => {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, "utf8");
      return JSON.parse(data);
    }
  } catch (e) {
    // Ignore cache errors
  }
  return null;
};

const saveCache = (data) => {
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data));
  } catch (e) {
    // Ignore cache errors
  }
};

const isCacheValid = (cache) => {
  if (!cache || !cache.timestamp) return false;
  return Date.now() - cache.timestamp < CACHE_DURATION;
};

// Format dates as yyyy-MM-dd HH:mm:ss
const formatDateTime = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

// HTTPS request with timeout
const httpsGet = (url, queryParams = "") => {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname + queryParams,
      method: "GET",
      headers: {
        Authorization: authToken,
        "Accept-Language": "en-US,en",
        "Content-Type": "application/json",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error("Invalid JSON response"));
        }
      });
    });

    req.on("error", reject);

    // Timeout
    setTimeout(() => {
      req.destroy();
      reject(new Error("Request timeout"));
    }, REQUEST_TIMEOUT);

    req.end();
  });
};

/**
 * Checks if cached data should be used
 * @returns {Object|null} Cached data if valid, null otherwise
 */
const shouldUseCache = () => {
  const cache = loadCache();
  if (isCacheValid(cache)) {
    return cache.data;
  }
  return null;
};

/**
 * Fetches quota limit data
 * @returns {Promise<Object>} Quota limit data with token and time percentages
 */
const fetchQuota = async () => {
  try {
    const result = await httpsGet(quotaLimitUrl, "");
    if (result?.data?.limits) {
      const limits = result.data.limits;
      let tokenPercent = 0;
      let mcpPercent = 0;
      for (const limit of limits) {
        if (limit.type === "TOKENS_LIMIT") {
          tokenPercent = Math.round(limit.percentage || 0);
        }
        if (limit.type === "TIME_LIMIT") {
          mcpPercent = Math.round(limit.percentage || 0);
        }
      }
      return { tokenPercent, mcpPercent };
    }
  } catch (e) {
    // Ignore quota errors
  }
  return { tokenPercent: 0, mcpPercent: 0 };
};

/**
 * Fetches model usage data and calculates cost
 * @param {string} queryParams - Query parameters for the API request
 * @returns {Promise<Object>} Model usage data with cost and model name
 */
const fetchModelUsage = async (queryParams) => {
  try {
    const result = await httpsGet(modelUsageUrl, queryParams);
    if (result?.data?.list && result.data.list.length > 0) {
      const list = result.data.list;

      // Calculate cost
      const totalInputTokens = list.reduce(
        (sum, item) => sum + (item.inputTokens || 0),
        0,
      );
      const totalOutputTokens = list.reduce(
        (sum, item) => sum + (item.outputTokens || 0),
        0,
      );
      // Opus pricing: $3/M input, $15/M output (approximate)
      const totalCost =
        (totalInputTokens / 1000000) * 3 + (totalOutputTokens / 1000000) * 15;

      // Get model name
      const rawModelName = list[0].model || "Unknown";
      const modelName = mapModelName(rawModelName);

      return {
        totalCost: totalCost.toFixed(2),
        modelName,
        hasData: true,
      };
    }
  } catch (e) {
    // Ignore model usage errors
  }
  return { totalCost: "0.00", modelName: "Unknown", hasData: false };
};

/**
 * Fetches tool usage data
 * @param {string} queryParams - Query parameters for the API request
 * @returns {Promise<number>} MCP usage percentage estimate
 */
const fetchToolUsage = async (queryParams) => {
  try {
    const result = await httpsGet(toolUsageUrl, queryParams);
    if (result?.data?.list && result.data.list.length > 0) {
      return Math.min(100, Math.round(result.data.list.length * 5)); // Rough estimate
    }
  } catch (e) {
    // Ignore tool usage errors
  }
  return 0;
};

/**
 * Fetches usage data with caching
 * Orchestrates quota, model usage, and tool usage API calls
 * @returns {Promise<Object>} Usage data with token, mcp, cost, and model info
 */
const fetchUsageData = async () => {
  // Check cache first
  const cachedData = shouldUseCache();
  if (cachedData) {
    return cachedData;
  }

  // Check environment
  if (!authToken || !baseUrl || !modelUsageUrl) {
    return {
      error: "setup_required",
      modelName: "Opus",
      tokenPercent: 0,
      mcpPercent: 0,
      totalCost: "0.00",
    };
  }

  // Time window: 5-hour window for token usage
  const now = new Date();
  const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000);

  const startTime = formatDateTime(fiveHoursAgo);
  const endTime = formatDateTime(now);
  const queryParams = `?startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}`;

  try {
    // Parallel requests using helper functions
    const [quotaData, modelUsageData, mcpPercent] = await Promise.allSettled([
      fetchQuota(),
      fetchModelUsage(queryParams),
      fetchToolUsage(queryParams),
    ]);

    // Extract quota data
    let tokenPercent = 0;
    let finalMcpPercent = 0;
    if (quotaData.status === "fulfilled") {
      tokenPercent = quotaData.value.tokenPercent;
      finalMcpPercent = quotaData.value.mcpPercent;
    }

    // If tool usage returned a value, use it
    if (mcpPercent.status === "fulfilled" && mcpPercent.value > 0) {
      finalMcpPercent = mcpPercent.value;
    }

    // Extract model usage data
    let totalCost = "0.00";
    let modelName = "Unknown";
    if (modelUsageData.status === "fulfilled") {
      totalCost = modelUsageData.value.totalCost;
      modelName = modelUsageData.value.modelName;
    }

    const result = {
      tokenPercent,
      mcpPercent: finalMcpPercent,
      totalCost,
      modelName,
      timestamp: Date.now(),
    };

    // Save to cache
    saveCache(result);

    return result;
  } catch (error) {
    return { error: "loading" };
  }
};

// Format output
const formatOutput = (data, sessionContext) => {
  if (!data || data.error === "setup_required") {
    return `${colors.yellow}⚠️ Setup required${colors.reset}`;
  }

  if (data.error === "loading") {
    return `${colors.yellow}⚠️ Loading...${colors.reset}`;
  }

  // Get model name from session context if available
  let modelName = data.modelName;
  if (sessionContext?.model?.display_name) {
    modelName = mapModelName(sessionContext.model.display_name);
  }

  // Format: [Model] Token usage(5H) | Tool(1M) | Cost
  const tokenStr = `${colors.orange}Token(5H):${data.tokenPercent}%${colors.reset}`;
  const mcpStr = `${colors.blue}Tool(1M):${data.mcpPercent}%${colors.reset}`;
  const costStr = `${colors.green}$${data.totalCost}${colors.reset}`;

  return `[${modelName}] ${tokenStr} | ${mcpStr} | ${costStr}`;
};

// Main execution
const main = async () => {
  // Read session context from stdin
  let sessionContext = {};
  try {
    const stdinData = await new Promise((resolve) => {
      let data = "";
      process.stdin.on("data", (chunk) => {
        data += chunk;
      });
      process.stdin.on("end", () => {
        resolve(data);
      });
      // Timeout for stdin
      setTimeout(() => {
        resolve("");
      }, 100);
    });
    if (stdinData) {
      sessionContext = JSON.parse(stdinData);
    }
  } catch (e) {
    // Ignore parse errors
  }

  // Fetch usage data
  const usageData = await fetchUsageData();

  // Output
  console.log(formatOutput(usageData, sessionContext));
};

main().catch((error) => {
  console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
});
