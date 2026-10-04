import React, { useState, useEffect, useMemo } from "react";
import { Tooltip } from "../ui/tooltip";
import {
  estimateConversationTokens,
  formatTokensSigFigs,
  resolveModelContextLimit,
} from "../../utils/contextWindow";
import type { Message } from "./types";

interface ChatContextIndicatorProps {
  messages: Message[];
  effectiveModel: string;
  effectiveProvider: string;
  effectiveMode: string;
}

export function ChatContextIndicator({
  messages,
  effectiveModel,
  effectiveProvider,
  effectiveMode,
}: ChatContextIndicatorProps) {
  const [serverContextSize, setServerContextSize] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchStatus = async () => {
      try {
        if (effectiveMode === "local" || effectiveProvider === "local") {
          const status = await window.electronAPI?.llamaServerStatus?.();
          if (mounted && status?.running && status?.contextSize) {
            setServerContextSize(status.contextSize);
          }
        } else {
          if (mounted) setServerContextSize(null);
        }
      } catch {}
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 6000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [effectiveModel, effectiveProvider, effectiveMode]);

  const limitTokens = useMemo(() => {
    return resolveModelContextLimit(
      effectiveModel,
      effectiveProvider,
      effectiveMode,
      serverContextSize ?? undefined
    );
  }, [effectiveModel, effectiveProvider, effectiveMode, serverContextSize]);

  const usedTokens = useMemo(() => {
    return estimateConversationTokens(messages);
  }, [messages]);

  const percentage = Math.min(100, Math.round((usedTokens / limitTokens) * 100));
  const formattedUsed = formatTokensSigFigs(usedTokens);
  const formattedLimit = formatTokensSigFigs(limitTokens);

  // Dynamic bar color: normal (brand/primary), warning (amber), critical (rose)
  const barColor = useMemo(() => {
    if (percentage >= 85) return "bg-rose-500";
    if (percentage >= 70) return "bg-amber-500";
    return "bg-primary/80";
  }, [percentage]);

  const tooltipText = `Context Window: ${usedTokens.toLocaleString()} / ${limitTokens.toLocaleString()} tokens (${percentage}%)`;

  return (
    <Tooltip content={tooltipText}>
      <div
        className="flex items-center gap-2 select-none px-2 py-1 rounded-md hover:bg-muted/40 transition-colors cursor-default"
        title={tooltipText}
        aria-label={tooltipText}
      >
        <span className="text-xs font-mono tabular-nums font-medium text-muted-foreground hover:text-foreground transition-colors">
          {formattedUsed}/{formattedLimit}
        </span>
        <div
          className="w-14 sm:w-18 h-1.5 rounded-full bg-muted dark:bg-white/10 overflow-hidden relative"
          role="progressbar"
          aria-valuenow={usedTokens}
          aria-valuemin={0}
          aria-valuemax={limitTokens}
        >
          <div
            className={`h-full rounded-full transition-all duration-300 ${barColor}`}
            style={{ width: `${Math.max(4, Math.min(100, percentage))}%` }}
          />
        </div>
      </div>
    </Tooltip>
  );
}
