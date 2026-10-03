const { app } = require("electron");

class UpdateManager {
  constructor() {
    this.updateAvailable = false;
    this.updateDownloaded = false;
    this.lastUpdateInfo = null;
    this.isInstalling = false;
    this.isDownloading = false;
    this.isQuittingForUpdate = false;
    this.windowManager = null;
    this.autoUpdatesEnabled = false;
  }

  setWindowManager(windowManager) {
    this.windowManager = windowManager;
  }

  async checkForUpdates() {
    return {
      success: true,
      isUpdateAvailable: false,
      updateAvailable: false,
      message: "Updates are disabled",
    };
  }

  async downloadUpdate() {
    return {
      success: false,
      message: "Updates are disabled",
    };
  }

  async installUpdate() {
    return {
      success: false,
      message: "Updates are disabled",
    };
  }

  async getAppVersion() {
    return { version: app.getVersion() };
  }

  async getUpdateStatus() {
    return {
      updateAvailable: false,
      updateDownloaded: false,
      isDevelopment: process.env.NODE_ENV === "development",
      isSupported: false,
    };
  }

  async getUpdateInfo() {
    return null;
  }

  setAutoUpdatesEnabled(_enabled) {
    this.autoUpdatesEnabled = false;
  }

  deferInstallOnQuit() {}

  hasStagedUpdate() {
    return false;
  }

  checkForUpdatesOnStartup() {}

  cleanup() {}
}

module.exports = UpdateManager;
