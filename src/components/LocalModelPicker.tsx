import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ProviderTabs } from "./ui/ProviderTabs";
import { DownloadProgressBar } from "./ui/DownloadProgressBar";
import { ConfirmDialog } from "./ui/dialog";
import ModelCardList, { type ModelCardOption } from "./ui/ModelCardList";
import { useDialogs } from "../hooks/useDialogs";
import { useToast } from "./ui/useToast";
import {
  useModelDownload,
  type ModelType,
  LOCAL_MODELS_CHANGED_EVENT,
  notifyLocalModelsChanged,
} from "../hooks/useModelDownload";
import { MODEL_PICKER_COLORS, type ColorScheme } from "../utils/modelPickerStyles";
import { getProviderIcon, isMonochromeProvider } from "../utils/providerIcons";

export interface LocalModel {
  id: string;
  name: string;
  size: string;
  sizeBytes?: number;
  description: string;
  descriptionKey?: string;
  specUrl?: string;
  isDownloaded?: boolean;
  downloaded?: boolean;
  recommended?: boolean;
  supportsVision?: boolean;
}

export interface LocalProvider {
  id: string;
  name: string;
  models: LocalModel[];
}

interface LocalModelPickerProps {
  providers: LocalProvider[];
  selectedModel: string;
  selectedProvider: string;
  onModelSelect: (modelId: string) => void;
  onProviderSelect: (providerId: string) => void;
  modelType: ModelType;
  colorScheme?: Exclude<ColorScheme, "blue">;
  className?: string;
  onDownloadComplete?: () => void;
}

export default function LocalModelPicker({
  providers,
  selectedModel,
  selectedProvider,
  onModelSelect,
  onProviderSelect,
  modelType,
  colorScheme = "purple",
  className = "",
  onDownloadComplete,
}: LocalModelPickerProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [downloadedModels, setDownloadedModels] = useState<Set<string>>(new Set());
  const [visionDownloadedModels, setVisionDownloadedModels] = useState<Set<string>>(new Set());
  const [downloadingVisionModels, setDownloadingVisionModels] = useState<Set<string>>(new Set());
  const loadDownloadedModelsRequestRef = useRef(0);

  const knownModelIds = useMemo(
    () => new Set(providers.flatMap((provider) => provider.models.map((model) => model.id))),
    [providers]
  );

  const { confirmDialog, showConfirmDialog, hideConfirmDialog } = useDialogs();
  const styles = useMemo(() => MODEL_PICKER_COLORS[colorScheme], [colorScheme]);

  const loadDownloadedModels = useCallback(async () => {
    const requestId = ++loadDownloadedModelsRequestRef.current;

    try {
      let downloaded = new Set<string>();
      let visionDownloaded = new Set<string>();
      if (modelType === "whisper") {
        const result = await window.electronAPI?.listWhisperModels();
        if (result?.success) {
          downloaded = new Set(
            result.models
              .filter((m: { downloaded?: boolean }) => m.downloaded)
              .map((m: { model: string }) => m.model)
          );
        }
      } else if (modelType === "parakeet") {
        const result = await window.electronAPI?.listParakeetModels();
        if (result?.success) {
          downloaded = new Set(
            result.models
              .filter((m: { downloaded?: boolean }) => m.downloaded)
              .map((m: { model: string }) => m.model)
          );
        }
      } else {
        const result = await window.electronAPI?.modelGetAll?.();
        if (result && Array.isArray(result)) {
          downloaded = new Set(
            result
              .filter((m: { isDownloaded?: boolean }) => m.isDownloaded)
              .map((m: { id: string }) => m.id)
          );
          visionDownloaded = new Set(
            result
              .filter((m: { isVisionDownloaded?: boolean }) => m.isVisionDownloaded)
              .map((m: { id: string }) => m.id)
          );
        }
      }
      if (requestId === loadDownloadedModelsRequestRef.current) {
        setDownloadedModels(downloaded);
        setVisionDownloadedModels(visionDownloaded);
        return downloaded;
      }
      return null;
    } catch (error) {
      console.error("Failed to load downloaded models:", error);
      return null;
    }
  }, [modelType]);

  useEffect(() => {
    window.addEventListener(LOCAL_MODELS_CHANGED_EVENT, loadDownloadedModels);
    return () => window.removeEventListener(LOCAL_MODELS_CHANGED_EVENT, loadDownloadedModels);
  }, [loadDownloadedModels]);

  useEffect(() => {
    const initAndValidate = async () => {
      const downloaded = await loadDownloadedModels();
      // Only clear ids this picker owns — a foreign id (e.g. a cloud model)
      // must survive untouched.
      if (
        downloaded &&
        selectedModel &&
        knownModelIds.has(selectedModel) &&
        !downloaded.has(selectedModel)
      ) {
        onModelSelect("");
      }
    };
    initAndValidate();
  }, [loadDownloadedModels, selectedModel, onModelSelect, knownModelIds]);

  const handleDownloadComplete = useCallback(async () => {
    await loadDownloadedModels();
    await onDownloadComplete?.();
  }, [loadDownloadedModels, onDownloadComplete]);

  const {
    downloads,
    downloadModel,
    deleteModel,
    isDownloadingModel,
    cancelDownload,
    isCancellingModel,
  } = useModelDownload({
    modelType,
    onDownloadComplete: handleDownloadComplete,
    onModelsCleared: loadDownloadedModels,
  });

  const allModels = useMemo(() => providers.flatMap((provider) => provider.models), [providers]);
  const selectionStateRef = useRef({ selectedModel, downloadedModels, knownModelIds });

  useEffect(() => {
    selectionStateRef.current = { selectedModel, downloadedModels, knownModelIds };
  }, [selectedModel, downloadedModels, knownModelIds]);

  const handleDownload = useCallback(
    (modelId: string) => {
      const selectedWhenStarted = selectionStateRef.current.selectedModel;

      downloadModel(modelId, (downloadedId) => {
        const {
          selectedModel: current,
          downloadedModels: downloaded,
          knownModelIds: known,
        } = selectionStateRef.current;
        if (current !== selectedWhenStarted) return;

        const selectionGone = known.has(current) && !downloaded.has(current);
        if (!current || selectionGone) {
          onModelSelect(downloadedId);
        }
      });
    },
    [downloadModel, onModelSelect]
  );

  const handleDelete = useCallback(
    (modelId: string) => {
      showConfirmDialog({
        title: t("transcription.deleteModel.title"),
        description: t("transcription.deleteModel.description"),
        onConfirm: () => deleteModel(modelId, loadDownloadedModels),
        variant: "destructive",
      });
    },
    [showConfirmDialog, deleteModel, loadDownloadedModels, t]
  );

  const handleDownloadVision = useCallback(
    async (modelId: string) => {
      setDownloadingVisionModels((prev) => new Set(prev).add(modelId));
      try {
        const res = await window.electronAPI?.modelDownloadVision?.(modelId);
        if (res?.success) {
          await loadDownloadedModels();
          notifyLocalModelsChanged();
        } else if (res?.error) {
          toast({
            title: t("common.error", "Error"),
            description: res.error,
          });
        }
      } catch (err: any) {
        console.error("Failed to download vision add-on:", err);
        toast({
          title: t("common.error", "Error"),
          description: err?.message || "Failed to download vision add-on",
        });
      } finally {
        setDownloadingVisionModels((prev) => {
          const next = new Set(prev);
          next.delete(modelId);
          return next;
        });
      }
    },
    [loadDownloadedModels, t, toast]
  );

  const handleDeleteVision = useCallback(
    async (modelId: string) => {
      try {
        await window.electronAPI?.modelDeleteVision?.(modelId);
        await loadDownloadedModels();
        notifyLocalModelsChanged();
      } catch (err) {
        console.error("Failed to delete vision add-on:", err);
      }
    },
    [loadDownloadedModels]
  );

  const currentProvider = providers.find((p) => p.id === selectedProvider);
  const models = useMemo(() => currentProvider?.models || [], [currentProvider?.models]);
  const activeModels = allModels.filter((model) => downloads[model.id]);

  return (
    <div className={className}>
      <ProviderTabs
        providers={providers}
        selectedId={selectedProvider}
        onSelect={onProviderSelect}
        colorScheme={colorScheme}
        wrap
      />

      {activeModels.length > 0 && (
        <div className="space-y-2">
          {activeModels.map((model) => {
            const status = downloads[model.id];
            const isVision = status?.isVision || downloadingVisionModels.has(model.id);
            const modelName = isVision ? `${model.name} (Vision Add-on)` : model.name;
            return (
              <DownloadProgressBar
                key={model.id}
                modelName={modelName}
                progress={{
                  percentage: status.progress,
                  downloadedBytes: status.downloadedBytes,
                  totalBytes: status.totalBytes,
                }}
                isInstalling={status.phase === "installing"}
              />
            );
          })}
        </div>
      )}

      <div className="mt-2">
        <h5 className={`${styles.header} mb-2`}>{t("common.availableModels")}</h5>

        <ModelCardList
          models={models.map((model): ModelCardOption => ({
            value: model.id,
            label: model.name,
            description: model.size,
            specUrl: model.specUrl,
            icon: getProviderIcon(selectedProvider),
            invertInDark: isMonochromeProvider(selectedProvider),
            recommended: model.recommended,
            supportsVision: model.supportsVision,
            isVisionDownloaded: visionDownloadedModels.has(model.id),
            isDownloadingVision: downloadingVisionModels.has(model.id),
            isDownloaded: downloadedModels.has(model.id) || model.isDownloaded || model.downloaded,
            isDownloading: isDownloadingModel(model.id),
            isCancelling: isCancellingModel(model.id),
          }))}
          selectedModel={selectedModel}
          onModelSelect={onModelSelect}
          onDownload={handleDownload}
          onDelete={handleDelete}
          onCancelDownload={cancelDownload}
          onDownloadVision={handleDownloadVision}
          onDeleteVision={handleDeleteVision}
          colorScheme={colorScheme}
        />
      </div>

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => !open && hideConfirmDialog()}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        onConfirm={confirmDialog.onConfirm}
        variant={confirmDialog.variant}
      />
    </div>
  );
}
