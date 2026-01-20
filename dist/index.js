#!/usr/bin/env node

// src/statusline.mjs
import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
var __dirname = path.dirname(fileURLToPath(import.meta.url));
var CACHE_FILE = path.join(process.env.HOME || "~", ".claude", "zai-usage-cache.json");
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
var baseUrl = process.env.ANTHROPIC_BASE_URL || "";
var authToken = process.env.ANTHROPIC_AUTH_TOKEN || "";
var ANTHROPIC_DEFAULT_OPUS_MODEL = "GLM-4.7";
var ANTHROPIC_DEFAULT_SONNET_MODEL = "GLM-4.7";
var ANTHROPIC_DEFAULT_HAIKU_MODEL = "GLM-4.5-Air";
var platform = null;
var modelUsageUrl = null;
var toolUsageUrl = null;
var quotaLimitUrl = null;
if (baseUrl) {
  if (baseUrl.includes("api.z.ai")) {
    platform = "ZAI";
    const baseDomain = `${new URL(baseUrl).protocol}//${new URL(baseUrl).host}`;
    modelUsageUrl = `${baseDomain}/api/monitor/usage/model-usage`;
    toolUsageUrl = `${baseDomain}/api/monitor/usage/tool-usage`;
    quotaLimitUrl = `${baseDomain}/api/monitor/usage/quota/limit`;
  } else if (baseUrl.includes("open.bigmodel.cn") || baseUrl.includes("dev.bigmodel.cn")) {
    platform = "ZHIPU";
    const baseDomain = `${new URL(baseUrl).protocol}//${new URL(baseUrl).host}`;
    modelUsageUrl = `${baseDomain}/api/monitor/usage/model-usage`;
    toolUsageUrl = `${baseDomain}/api/monitor/usage/tool-usage`;
    quotaLimitUrl = `${baseDomain}/api/monitor/usage/quota/limit`;
  }
}
var loadCache = () => {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, "utf8");
      return JSON.parse(data);
    }
  } catch (e) {
  }
  return null;
};
var saveCache = (data) => {
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data));
  } catch (e) {
  }
};
var isCacheValid = (cache) => {
  if (!cache || !cache.timestamp) return false;
  return Date.now() - cache.timestamp < CACHE_DURATION;
};
var formatDateTime = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};
var httpsGet = (url, queryParams = "") => {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname + queryParams,
      method: "GET",
      headers: {
        "Authorization": authToken,
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
        } catch (e) {
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
};
var fetchUsageData = async () => {
  const cache = loadCache();
  if (isCacheValid(cache)) {
    return cache.data;
  }
  if (!authToken || !baseUrl || !modelUsageUrl) {
    return { error: "setup_required", modelName: "Opus", tokenPercent: 0, mcpPercent: 0, totalCost: "0.00" };
  }
  const now = /* @__PURE__ */ new Date();
  const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1e3);
  const startTime = formatDateTime(fiveHoursAgo);
  const endTime = formatDateTime(now);
  const queryParams = `?startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}`;
  try {
    const [modelUsage, toolUsage, quotaLimit] = await Promise.allSettled([
      httpsGet(modelUsageUrl, queryParams),
      httpsGet(toolUsageUrl, queryParams),
      httpsGet(quotaLimitUrl, "")
    ]);
    let tokenPercent = 0;
    let mcpPercent = 0;
    let totalCost = 0;
    let modelName = "Unknown";
    if (modelUsage.status === "fulfilled" && modelUsage.value.data) {
      const data = modelUsage.value.data;
      if (data.list && data.list.length > 0) {
        const totalTokens = data.list.reduce((sum, item) => sum + (item.totalTokens || 0), 0);
        tokenPercent = Math.min(100, Math.round(totalTokens / 1e5));
      }
    }
    if (toolUsage.status === "fulfilled" && toolUsage.value.data) {
      const data = toolUsage.value.data;
      if (data.list && data.list.length > 0) {
        mcpPercent = Math.min(100, Math.round(data.list.length * 5));
      }
    }
    if (quotaLimit.status === "fulfilled" && quotaLimit.value.data) {
      const limits = quotaLimit.value.data.limits || [];
      for (const limit of limits) {
        if (limit.type === "TOKENS_LIMIT") {
          tokenPercent = Math.round(limit.percentage || 0);
        }
        if (limit.type === "TIME_LIMIT") {
          mcpPercent = Math.round(limit.percentage || 0);
        }
      }
    }
    if (modelUsage.status === "fulfilled" && modelUsage.value.data) {
      const data = modelUsage.value.data;
      if (data.list && data.list.length > 0) {
        const totalInputTokens = data.list.reduce((sum, item) => sum + (item.inputTokens || 0), 0);
        const totalOutputTokens = data.list.reduce((sum, item) => sum + (item.outputTokens || 0), 0);
        totalCost = totalInputTokens / 1e6 * 3 + totalOutputTokens / 1e6 * 15;
        if (data.list[0].model) {
          modelName = data.list[0].model;
          if (modelName.includes("Opus")) modelName = ANTHROPIC_DEFAULT_OPUS_MODEL;
          else if (modelName.includes("Sonnet")) modelName = ANTHROPIC_DEFAULT_SONNET_MODEL;
          else if (modelName.includes("Haiku")) modelName = ANTHROPIC_DEFAULT_HAIKU_MODEL;
        }
      }
    }
    const result = {
      tokenPercent,
      mcpPercent,
      totalCost: totalCost.toFixed(2),
      modelName,
      timestamp: Date.now()
    };
    saveCache(result);
    return result;
  } catch (error) {
    return { error: "loading" };
  }
};
var formatOutput = (data, sessionContext) => {
  if (!data || data.error === "setup_required") {
    return `${colors.yellow}\u26A0\uFE0F Setup required${colors.reset}`;
  }
  if (data.error === "loading") {
    return `${colors.yellow}\u26A0\uFE0F Loading...${colors.reset}`;
  }
  let modelName = data.modelName;
  if (sessionContext?.model?.display_name) {
    const displayName = sessionContext.model.display_name;
    if (displayName.includes("Opus")) modelName = ANTHROPIC_DEFAULT_OPUS_MODEL;
    else if (displayName.includes("Sonnet")) modelName = ANTHROPIC_DEFAULT_SONNET_MODEL;
    else if (displayName.includes("Haiku")) modelName = ANTHROPIC_DEFAULT_HAIKU_MODEL;
  }
  const tokenStr = `${colors.orange}Token(5H): ${data.tokenPercent}%${colors.reset}`;
  const mcpStr = `${colors.blue}Tool(1M): ${data.mcpPercent}%${colors.reset}`;
  const costStr = `${colors.green}$${data.totalCost}${colors.reset}`;
  return `[${modelName}] ${tokenStr} | ${mcpStr} | ${costStr}`;
};
var main = async () => {
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
  } catch (e) {
  }
  const usageData = await fetchUsageData();
  console.log(formatOutput(usageData, sessionContext));
};
main().catch((error) => {
  console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
});
