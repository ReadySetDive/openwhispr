// Stub hook kept for any future or legacy reference; updater functionality is removed.
export interface UpdateStatus {
  updateAvailable: boolean;
  updateDownloaded: boolean;
  isDevelopment: boolean;
  isSupported: boolean;
}

export function useUpdater() {
  return {
    status: {
      updateAvailable: false,
      updateDownloaded: false,
      isDevelopment: true,
      isSupported: false,
    },
    info: null,
    downloadProgress: 0,
    isChecking: false,
    isDownloading: false,
    isInstalling: false,
    checkForUpdates: async () => ({ success: false, updateAvailable: false }),
    downloadUpdate: async () => ({ success: false, message: "Disabled" }),
    installUpdate: async () => ({ success: false, message: "Disabled" }),
    getAppVersion: async () => {
      try {
        const res = await window.electronAPI?.getAppVersion?.();
        return res?.version ?? null;
      } catch {
        return null;
      }
    },
  };
}
