const { app, BrowserWindow, dialog, ipcMain, nativeImage, shell } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const packageJson = require("./package.json");

const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_BACKEND_URL = "http://127.0.0.1:8000";
const BACKEND_URL = process.env.MONARCH_BACKEND_URL || DEFAULT_BACKEND_URL;
const DEV_BACKEND_COMMAND = path.join(REPO_ROOT, ".venv", "bin", "uvicorn");
const DEV_BACKEND_ARGS = ["app.main:app", "--app-dir", "backend"];
const START_TIMEOUT_MS = 20_000;
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const APP_ICON_PNG = path.join(__dirname, "assets", "app-icon.png");
const PACKAGED_BACKEND_NAME = process.platform === "win32" ? "monarch-backend.exe" : "monarch-backend";
const RELEASES_REPOSITORY = getReleaseRepository();

let mainWindow = null;
let backendProcess = null;
let startedManagedBackend = false;
let isQuitting = false;
let appUpdateState = {
  enabled: Boolean(RELEASES_REPOSITORY),
  checking: false,
  available: false,
  currentVersion: app.getVersion(),
  latestVersion: null,
  releaseName: null,
  releaseUrl: null,
  downloadUrl: null,
  publishedAt: null,
  lastCheckedAt: null,
  error: null
};

function parseGitHubRepository(value) {
  if (!value) {
    return null;
  }

  const normalized = String(value).trim();
  const directMatch = normalized.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (directMatch) {
    return `${directMatch[1]}/${directMatch[2]}`;
  }

  const urlMatch = normalized.match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/i);
  if (!urlMatch) {
    return null;
  }

  return `${urlMatch[1]}/${urlMatch[2]}`;
}

function getReleaseRepository() {
  return (
    parseGitHubRepository(process.env.MONARCH_RELEASES_REPO) ||
    parseGitHubRepository(packageJson.releaseRepository) ||
    parseGitHubRepository(packageJson.repository?.url || packageJson.repository)
  );
}

function normalizeVersion(value) {
  return String(value || "")
    .trim()
    .replace(/^v/i, "")
    .split("-")[0];
}

function compareVersions(left, right) {
  const leftParts = normalizeVersion(left)
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = normalizeVersion(right)
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftValue = leftParts[index] || 0;
    const rightValue = rightParts[index] || 0;
    if (leftValue !== rightValue) {
      return leftValue - rightValue;
    }
  }

  return 0;
}

function getLatestReleaseApiUrl() {
  if (!RELEASES_REPOSITORY) {
    return null;
  }

  return `https://api.github.com/repos/${RELEASES_REPOSITORY}/releases/latest`;
}

function chooseMacDownloadAsset(release) {
  const assets = Array.isArray(release?.assets) ? release.assets : [];
  return (
    assets.find((asset) => typeof asset.name === "string" && asset.name.endsWith(".dmg")) ||
    assets.find((asset) => typeof asset.name === "string" && asset.name.endsWith(".zip")) ||
    null
  );
}

async function fetchLatestReleaseInfo() {
  const apiUrl = getLatestReleaseApiUrl();
  if (!apiUrl) {
    throw new Error("No releases repository configured.");
  }

  const response = await fetch(apiUrl, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": `Monarch-Mac/${app.getVersion()}`
    }
  });

  if (!response.ok) {
    throw new Error(`Update check failed with ${response.status}.`);
  }

  const release = await response.json();
  const asset = chooseMacDownloadAsset(release);
  const latestVersion = normalizeVersion(release.tag_name || release.name);

  return {
    latestVersion,
    releaseName: release.name || release.tag_name || latestVersion,
    releaseUrl: release.html_url || null,
    downloadUrl: asset?.browser_download_url || release.html_url || null,
    publishedAt: release.published_at || null
  };
}

async function checkForAppUpdates({ force = false } = {}) {
  const currentVersion = normalizeVersion(app.getVersion());
  appUpdateState = {
    ...appUpdateState,
    currentVersion
  };

  if (!appUpdateState.enabled) {
    return appUpdateState;
  }

  if (appUpdateState.checking) {
    return appUpdateState;
  }

  if (
    !force &&
    appUpdateState.lastCheckedAt &&
    Date.now() - appUpdateState.lastCheckedAt < UPDATE_CHECK_INTERVAL_MS
  ) {
    return appUpdateState;
  }

  appUpdateState = {
    ...appUpdateState,
    checking: true,
    error: null
  };

  try {
    const release = await fetchLatestReleaseInfo();
    appUpdateState = {
      ...appUpdateState,
      checking: false,
      lastCheckedAt: Date.now(),
      available: compareVersions(release.latestVersion, currentVersion) > 0,
      currentVersion,
      latestVersion: release.latestVersion,
      releaseName: release.releaseName,
      releaseUrl: release.releaseUrl,
      downloadUrl: release.downloadUrl,
      publishedAt: release.publishedAt,
      error: null
    };
  } catch (error) {
    appUpdateState = {
      ...appUpdateState,
      checking: false,
      currentVersion,
      lastCheckedAt: Date.now(),
      error: String(error.message || error)
    };
  }

  return appUpdateState;
}

async function openLatestReleaseDownload() {
  const updateState = await checkForAppUpdates();
  const targetUrl = updateState.downloadUrl || updateState.releaseUrl;

  if (!targetUrl) {
    throw new Error("No update download URL is configured.");
  }

  await shell.openExternal(targetUrl);
}

function usesExternalBackend() {
  return Boolean(process.env.MONARCH_BACKEND_URL);
}

function getPackagedBackendCommand() {
  return path.join(process.resourcesPath, "backend", PACKAGED_BACKEND_NAME);
}

function getManagedBackendConfig() {
  if (app.isPackaged) {
    return {
      command: getPackagedBackendCommand(),
      args: [],
      cwd: process.resourcesPath,
      missingMessage:
        "Bundled backend is missing. Run `npm run dist:mac` after building the backend resource."
    };
  }

  return {
    command: DEV_BACKEND_COMMAND,
    args: DEV_BACKEND_ARGS,
    cwd: REPO_ROOT,
    missingMessage: "Backend virtualenv is missing. Run `make install` first."
  };
}

function getBackendEnv() {
  const env = {
    ...process.env,
    PYTHONUNBUFFERED: "1"
  };

  if (!env.MONARCH_PERSISTED_TOKEN_PATH && app.isPackaged) {
    env.MONARCH_PERSISTED_TOKEN_PATH = path.join(app.getPath("userData"), "monarch_token.json");
  }

  return env;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 900,
    minWidth: 1100,
    minHeight: 760,
    title: "Monarch Mac",
    backgroundColor: "#eef2ea",
    icon: fs.existsSync(APP_ICON_PNG) ? APP_ICON_PNG : undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function backendFetch(endpoint, options = {}) {
  const response = await fetch(`${BACKEND_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  });

  const payload = await parseResponse(response);
  if (!response.ok) {
    const message =
      payload?.detail?.message ||
      payload?.detail ||
      payload?.message ||
      `Request failed with ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

async function isBackendHealthy() {
  try {
    const response = await fetch(`${BACKEND_URL}/healthz`);
    return response.ok;
  } catch {
    return false;
  }
}

function prefixStream(name, stream) {
  stream.on("data", (chunk) => {
    const text = chunk.toString();
    for (const line of text.split(/\r?\n/)) {
      if (line.trim()) {
        process.stdout.write(`[${name}] ${line}\n`);
      }
    }
  });
}

async function ensureBackend() {
  if (await isBackendHealthy()) {
    return;
  }

  if (usesExternalBackend()) {
    throw new Error(`Configured backend at ${BACKEND_URL} is not reachable.`);
  }

  const backendConfig = getManagedBackendConfig();
  if (!fs.existsSync(backendConfig.command)) {
    throw new Error(backendConfig.missingMessage);
  }

  backendProcess = spawn(backendConfig.command, backendConfig.args, {
    cwd: backendConfig.cwd,
    env: getBackendEnv(),
    stdio: ["ignore", "pipe", "pipe"]
  });

  startedManagedBackend = true;
  prefixStream("backend", backendProcess.stdout);
  prefixStream("backend", backendProcess.stderr);

  backendProcess.on("exit", (code, signal) => {
    backendProcess = null;
    if (!isQuitting) {
      const reason = code !== null ? `code ${code}` : `signal ${signal}`;
      process.stderr.write(`[backend] exited with ${reason}\n`);
    }
  });

  const start = Date.now();
  while (Date.now() - start < START_TIMEOUT_MS) {
    if (await isBackendHealthy()) {
      return;
    }
    await sleep(300);
  }

  throw new Error("Timed out waiting for the backend to start.");
}

async function openBrowserLogin() {
  await shell.openExternal(`${BACKEND_URL}/login`);
}

ipcMain.handle("app:runtime-info", async () => ({
  backendUrl: BACKEND_URL,
  startedManagedBackend,
  appVersion: app.getVersion(),
  isPackaged: app.isPackaged,
  releasesRepository: RELEASES_REPOSITORY
}));
ipcMain.handle("app:check-for-updates", async (_event, force = false) =>
  checkForAppUpdates({ force: Boolean(force) })
);
ipcMain.handle("app:open-update-download", async () => openLatestReleaseDownload());

ipcMain.handle("backend:auth-status", async () => backendFetch("/auth/status"));
ipcMain.handle("backend:login-token", async (_event, token) =>
  backendFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ token })
  })
);
ipcMain.handle("backend:logout", async () =>
  backendFetch("/auth/logout", {
    method: "POST"
  })
);
ipcMain.handle("backend:accounts", async () => backendFetch("/accounts"));
ipcMain.handle("backend:budgets", async () => backendFetch("/budgets"));
ipcMain.handle("backend:budget-history", async (_event, months = 12) =>
  backendFetch(`/budgets/history?months=${encodeURIComponent(months)}`)
);
ipcMain.handle("backend:transaction-categories", async () =>
  backendFetch("/transaction-categories")
);
ipcMain.handle("backend:summary", async () => backendFetch("/transactions/summary"));
ipcMain.handle("backend:current-month-summary", async () =>
  backendFetch("/transactions/summary/current-month")
);
ipcMain.handle("backend:cashflow-history", async (_event, months = 12) =>
  backendFetch(`/cashflow/history?months=${encodeURIComponent(months)}`)
);
ipcMain.handle("backend:transactions", async (_event, params = {}) => {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        searchParams.append(key, String(item));
      }
      continue;
    }

    searchParams.set(key, String(value));
  }

  const query = searchParams.toString();
  return backendFetch(`/transactions${query ? `?${query}` : ""}`);
});
ipcMain.handle("backend:net-worth-history", async (_event, days = 180) =>
  backendFetch(`/net-worth/history?days=${encodeURIComponent(days)}`)
);
ipcMain.handle("backend:open-browser-login", async () => openBrowserLogin());

app.whenReady().then(async () => {
  try {
    await ensureBackend();
    if (process.platform === "darwin" && fs.existsSync(APP_ICON_PNG)) {
      app.dock.setIcon(nativeImage.createFromPath(APP_ICON_PNG));
    }
    createWindow();
    checkForAppUpdates().catch((error) => {
      process.stderr.write(`[update] ${String(error.message || error)}\n`);
    });
  } catch (error) {
    dialog.showErrorBox("Backend Startup Failed", String(error.message || error));
    app.quit();
  }
});

app.on("activate", async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
  if (backendProcess && startedManagedBackend) {
    backendProcess.kill("SIGTERM");
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
