import type { ToolDefinition, ToolResult } from "./ToolRegistry";

export const fetchWebPageTool: ToolDefinition = {
  name: "fetch_web_page",
  description:
    "Fetch the full content of a web page URL and return it as clean, readable markdown. Use this tool when you need full article text, documentation, or detailed information from a specific URL or web search result.",
  parameters: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "The HTTP or HTTPS URL of the webpage to fetch",
      },
    },
    required: ["url"],
    additionalProperties: false,
  },
  readOnly: true,

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const rawUrl = typeof args.url === "string" ? args.url.trim() : "";
    if (!rawUrl) {
      return {
        success: false,
        data: null,
        displayText: "Invalid or missing URL for fetch_web_page",
      };
    }

    try {
      if (typeof window !== "undefined" && window.electronAPI?.agentFetchWebPage) {
        const result = await window.electronAPI.agentFetchWebPage(rawUrl);
        if (result.success && result.markdown) {
          const displayTitle = result.title || rawUrl;
          return {
            success: true,
            data: result.markdown,
            displayText: `Fetched "${displayTitle}"`,
          };
        }
        return {
          success: false,
          data: null,
          displayText: `Failed to fetch webpage: ${result.error || "Unknown error"}`,
        };
      }

      // Fallback in case IPC is unavailable in web-only testing environments
      const res = await fetch(rawUrl);
      const text = await res.text();
      return {
        success: true,
        data: text.slice(0, 4000),
        displayText: `Fetched raw page content from ${rawUrl}`,
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        displayText: `Error fetching webpage: ${(error as Error).message}`,
      };
    }
  },
};
