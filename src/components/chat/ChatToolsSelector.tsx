import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Toggle } from "../ui/toggle";
import {
  Wrench,
  Globe,
  FileText,
  Calendar,
  Copy,
  Server,
  Plus,
  CheckCircle2,
  AlertTriangle,
} from "../icons";
import { cn } from "../lib/utils";
import { useChatToolsStore, type McpServerConfig } from "../../stores/chatToolsStore";
import { modelToolCapability } from "../../models/ModelRegistry";
import { useToast } from "../ui/useToast";

interface ChatToolsSelectorProps {
  effectiveModel: string;
  effectiveProvider: string;
  effectiveMode?: string;
  className?: string;
}

export function ChatToolsSelector({
  effectiveModel,
  effectiveProvider,
  effectiveMode,
  className = "",
}: ChatToolsSelectorProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const {
    toolsEnabled,
    toolToggles,
    mcpEnabled,
    mcpServers,
    setToolsEnabled,
    setToolToggle,
    setMcpEnabled,
    setMcpServerToggle,
  } = useChatToolsStore();

  const toolCapability = modelToolCapability(effectiveModel, effectiveProvider, effectiveMode);

  // Count active tools
  const activeToolCount = Object.values(toolToggles).filter(Boolean).length;
  const activeMcpCount = mcpServers.filter((s) => s.enabled).length;

  const handleAddMcpServer = () => {
    toast({
      title: "MCP Server Setup (Preview)",
      description:
        "Full MCP transport configuration (stdio/SSE) is stubbed out for now and will be available in an upcoming update.",
      duration: 3500,
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors select-none",
            "border-border/80 bg-background/50 hover:bg-accent/50 hover:text-accent-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/10",
            toolsEnabled && (activeToolCount > 0 || (mcpEnabled && activeMcpCount > 0))
              ? "text-foreground"
              : "text-muted-foreground",
            className
          )}
          title="Toggle chat tools and MCP servers"
        >
          <Wrench size={13} className="shrink-0 text-muted-foreground" />
          <span>Tools</span>
          {toolsEnabled ? (
            <span className="inline-flex items-center justify-center rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              {activeToolCount + (mcpEnabled ? activeMcpCount : 0)}
            </span>
          ) : (
            <span className="inline-flex items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              Off
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-84 sm:w-96 max-h-[85vh] overflow-y-auto p-3.5 space-y-3.5 text-xs text-foreground"
      >
        {/* Header & Master Tool Toggle */}
        <div className="flex items-center justify-between pb-2 border-b border-border/60 dark:border-white/10">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Wrench size={14} />
            </span>
            <div>
              <h4 className="font-semibold text-sm leading-none">Chat Tools</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Enable agent tools for web search, library & more
              </p>
            </div>
          </div>
          <Toggle
            checked={toolsEnabled}
            onChange={setToolsEnabled}
            ariaLabel="Toggle chat tools"
          />
        </div>

        {/* Model Finetuning / Capability Callout */}
        <div
          className={cn(
            "rounded-lg border p-2.5 space-y-1 transition-colors",
            toolCapability.quality === "optimal"
              ? "border-emerald-500/25 bg-emerald-500/5 text-emerald-900 dark:text-emerald-200"
              : "border-amber-500/25 bg-amber-500/5 text-amber-900 dark:text-amber-200"
          )}
        >
          <div className="flex items-center gap-1.5 font-medium text-xs">
            {toolCapability.quality === "optimal" ? (
              <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle size={13} className="text-amber-600 dark:text-amber-400 shrink-0" />
            )}
            <span className="truncate">
              Model: <span className="font-semibold">{effectiveModel}</span>
            </span>
          </div>
          <p className="text-[11px] opacity-90 leading-relaxed">
            {toolCapability.details}
          </p>
        </div>

        {/* Built-in Tools List */}
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Built-in Tools
          </div>

          <div
            className={cn(
              "space-y-2 transition-opacity",
              !toolsEnabled && "opacity-40 pointer-events-none"
            )}
          >
            {/* Web Search Tool */}
            <div className="flex items-start justify-between gap-2.5 rounded-lg border border-border/50 bg-card/60 p-2.5 dark:border-white/5">
              <div className="flex gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 mt-0.5">
                  <Globe size={13} />
                </span>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-xs">Web Search & Reader</span>
                    <span className="rounded bg-blue-500/15 px-1 py-0.2 text-[9px] font-semibold text-blue-700 dark:text-blue-300">
                      DuckDuckGo + Markdown
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-normal">
                    DuckDuckGo search and clean Markdown web page reader for in-depth facts and citations.
                  </p>
                </div>
              </div>
              <Toggle
                checked={toolToggles.web_search}
                onChange={(val) => setToolToggle("web_search", val)}
                disabled={!toolsEnabled}
                ariaLabel="Toggle DuckDuckGo web search"
              />
            </div>

            {/* Notes & Knowledge */}
            <div className="flex items-start justify-between gap-2.5 rounded-lg border border-border/50 bg-card/60 p-2.5 dark:border-white/5">
              <div className="flex gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 mt-0.5">
                  <FileText size={13} />
                </span>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-xs">Workspace Notes</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-normal">
                    Search, view, create, and update notes and folders in your library.
                  </p>
                </div>
              </div>
              <Toggle
                checked={toolToggles.notes}
                onChange={(val) => setToolToggle("notes", val)}
                disabled={!toolsEnabled}
                ariaLabel="Toggle workspace notes tool"
              />
            </div>

            {/* Calendar & Schedule */}
            <div className="flex items-start justify-between gap-2.5 rounded-lg border border-border/50 bg-card/60 p-2.5 dark:border-white/5">
              <div className="flex gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mt-0.5">
                  <Calendar size={13} />
                </span>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-xs">Calendar & Availability</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-normal">
                    Look up upcoming meetings and calculate free calendar slots.
                  </p>
                </div>
              </div>
              <Toggle
                checked={toolToggles.calendar}
                onChange={(val) => setToolToggle("calendar", val)}
                disabled={!toolsEnabled}
                ariaLabel="Toggle calendar tool"
              />
            </div>

            {/* Clipboard & Snippets */}
            <div className="flex items-start justify-between gap-2.5 rounded-lg border border-border/50 bg-card/60 p-2.5 dark:border-white/5">
              <div className="flex gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 mt-0.5">
                  <Copy size={13} />
                </span>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-xs">Clipboard & Snippets</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-normal">
                    Copy output to clipboard and read or update quick snippets.
                  </p>
                </div>
              </div>
              <Toggle
                checked={toolToggles.clipboard}
                onChange={(val) => setToolToggle("clipboard", val)}
                disabled={!toolsEnabled}
                ariaLabel="Toggle clipboard tool"
              />
            </div>
          </div>
        </div>

        {/* MCP Servers Section */}
        <div className="pt-2 border-t border-border/60 dark:border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Server size={12} />
              </span>
              <span className="font-semibold text-xs">MCP Servers</span>
              <span className="rounded bg-muted px-1.5 py-0.2 text-[9px] font-semibold text-muted-foreground">
                Stubbed
              </span>
            </div>
            <Toggle
              checked={mcpEnabled}
              onChange={setMcpEnabled}
              ariaLabel="Toggle MCP servers"
            />
          </div>
          <p className="text-[11px] text-muted-foreground leading-normal">
            Model Context Protocol connectors for local processes and external tools.
          </p>

          <div
            className={cn(
              "space-y-2 transition-opacity",
              !mcpEnabled && "opacity-40 pointer-events-none"
            )}
          >
            {mcpServers.map((server) => (
              <div
                key={server.id}
                className="flex items-start justify-between gap-2.5 rounded-lg border border-border/50 bg-card/60 p-2.5 dark:border-white/5"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-xs">{server.name}</span>
                    <span className="text-[9px] font-mono text-muted-foreground">
                      ({server.transport})
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-normal">
                    {server.description}
                  </p>
                </div>
                <Toggle
                  checked={server.enabled}
                  onChange={(val) => setMcpServerToggle(server.id, val)}
                  disabled={!mcpEnabled}
                  ariaLabel={`Toggle ${server.name}`}
                />
              </div>
            ))}

            <button
              type="button"
              onClick={handleAddMcpServer}
              disabled={!mcpEnabled}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/80 py-2 text-xs font-medium text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
            >
              <Plus size={13} />
              <span>Add MCP Server</span>
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
