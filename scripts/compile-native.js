#!/usr/bin/env node
/**
 * Platform-aware native compilation/preparation runner.
 * Runs only the helper scripts relevant to the current host OS,
 * avoiding unnecessary child processes and log noise on other platforms.
 */

const { execSync } = require("child_process");

const PLATFORM_SCRIPTS = {
  win32: [
    "compile:winkeys",
    "compile:winpaste",
    "compile:text-monitor",
  ],
  darwin: [
    "compile:globe",
    "compile:fast-paste",
    "compile:media-remote",
    "compile:mediaremote-adapter",
    "compile:mic-listener",
    "compile:calendar-listener",
    "compile:audio-tap",
    "compile:window-bounds",
  ],
  linux: [
    "compile:linuxkeys",
    "compile:linux-paste",
    "compile:linux-system-audio",
    "compile:text-monitor",
  ],
};

const scriptsToRun = PLATFORM_SCRIPTS[process.platform] || [];

if (scriptsToRun.length === 0) {
  console.log(`[compile:native] No native helper compilation needed for platform '${process.platform}'`);
  process.exit(0);
}

for (const scriptName of scriptsToRun) {
  try {
    execSync(`npm run ${scriptName}`, { stdio: "inherit" });
  } catch (error) {
    // If a script fails, don't crash prestart if fallback modes exist
    console.warn(`[compile:native] Warning: '${scriptName}' exited with code ${error.status || 1}`);
  }
}
