import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from "../ui/select";
import { Cpu, Cloud, Sparkles, Eye } from "../icons";
import { cn } from "../lib/utils";
import { modelRegistry, modelSupportsVision } from "../../models/ModelRegistry";
import { useSettingsStore, selectResolvedLLMConfig } from "../../stores/settingsStore";
import { useModelDownload, LOCAL_MODELS_CHANGED_EVENT } from "../../hooks/useModelDownload";
import { DownloadProgressBar } from "../ui/DownloadProgressBar";
import type { InferenceMode } from "../../types/electron";

export interface ChatModelOverride {
  modelId: string;
  providerId: string;
  mode: InferenceMode;
  name: string;
  supportsVision: boolean;
}

interface ChatModelSelectorProps {
  override: ChatModelOverride | null;
  onOverrideChange: (override: ChatModelOverride | null) => void;
  className?: string;
}

export function ChatModelSelector({
  override,
  onOverrideChange,
  className = "",
}: ChatModelSelectorProps) {
  const { t } = useTranslation();
  const settings = useSettingsStore();
  const [downloadedSet, setDownloadedSet] = useState<Set<string>>(new Set());
  const [visionDownloadedSet, setVisionDownloadedSet] = useState<Set<string>>(new Set());
  const { downloads, downloadModel } = useModelDownload({ modelType: "llm" });

  const globalConfig = useMemo(
    () => selectResolvedLLMConfig(settings, "chatIntelligence"),
    [settings]
  );
  const globalSupportsVision = useMemo(() => {
    const isLocal = globalConfig.mode === "local" || globalConfig.provider === "local";
    if (isLocal) {
      return (
        modelSupportsVision(globalConfig.model, globalConfig.provider) &&
        visionDownloadedSet.has(globalConfig.model)
      );
    }
    return modelSupportsVision(globalConfig.model, globalConfig.provider);
  }, [globalConfig.mode, globalConfig.model, globalConfig.provider, visionDownloadedSet]);

  const loadDownloadedModels = useCallback(async () => {
    try {
      const result = await window.electronAPI?.modelGetAll?.();
      if (Array.isArray(result)) {
        const set = new Set(
          result.filter((m: { isDownloaded?: boolean }) => m.isDownloaded).map((m: { id: string }) => m.id)
        );
        const visionSet = new Set(
          result.filter((m: { isVisionDownloaded?: boolean }) => m.isVisionDownloaded).map((m: { id: string }) => m.id)
        );
        setDownloadedSet(set);
        setVisionDownloadedSet(visionSet);
      }
    } catch {
      // fallback
    }
  }, []);

  useEffect(() => {
    loadDownloadedModels();
    window.addEventListener(LOCAL_MODELS_CHANGED_EVENT, loadDownloadedModels);
    return () => window.removeEventListener(LOCAL_MODELS_CHANGED_EVENT, loadDownloadedModels);
  }, [loadDownloadedModels]);

  const localModels = useMemo(() => {
    return modelRegistry.getAllModels();
  }, []);

  const cloudModels = useMemo(() => {
    const list: Array<{
      id: string;
      name: string;
      providerId: string;
      mode: InferenceMode;
      supportsVision: boolean;
    }> = [];

    const cloudProviders = modelRegistry.getCloudProviders();
    for (const cp of cloudProviders) {
      for (const m of cp.models) {
        list.push({
          id: m.id,
          name: `${cp.name} - ${m.name}`,
          providerId: cp.id,
          mode: cp.id === "openwhispr" ? "openwhispr" : "providers",
          supportsVision: !!m.supportsVision,
        });
      }
    }
    return list;
  }, []);

  const currentValue = override
    ? `${override.mode}:${override.providerId}:${override.modelId}`
    : "default";

  const effectiveDisplayName = useMemo(() => {
    if (!override) {
      const localName = localModels.find((m) => m.id === globalConfig.model)?.name;
      const cloudName = cloudModels.find((m) => m.id === globalConfig.model)?.name;
      return localName || cloudName || globalConfig.model || t("chat.defaultModel", "Settings Default");
    }
    return override.name;
  }, [override, globalConfig.model, localModels, cloudModels, t]);

  const effectiveSupportsVision = useMemo(() => {
    if (!override) return globalSupportsVision;
    if (override.mode === "local" || override.providerId === "local") {
      return override.supportsVision && visionDownloadedSet.has(override.modelId);
    }
    return override.supportsVision;
  }, [override, globalSupportsVision, visionDownloadedSet]);

  const handleValueChange = useCallback(
    (value: string) => {
      if (value === "default") {
        onOverrideChange(null);
        return;
      }

      const parts = value.split(":");
      const mode = parts[0] as InferenceMode;
      const providerId = parts[1];
      const modelId = parts.slice(2).join(":");

      if (mode === "local") {
        const found = localModels.find((m) => m.id === modelId);
        const name = found?.name || modelId;
        const supportsVision = found?.supportsVision ?? modelSupportsVision(modelId, providerId);

        if (!downloadedSet.has(modelId)) {
          downloadModel(modelId, () => {
            loadDownloadedModels();
          });
        }

        onOverrideChange({
          modelId,
          providerId,
          mode,
          name,
          supportsVision,
        });
      } else {
        const found = cloudModels.find((m) => m.id === modelId && m.providerId === providerId);
        const name = found?.name || modelId;
        const supportsVision = found?.supportsVision ?? modelSupportsVision(modelId, providerId);

        onOverrideChange({
          modelId,
          providerId,
          mode,
          name,
          supportsVision,
        });
      }
    },
    [onOverrideChange, localModels, cloudModels, downloadedSet, downloadModel, loadDownloadedModels]
  );

  const activeDownloads = useMemo(() => Object.entries(downloads), [downloads]);

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-center gap-2">
        <Select value={currentValue} onValueChange={handleValueChange}>
          <SelectTrigger className="h-7 w-auto min-w-[160px] max-w-[280px] rounded-lg border-border/80 bg-background/50 px-2 py-0.5 text-xs font-medium dark:border-white/10 dark:bg-surface-2/60">
            <div className="flex items-center gap-1.5 truncate">
              {override ? (
                override.mode === "local" ? (
                  <Cpu size={12} className="text-muted-foreground shrink-0" />
                ) : (
                  <Cloud size={12} className="text-muted-foreground shrink-0" />
                )
              ) : (
                <Sparkles size={12} className="text-primary shrink-0" />
              )}
              <span className="truncate max-w-[150px]">{effectiveDisplayName}</span>
              {effectiveSupportsVision && (
                <span className="inline-flex items-center gap-0.5 rounded px-1 py-0 text-[10px] font-semibold bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 shrink-0">
                  <Eye size={9} />
                  Vision
                </span>
              )}
            </div>
          </SelectTrigger>
          <SelectContent className="max-h-80 w-[310px]">
            <SelectGroup>
              <SelectLabel className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
                {t("common.default", "Default")}
              </SelectLabel>
              <SelectItem value="default" className="text-xs py-1.5 cursor-pointer">
                <div className="flex items-center justify-between w-full gap-2">
                  <div className="flex items-center gap-1.5 truncate">
                    <Sparkles size={13} className="text-primary shrink-0" />
                    <span className="truncate font-medium">
                      {t("chat.defaultModel", "Settings Default")} ({globalConfig.model || "Default"})
                    </span>
                  </div>
                  {globalSupportsVision && (
                    <span className="inline-flex items-center gap-0.5 rounded px-1 text-[9px] font-semibold bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 shrink-0">
                      <Eye size={8} /> Vision
                    </span>
                  )}
                </div>
              </SelectItem>
            </SelectGroup>

            <SelectGroup>
              <SelectLabel className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1 mt-1 border-t border-border/50">
                {t("common.local", "Local Models")}
              </SelectLabel>
              {localModels.map((m) => {
                const isDownloaded = downloadedSet.has(m.id);
                const hasVision = !!m.supportsVision;
                const isVisionDownloaded = visionDownloadedSet.has(m.id);
                return (
                  <SelectItem
                    key={`local:${m.providerId}:${m.id}`}
                    value={`local:${m.providerId}:${m.id}`}
                    className="text-xs py-1.5 cursor-pointer"
                  >
                    <div className="flex items-center justify-between w-full gap-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <Cpu size={13} className="text-muted-foreground shrink-0" />
                        <span className="truncate">{m.name}</span>
                        <span className="text-[10px] text-muted-foreground/70 shrink-0">{m.size}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {hasVision && (
                          <span
                            className={cn(
                              "inline-flex items-center gap-0.5 rounded px-1 text-[9px] font-semibold border",
                              isVisionDownloaded
                                ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30"
                                : "text-muted-foreground/60 border-border/40"
                            )}
                            title={isVisionDownloaded ? "Vision add-on active" : "Vision add-on available in Settings"}
                          >
                            <Eye size={8} /> {isVisionDownloaded ? "Vision" : "+Vision"}
                          </span>
                        )}
                        {!isDownloaded && (
                          <span className="text-[9px] text-amber-600 dark:text-amber-400 font-medium">
                            (Download)
                          </span>
                        )}
                      </div>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectGroup>

            {cloudModels.length > 0 && (
              <SelectGroup>
                <SelectLabel className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1 mt-1 border-t border-border/50">
                  {t("common.cloud", "Cloud Models")}
                </SelectLabel>
                {cloudModels.map((m) => {
                  const hasVision = !!m.supportsVision;
                  return (
                    <SelectItem
                      key={`${m.mode}:${m.providerId}:${m.id}`}
                      value={`${m.mode}:${m.providerId}:${m.id}`}
                      className="text-xs py-1.5 cursor-pointer"
                    >
                      <div className="flex items-center justify-between w-full gap-2">
                        <div className="flex items-center gap-1.5 truncate">
                          <Cloud size={13} className="text-muted-foreground shrink-0" />
                          <span className="truncate">{m.name}</span>
                        </div>
                        {hasVision && (
                          <span className="inline-flex items-center gap-0.5 rounded px-1 text-[9px] font-semibold bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 shrink-0">
                            <Eye size={8} /> Vision
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
      </div>

      {activeDownloads.length > 0 && (
        <div className="w-full max-w-xs space-y-1">
          {activeDownloads.map(([modelId, status]) => (
            <DownloadProgressBar
              key={modelId}
              modelName={localModels.find((m) => m.id === modelId)?.name || modelId}
              progress={{
                percentage: status.progress,
                downloadedBytes: status.downloadedBytes,
                totalBytes: status.totalBytes,
              }}
              isInstalling={status.phase === "installing"}
            />
          ))}
        </div>
      )}
    </div>
  );
}
