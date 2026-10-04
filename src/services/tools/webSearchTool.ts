import type { ToolDefinition, ToolResult } from "./ToolRegistry";
import { searchDuckDuckGo } from "./duckduckgo";

export const webSearchTool: ToolDefinition = {
  name: "web_search",
  description:
    "Search the web using DuckDuckGo for current information, facts, news, and live web pages. Returns relevant web results with titles, URLs, and snippet text.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query to look up on DuckDuckGo",
      },
      numResults: {
        type: "number",
        description: "Number of search results to return (default 5)",
      },
    },
    required: ["query"],
    additionalProperties: false,
  },
  readOnly: true,

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const query = args.query as string;
    const numResults = typeof args.numResults === "number" ? args.numResults : 5;

    try {
      let rawResults: any = null;
      if (typeof window !== "undefined" && window.electronAPI?.agentWebSearch) {
        const raw = await window.electronAPI.agentWebSearch(query, numResults);
        rawResults = Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : null;
      }

      if (!rawResults || rawResults.length === 0) {
        rawResults = await searchDuckDuckGo(query, numResults);
      }

      const results = Array.isArray(rawResults)
        ? rawResults.map(
            (r: { title?: string; url?: string; text?: string; publishedDate?: string }) => ({
              title: r.title || "",
              url: r.url || "",
              text: r.text ? r.text.slice(0, 500) : "",
              publishedDate: r.publishedDate || null,
            })
          )
        : [];

      return {
        success: true,
        data: results,
        displayText: `Found ${results.length} web result${results.length === 1 ? "" : "s"} for "${query}" via DuckDuckGo`,
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        displayText: `DuckDuckGo web search failed: ${(error as Error).message}`,
      };
    }
  },
};
