import { useEffect } from "react";
import {
  useSettingsStore,
  ZOOM_LEVEL_MIN,
  ZOOM_LEVEL_MAX,
  ZOOM_LEVEL_STEP,
} from "../stores/settingsStore";

/**
 * Hook to manage window zoom factor and keyboard shortcuts (Ctrl/Cmd +, -, 0).
 * Handles US and international keyboards where '+' requires Shift (by also matching '=').
 */
export function useZoomShortcuts() {
  const zoomLevel = useSettingsStore((s) => s.zoomLevel);
  const setZoomLevel = useSettingsStore((s) => s.setZoomLevel);

  // Sync zoom factor on mount or when zoomLevel changes
  useEffect(() => {
    if (typeof window !== "undefined" && window.electronAPI?.setZoomFactor) {
      window.electronAPI.setZoomFactor(zoomLevel / 100);
    }
  }, [zoomLevel]);

  // Handle Ctrl/Cmd +, -, 0 shortcuts reliably across keyboard layouts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;

      // Zoom In: '=' or '+' (including NumpadAdd)
      if (e.key === "=" || e.key === "+" || e.code === "NumpadAdd") {
        e.preventDefault();
        const current = useSettingsStore.getState().zoomLevel;
        setZoomLevel(Math.min(ZOOM_LEVEL_MAX, current + ZOOM_LEVEL_STEP));
      }
      // Zoom Out: '-' or '_' (including NumpadSubtract)
      else if (e.key === "-" || e.key === "_" || e.code === "NumpadSubtract") {
        e.preventDefault();
        const current = useSettingsStore.getState().zoomLevel;
        setZoomLevel(Math.max(ZOOM_LEVEL_MIN, current - ZOOM_LEVEL_STEP));
      }
      // Reset Zoom: '0' (including Numpad0)
      else if (e.key === "0" || e.code === "Numpad0") {
        e.preventDefault();
        setZoomLevel(100);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setZoomLevel]);
}

export default useZoomShortcuts;
