/**
 * GLM API Client Module
 * Provides reusable functions for calling GLM API endpoints
 */

import https from "node:https";
import type {
  ApiConfig,
  QuotaLimitResponse,
  ModelUsageListResponse,
  ToolUsageListResponse,
} from "../types.js";

/**
 * Default request timeout in milliseconds
 */
const DEFAULT_TIMEOUT = 2000;

/**
 * Supported GLM API domains
 */
const SUPPORTED_DOMAINS = [
  "api.z.ai",
  "open.bigmodel.cn",
  "dev.bigmodel.cn",
] as const;

/**
 * Builds API endpoint URLs from base URL
 * @param baseUrl - Base API URL (e.g., "https://api.z.ai")
 * @returns Object containing quota, model usage, and tool usage URLs
 * @throws Error if baseUrl is unsupported
 */
function buildApiUrls(baseUrl: string): {
  quotaLimitUrl: string;
  modelUsageUrl: string;
  toolUsageUrl: string;
} {
  const isSupported = SUPPORTED_DOMAINS.some((domain) =>
    baseUrl.includes(domain)
  );

  if (!isSupported) {
    throw new Error(
      `Unsupported baseUrl. Supported domains: ${SUPPORTED_DOMAINS.join(", ")}`
    );
  }

  const baseDomain = `${new URL(baseUrl).protocol}//${new URL(baseUrl).host}`;

  return {
    quotaLimitUrl: `${baseDomain}/api/monitor/usage/quota/limit`,
    modelUsageUrl: `${baseDomain}/api/monitor/usage/model-usage`,
    toolUsageUrl: `${baseDomain}/api/monitor/usage/tool-usage`,
  };
}

/**
 * Creates an API configuration object from environment variables
 * @param baseUrl - Base API URL from ANTHROPIC_BASE_URL
 * @param authToken - Authentication token from ANTHROPIC_AUTH_TOKEN
 * @param timeout - Optional request timeout in milliseconds (default: 2000)
 * @returns API configuration object or null if baseUrl is unsupported
 */
export function buildApiConfig(
  baseUrl: string,
  authToken: string,
  timeout?: number
): ApiConfig | null {
  if (!baseUrl || !authToken) {
    return null;
  }

  try {
    const urls = buildApiUrls(baseUrl);
    return {
      ...urls,
      authToken,
      timeout: timeout ?? DEFAULT_TIMEOUT,
    };
  } catch {
    return null;
  }
}

/**
 * Makes an HTTPS GET request with timeout
 * @param url - Request URL
 * @param authToken - Authorization token
 * @param queryParams - Optional query parameters string (e.g., "?startTime=...")
 * @param timeout - Request timeout in milliseconds
 * @returns Parsed JSON response
 * @throws Error on request failure or timeout
 */
function httpsGet<T = unknown>(
  url: string,
  authToken: string,
  queryParams: string = "",
  timeout: number = DEFAULT_TIMEOUT
): Promise<T> {
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
      res.on("data", (chunk: Buffer) => {
        data += chunk;
      });
      res.on("end", () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        try {
          resolve(JSON.parse(data) as T);
        } catch {
          reject(new Error("Invalid JSON response"));
        }
      });
    });

    req.on("error", reject);

    // Timeout
    const timeoutId = setTimeout(() => {
      req.destroy();
      reject(new Error("Request timeout"));
    }, timeout);

    req.on("close", () => {
      clearTimeout(timeoutId);
    });

    req.end();
  });
}

/**
 * Formats a Date as yyyy-MM-dd HH:mm:ss
 * @param date - Date to format
 * @returns Formatted date string
 */
export function formatDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Fetches quota limit data from the API
 * @param config - API configuration
 * @returns Quota limit response data
 * @throws Error on request failure
 */
export async function getQuotaLimit(config: ApiConfig): Promise<QuotaLimitResponse> {
  return httpsGet(config.quotaLimitUrl, config.authToken, "", config.timeout);
}

/**
 * Fetches model usage data from the API
 * @param config - API configuration
 * @param startTime - Start time in format "yyyy-MM-dd HH:mm:ss"
 * @param endTime - End time in format "yyyy-MM-dd HH:mm:ss"
 * @returns Model usage response data
 * @throws Error on request failure
 */
export async function getModelUsage(
  config: ApiConfig,
  startTime: string,
  endTime: string
): Promise<ModelUsageListResponse> {
  const queryParams = `?startTime=${encodeURIComponent(
    startTime
  )}&endTime=${encodeURIComponent(endTime)}`;
  return httpsGet(config.modelUsageUrl, config.authToken, queryParams, config.timeout);
}

/**
 * Fetches tool usage data from the API
 * @param config - API configuration
 * @param startTime - Start time in format "yyyy-MM-dd HH:mm:ss"
 * @param endTime - End time in format "yyyy-MM-dd HH:mm:ss"
 * @returns Tool usage response data
 * @throws Error on request failure
 */
export async function getToolUsage(
  config: ApiConfig,
  startTime: string,
  endTime: string
): Promise<ToolUsageListResponse> {
  const queryParams = `?startTime=${encodeURIComponent(
    startTime
  )}&endTime=${encodeURIComponent(endTime)}`;
  return httpsGet(config.toolUsageUrl, config.authToken, queryParams, config.timeout);
}
