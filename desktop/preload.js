const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("monarchDesktop", {
  runtimeInfo: () => ipcRenderer.invoke("app:runtime-info"),
  checkForAppUpdates: (force) => ipcRenderer.invoke("app:check-for-updates", force),
  openUpdateDownload: () => ipcRenderer.invoke("app:open-update-download"),
  authStatus: () => ipcRenderer.invoke("backend:auth-status"),
  loginWithToken: (token) => ipcRenderer.invoke("backend:login-token", token),
  logout: () => ipcRenderer.invoke("backend:logout"),
  getAccounts: () => ipcRenderer.invoke("backend:accounts"),
  getBudgets: () => ipcRenderer.invoke("backend:budgets"),
  getBudgetHistory: (months) => ipcRenderer.invoke("backend:budget-history", months),
  getTransactionCategories: () => ipcRenderer.invoke("backend:transaction-categories"),
  getSummary: () => ipcRenderer.invoke("backend:summary"),
  getCurrentMonthSummary: () => ipcRenderer.invoke("backend:current-month-summary"),
  getCashflowHistory: (months) => ipcRenderer.invoke("backend:cashflow-history", months),
  getTransactions: (params) => ipcRenderer.invoke("backend:transactions", params),
  getNetWorthHistory: (days) => ipcRenderer.invoke("backend:net-worth-history", days),
  openBrowserLogin: () => ipcRenderer.invoke("backend:open-browser-login")
});
