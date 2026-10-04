import { create } from "zustand";

export interface McpServerConfig {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  status: "connected" | "stubbed" | "configuring";
  transport: "stdio" | "sse";
  endpoint?: string;
}

export interface ChatToolsState {
  /** Master toggle for whether the model receives and uses any tools. */
  toolsEnabled: boolean;
  /** Granular toggles for each built-in tool category. */
  toolToggles: {
    web_search: boolean;
    notes: boolean;
    calendar: boolean;
    clipboard: boolean;
  };
  /** Master toggle for whether MCP servers are enabled. */
  mcpEnabled: boolean;
  /** List of configured/stubbed MCP servers. */
  mcpServers: McpServerConfig[];

  // Actions
  setToolsEnabled: (enabled: boolean) => void;
  setToolToggle: (toolId: keyof ChatToolsState["toolToggles"], enabled: boolean) => void;
  setMcpEnabled: (enabled: boolean) => void;
  setMcpServerToggle: (serverId: string, enabled: boolean) => void;
  addMcpServer: (server: McpServerConfig) => void;
  removeMcpServer: (serverId: string) => void;
}

const STORAGE_KEY = "openwhispr_chat_tools_v1";

const DEFAULT_MCP_SERVERS: McpServerConfig[] = [
  {
    id: "localwhispr-core",
    name: "Localwhispr Core",
    description: "Access local notes, audio, and transcript library via MCP",
    enabled: true,
    status: "stubbed",
    transport: "stdio",
  },
  {
    id: "filesystem-mcp",
    name: "Filesystem MCP",
    description: "Read, search, and inspect local project files and workspace directories",
    enabled: false,
    status: "stubbed",
    transport: "stdio",
  },
  {
    id: "github-mcp",
    name: "GitHub MCP",
    description: "Query repositories, issues, commits, and pull requests",
    enabled: false,
    status: "stubbed",
    transport: "sse",
    endpoint: "https://api.github.com/mcp",
  },
];

function loadSavedState(): Partial<ChatToolsState> {
  if (typeof window === "undefined" || !window.localStorage) return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return {
      toolsEnabled: typeof parsed.toolsEnabled === "boolean" ? parsed.toolsEnabled : true,
      toolToggles: {
        web_search: parsed.toolToggles?.web_search ?? true,
        notes: parsed.toolToggles?.notes ?? true,
        calendar: parsed.toolToggles?.calendar ?? true,
        clipboard: parsed.toolToggles?.clipboard ?? true,
      },
      mcpEnabled: typeof parsed.mcpEnabled === "boolean" ? parsed.mcpEnabled : false,
      mcpServers: Array.isArray(parsed.mcpServers) ? parsed.mcpServers : DEFAULT_MCP_SERVERS,
    };
  } catch {
    return {};
  }
}

function saveState(state: ChatToolsState) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        toolsEnabled: state.toolsEnabled,
        toolToggles: state.toolToggles,
        mcpEnabled: state.mcpEnabled,
        mcpServers: state.mcpServers,
      })
    );
  } catch {}
}

const saved = loadSavedState();

export const useChatToolsStore = create<ChatToolsState>((set, get) => ({
  toolsEnabled: saved.toolsEnabled ?? true,
  toolToggles: saved.toolToggles ?? {
    web_search: true,
    notes: true,
    calendar: true,
    clipboard: true,
  },
  mcpEnabled: saved.mcpEnabled ?? false,
  mcpServers: saved.mcpServers ?? DEFAULT_MCP_SERVERS,

  setToolsEnabled: (enabled: boolean) => {
    set({ toolsEnabled: enabled });
    saveState(get());
  },

  setToolToggle: (toolId, enabled) => {
    set((state) => ({
      toolToggles: {
        ...state.toolToggles,
        [toolId]: enabled,
      },
    }));
    saveState(get());
  },

  setMcpEnabled: (enabled: boolean) => {
    set({ mcpEnabled: enabled });
    saveState(get());
  },

  setMcpServerToggle: (serverId: string, enabled: boolean) => {
    set((state) => ({
      mcpServers: state.mcpServers.map((s) => (s.id === serverId ? { ...s, enabled } : s)),
    }));
    saveState(get());
  },

  addMcpServer: (server: McpServerConfig) => {
    set((state) => ({
      mcpServers: [...state.mcpServers.filter((s) => s.id !== server.id), server],
    }));
    saveState(get());
  },

  removeMcpServer: (serverId: string) => {
    set((state) => ({
      mcpServers: state.mcpServers.filter((s) => s.id !== serverId),
    }));
    saveState(get());
  },
}));
