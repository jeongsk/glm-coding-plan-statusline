#!/usr/bin/env node

// src/statusline.ts
import https from "node:https";
import fs from "node:fs";
import path from "node:path";

// src/utils/modelMapper.ts
var ANTHROPIC_DEFAULT_OPUS_MODEL = "GLM-4.7";
var ANTHROPIC_DEFAULT_SONNET_MODEL = "GLM-4.7";
var ANTHROPIC_DEFAULT_HAIKU_MODEL = "GLM-4.5-Air";
function mapModelName(modelName) {
  if (!modelName) {
    return modelName;
  }
  if (modelName.includes("Opus")) return ANTHROPIC_DEFAULT_OPUS_MODEL;
  if (modelName.includes("Sonnet")) return ANTHROPIC_DEFAULT_SONNET_MODEL;
  if (modelName.includes("Haiku")) return ANTHROPIC_DEFAULT_HAIKU_MODEL;
  return modelName;
}

// src/statusline.ts
function getClaudeEnv(projectDir = process.cwd()) {
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  if (!homeDir) {
    return null;
  }
  const candidates = [
    path.join(projectDir, ".claude", "settings.local.json"),
    // 최우선 (git ignored)
    path.join(projectDir, ".claude", "settings.json"),
    // 프로젝트 레벨
    path.join(homeDir, ".claude", "settings.json")
    // 전역 설정
  ];
  for (const filePath of candidates) {
    try {
      const content = fs.readFileSync(filePath, "utf8");
      const config = JSON.parse(content);
      if (config.env && typeof config.env === "object") {
        const env = {};
        if (typeof config.env.ANTHROPIC_BASE_URL === "string") {
          env.ANTHROPIC_BASE_URL = config.env.ANTHROPIC_BASE_URL;
        }
        if (typeof config.env.ANTHROPIC_AUTH_TOKEN === "string") {
          env.ANTHROPIC_AUTH_TOKEN = config.env.ANTHROPIC_AUTH_TOKEN;
        }
        if (env.ANTHROPIC_BASE_URL !== void 0 && env.ANTHROPIC_AUTH_TOKEN !== void 0) {
          return env;
        }
      }
    } catch (err) {
      try {
        if (fs.existsSync(filePath)) {
          console.error(
            `Warning: Failed to read ${filePath}: ${err.message}`
          );
        }
      } catch {
      }
    }
  }
  return null;
}
var CACHE_FILE = path.join(
  process.env.HOME || "~",
  ".claude",
  "zai-usage-cache.json"
);
var CACHE_DURATION = 5e3;
var REQUEST_TIMEOUT = 2e3;
var colors = {
  reset: "\x1B[0m",
  orange: "\x1B[38;5;208m",
  blue: "\x1B[38;5;39m",
  green: "\x1B[38;5;76m",
  yellow: "\x1B[38;5;226m",
  gray: "\x1B[38;5;245m",
  red: "\x1B[38;5;196m"
};
var claudeEnv = getClaudeEnv();
var baseUrl = process.env.ANTHROPIC_BASE_URL || claudeEnv?.ANTHROPIC_BASE_URL || "";
var authToken = process.env.ANTHROPIC_AUTH_TOKEN || claudeEnv?.ANTHROPIC_AUTH_TOKEN || "";
var modelUsageUrl = null;
var toolUsageUrl = null;
var quotaLimitUrl = null;
var SUPPORTED_DOMAINS = [
  "api.z.ai",
  "open.bigmodel.cn",
  "dev.bigmodel.cn"
];
if (baseUrl) {
  const isSupported = SUPPORTED_DOMAINS.some(
    (domain) => baseUrl.includes(domain)
  );
  if (isSupported) {
    const baseDomain = `${new URL(baseUrl).protocol}//${new URL(baseUrl).host}`;
    modelUsageUrl = `${baseDomain}/api/monitor/usage/model-usage`;
    toolUsageUrl = `${baseDomain}/api/monitor/usage/tool-usage`;
    quotaLimitUrl = `${baseDomain}/api/monitor/usage/quota/limit`;
  } else {
    console.warn(
      `GLM Coding Plan Statusline: Unsupported baseUrl. Supported domains: ${SUPPORTED_DOMAINS.join(", ")}`
    );
  }
}
function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, "utf8");
      return JSON.parse(data);
    }
  } catch {
  }
  return null;
}
function saveCache(data) {
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data));
  } catch {
  }
}
function isCacheValid(cache) {
  if (!cache) return false;
  if (!cache.timestamp) return false;
  return Date.now() - cache.timestamp < CACHE_DURATION;
}
function formatDateTime(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
function httpsGet(url, queryParams = "") {
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
        "Content-Type": "application/json"
      }
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
        } catch {
          reject(new Error("Invalid JSON response"));
        }
      });
    });
    req.on("error", reject);
    setTimeout(() => {
      req.destroy();
      reject(new Error("Request timeout"));
    }, REQUEST_TIMEOUT);
    req.end();
  });
}
function shouldUseCache() {
  const cache = loadCache();
  if (cache && isCacheValid(cache)) {
    return cache.data;
  }
  return null;
}
function formatResetTime(timestamp) {
  const date = new Date(timestamp);
  const now = /* @__PURE__ */ new Date();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  if (date.toDateString() === now.toDateString()) {
    return `${hours}:${minutes}`;
  }
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}/${day} ${hours}:${minutes}`;
}
async function fetchQuota() {
  try {
    const result = await httpsGet(quotaLimitUrl, "");
    if (result && typeof result === "object" && "data" in result && result.data && typeof result.data === "object" && "limits" in result.data && Array.isArray(result.data.limits)) {
      const limits = result.data.limits;
      let tokenPercent = 0;
      let mcpPercent = 0;
      let nextResetTime;
      for (const limit of limits) {
        if (limit.type === "TOKENS_LIMIT") {
          tokenPercent = Math.round(limit.percentage || 0);
          nextResetTime = limit.nextResetTime;
        }
        if (limit.type === "TIME_LIMIT") {
          mcpPercent = Math.round(limit.percentage || 0);
        }
      }
      const nextResetTimeStr = nextResetTime ? formatResetTime(nextResetTime) : void 0;
      return { tokenPercent, mcpPercent, nextResetTime, nextResetTimeStr };
    }
  } catch {
  }
  return { tokenPercent: 0, mcpPercent: 0 };
}
async function fetchModelUsage(queryParams) {
  try {
    const result = await httpsGet(modelUsageUrl, queryParams);
    if (result && typeof result === "object" && "data" in result && result.data && typeof result.data === "object" && "list" in result.data && Array.isArray(result.data.list) && result.data.list.length > 0) {
      const list = result.data.list;
      const totalInputTokens = list.reduce(
        (sum, item) => sum + (item.inputTokens || 0),
        0
      );
      const totalOutputTokens = list.reduce(
        (sum, item) => sum + (item.outputTokens || 0),
        0
      );
      const totalCost = totalInputTokens / 1e6 * 3 + totalOutputTokens / 1e6 * 15;
      const rawModelName = list[0].model || "Unknown";
      const modelName = mapModelName(rawModelName);
      return {
        totalCost: totalCost.toFixed(2),
        modelName,
        hasData: true
      };
    }
  } catch {
  }
  return { totalCost: "0.00", modelName: "Unknown", hasData: false };
}
async function fetchToolUsage(queryParams) {
  try {
    const result = await httpsGet(toolUsageUrl, queryParams);
    if (result && typeof result === "object" && "data" in result && result.data && typeof result.data === "object" && "list" in result.data && Array.isArray(result.data.list) && result.data.list.length > 0) {
      return Math.min(100, Math.round(result.data.list.length * 5));
    }
  } catch {
  }
  return 0;
}
async function fetchUsageData() {
  const cachedData = shouldUseCache();
  if (cachedData) {
    return cachedData;
  }
  if (!authToken || !baseUrl || !modelUsageUrl) {
    return {
      error: "setup_required",
      modelName: "Opus",
      tokenPercent: 0,
      mcpPercent: 0,
      totalCost: "0.00"
    };
  }
  const now = /* @__PURE__ */ new Date();
  const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1e3);
  const startTime = formatDateTime(fiveHoursAgo);
  const endTime = formatDateTime(now);
  const queryParams = `?startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}`;
  try {
    const [quotaData, modelUsageData, mcpPercent] = await Promise.allSettled([
      fetchQuota(),
      fetchModelUsage(queryParams),
      fetchToolUsage(queryParams)
    ]);
    let tokenPercent = 0;
    let finalMcpPercent = 0;
    let nextResetTime;
    let nextResetTimeStr;
    if (quotaData.status === "fulfilled") {
      tokenPercent = quotaData.value.tokenPercent;
      finalMcpPercent = quotaData.value.mcpPercent;
      nextResetTime = quotaData.value.nextResetTime;
      nextResetTimeStr = quotaData.value.nextResetTimeStr;
    }
    if (mcpPercent.status === "fulfilled" && mcpPercent.value > 0) {
      finalMcpPercent = mcpPercent.value;
    }
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
      nextResetTime,
      nextResetTimeStr
    };
    saveCache(result);
    return result;
  } catch {
    return { error: "loading" };
  }
}
function renderProgressBar(percent, width = 10) {
  const filledWidth = Math.round(percent / 100 * width);
  const emptyWidth = width - filledWidth;
  const filled = "\u2588".repeat(filledWidth);
  const empty = "\u2591".repeat(emptyWidth);
  let color;
  if (percent >= 85) {
    color = colors.red;
  } else if (percent >= 60) {
    color = colors.yellow;
  } else {
    color = colors.green;
  }
  return `${color}${filled}${colors.gray}${empty} ${percent}%${colors.reset}`;
}
function calculateContextUsage(sessionContext) {
  const contextWindow = sessionContext?.context_window;
  if (!contextWindow?.context_window_size || !contextWindow?.total_input_tokens) {
    return 0;
  }
  return Math.round(
    contextWindow.total_input_tokens * 100 / contextWindow.context_window_size
  );
}
function formatOutput(data, sessionContext) {
  if (!data || data.error === "setup_required") {
    return `${colors.yellow}\u26A0\uFE0F Setup required${colors.reset}`;
  }
  if (data.error === "loading") {
    return `${colors.yellow}\u26A0\uFE0F Loading...${colors.reset}`;
  }
  let modelName = data.modelName ?? "Unknown";
  if (sessionContext?.model?.display_name) {
    modelName = mapModelName(sessionContext.model.display_name);
  }
  const contextPercent = calculateContextUsage(sessionContext);
  const contextBar = renderProgressBar(contextPercent);
  const tokenStr = `5h: ${data.tokenPercent ?? 0}%`;
  const mcpStr = `Tool: ${data.mcpPercent ?? 0}%`;
  const costStr = `$${data.totalCost ?? "0.00"}`;
  const resetStr = data.nextResetTimeStr ? `${colors.gray} | Reset: ${data.nextResetTimeStr}${colors.reset}` : "";
  return `[${modelName}] ${contextBar}${colors.gray} | ${tokenStr} | ${mcpStr} | ${costStr}${resetStr}${colors.reset}`;
}
async function main() {
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
      setTimeout(() => {
        resolve("");
      }, 100);
    });
    if (stdinData) {
      sessionContext = JSON.parse(stdinData);
    }
  } catch {
  }
  const usageData = await fetchUsageData();
  console.log(formatOutput(usageData, sessionContext));
}
main().catch((error) => {
  console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
});
