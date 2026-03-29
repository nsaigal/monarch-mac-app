const REFRESH_INTERVAL_MS = 15000;
const HISTORY_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const HISTORY_DAYS = 180;
const TRANSACTION_LIMIT = 40;
const EMPTY_TRANSACTION_FILTERS = Object.freeze({
  search: "",
  accountId: "",
  categoryId: "",
  startDate: "",
  endDate: ""
});
const CHART_WIDTH = 900;
const CHART_HEIGHT = 260;
const CHART_PADDING_X = 18;
const CHART_PADDING_Y = 18;
const SPARKLINE_WIDTH = 240;
const SPARKLINE_HEIGHT = 86;
const SPARKLINE_PADDING_X = 8;
const SPARKLINE_PADDING_Y = 10;
const WORKSPACE_COPY = {
  dashboard: {
    title: "Dashboard",
    subtitle: "Keep track of balances, budget pressure, and overall account health."
  },
  accounts: {
    title: "Accounts",
    subtitle: "Scan balances, sync health, and account freshness in one place."
  },
  transactions: {
    title: "Transactions",
    subtitle: "Review recent transaction activity across the connected household."
  },
  cashflow: {
    title: "Cash Flow",
    subtitle: "Read monthly income and expense movement in a single visual pass."
  },
  budgets: {
    title: "Budget",
    subtitle: "Review category spending, target pressure, and longer-range budget movement."
  }
};

const appFrameEl = document.querySelector(".app-frame");
const refreshButtonEl = document.getElementById("refresh-button");
const authActionButtonEl = document.getElementById("auth-action-button");
const workspaceHeadingEl = document.getElementById("workspace-heading");
const workspaceSubtitleEl = document.getElementById("workspace-subtitle");
const workspaceTabs = Array.from(document.querySelectorAll(".workspace-tab"));
const updateBannerEl = document.getElementById("update-banner");
const updateBannerTitleEl = document.getElementById("update-banner-title");
const updateBannerBodyEl = document.getElementById("update-banner-body");
const updateDownloadButtonEl = document.getElementById("update-download-button");
const updateDismissButtonEl = document.getElementById("update-dismiss-button");
const dashboardViewEl = document.getElementById("dashboard-view");
const accountsViewEl = document.getElementById("accounts-view");
const transactionsViewEl = document.getElementById("transactions-view");
const transactionsSearchInputEl = document.getElementById("transactions-search");
const transactionsAccountFilterEl = document.getElementById("transactions-account-filter");
const transactionsCategoryFilterEl = document.getElementById("transactions-category-filter");
const transactionsStartDateEl = document.getElementById("transactions-start-date");
const transactionsEndDateEl = document.getElementById("transactions-end-date");
const transactionsApplyButtonEl = document.getElementById("transactions-apply-button");
const transactionsResetButtonEl = document.getElementById("transactions-reset-button");
const transactionsDateHintEl = document.getElementById("transactions-date-hint");
const transactionsResultsMetaEl = document.getElementById("transactions-results-meta");
const transactionsPaginationEl = document.getElementById("transactions-pagination");
const transactionsPaginationCopyEl = document.getElementById("transactions-pagination-copy");
const transactionsPaginationSentinelEl = document.getElementById("transactions-pagination-sentinel");
const cashflowViewEl = document.getElementById("cashflow-view");
const budgetsViewEl = document.getElementById("budgets-view");
const budgetRangeButtons = Array.from(document.querySelectorAll(".budget-range-chip"));
const cashflowRangeButtons = Array.from(document.querySelectorAll(".cashflow-range-chip"));
const netWorthTotalEl = document.getElementById("net-worth-total");
const assetTotalEl = document.getElementById("asset-total");
const liabilityTotalEl = document.getElementById("liability-total");
const incomeTotalEl = document.getElementById("income-total");
const expenseTotalEl = document.getElementById("expense-total");
const transactionCountEl = document.getElementById("transaction-count");
const institutionCountEl = document.getElementById("institution-count");
const accountCountEl = document.getElementById("account-count");
const liveCountEl = document.getElementById("live-count");
const manualCountEl = document.getElementById("manual-count");
const accountFootnoteEl = document.getElementById("account-footnote");
const transactionsFootnoteEl = document.getElementById("transactions-footnote");
const summaryFirstEl = document.getElementById("summary-first");
const summaryLastEl = document.getElementById("summary-last");
const historyCurrentEl = document.getElementById("history-current");
const historyChangeEl = document.getElementById("history-change");
const historyRangeEl = document.getElementById("history-range");
const historyStartEl = document.getElementById("history-start");
const historyEndEl = document.getElementById("history-end");
const chartSvgEl = document.getElementById("net-worth-chart");
const chartEmptyEl = document.getElementById("chart-empty");
const transactionsListEl = document.getElementById("transactions-list");
const accountsFeedEl = document.getElementById("accounts-feed");
const budgetSnapshotFootnoteEl = document.getElementById("budget-snapshot-footnote");
const budgetSnapshotListEl = document.getElementById("budget-snapshot-list");
const filterButtons = Array.from(document.querySelectorAll(".filter-chip"));
const budgetHistoryFootnoteEl = document.getElementById("budget-history-footnote");
const budgetCategoryCountEl = document.getElementById("budget-category-count");
const budgetOverCountEl = document.getElementById("budget-over-count");
const budgetUnderCountEl = document.getElementById("budget-under-count");
const budgetActualTotalEl = document.getElementById("budget-actual-total");
const budgetPlannedTotalEl = document.getElementById("budget-planned-total");
const budgetTilesEl = document.getElementById("budget-tiles");
const cashflowFootnoteEl = document.getElementById("cashflow-footnote");
const cashflowIncomeTotalEl = document.getElementById("cashflow-income-total");
const cashflowExpenseTotalEl = document.getElementById("cashflow-expense-total");
const cashflowNetTotalEl = document.getElementById("cashflow-net-total");
const cashflowBestMonthEl = document.getElementById("cashflow-best-month");
const cashflowBestMonthCaptionEl = document.getElementById("cashflow-best-month-caption");
const cashflowChartEl = document.getElementById("cashflow-chart");
const loadingTextEls = Array.from(
  document.querySelectorAll(
    ".metric strong, .metric-caption, #history-current, #history-change, #history-range, .horizon-item strong"
  )
);

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1
});

const integerFormatter = new Intl.NumberFormat("en-US");

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric"
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit"
});

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "2-digit"
});

const shortMonthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short"
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 0
});

const state = {
  runtimeInfo: null,
  appUpdate: null,
  dismissedUpdateVersion: null,
  auth: null,
  accounts: [],
  budgetHistory: null,
  cashflowHistory: null,
  summary: {},
  currentMonthSummary: null,
  transactions: [],
  transactionsTotalCount: 0,
  transactionsLoading: false,
  transactionsInitialized: false,
  transactionCategories: [],
  transactionFilters: { ...EMPTY_TRANSACTION_FILTERS },
  transactionDraftFilters: { ...EMPTY_TRANSACTION_FILTERS },
  netWorthHistory: null,
  historyFetchedAt: null,
  cashflowFetchedAt: null,
  currentFilter: "all",
  currentView: "dashboard",
  budgetHistoryMonths: 12,
  cashflowHistoryMonths: 12,
  cashflowHoverIndex: null,
  lastRefreshAt: null,
  nextRefreshAt: null,
  refreshInFlight: false,
  initialLoadResolved: false
};

let transactionsPaginationObserver = null;

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function parseTimestamp(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const year = Number(match[1]);
      const monthIndex = Number(match[2]) - 1;
      const day = Number(match[3]);
      return new Date(year, monthIndex, day, 12).getTime();
    }
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function formatCurrency(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }

  return currencyFormatter.format(value);
}

function formatMetricCurrency(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }

  return compactCurrencyFormatter.format(value);
}

function formatSignedCompactCurrency(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }

  const prefix = value > 0 ? "+" : "";
  return `${prefix}${compactCurrencyFormatter.format(value)}`;
}

function formatInteger(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "0";
  }

  return integerFormatter.format(value);
}

function formatDate(value) {
  const timestamp = parseTimestamp(value);
  return timestamp ? dateFormatter.format(timestamp) : "—";
}

function formatDateTime(value) {
  const timestamp = parseTimestamp(value);
  return timestamp ? dateTimeFormatter.format(timestamp) : "—";
}

function formatMonth(value) {
  const timestamp = parseTimestamp(value);
  return timestamp ? monthFormatter.format(timestamp) : "—";
}

function formatMonthShort(value) {
  const timestamp = parseTimestamp(value);
  return timestamp ? shortMonthFormatter.format(timestamp) : "—";
}

function formatVersion(value) {
  if (!value) {
    return "—";
  }

  return String(value).replace(/^v/i, "");
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

function formatSignedCurrency(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }

  const prefix = value > 0 ? "+" : "";
  return `${prefix}${currencyFormatter.format(value)}`;
}

function formatSignedPercent(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }

  const prefix = value > 0 ? "+" : "";
  return `${prefix}${percentFormatter.format(value)}`;
}

function formatRelative(value) {
  const timestamp = parseTimestamp(value);
  if (!timestamp) {
    return "—";
  }

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes <= 0) {
    return "now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return formatDate(value);
}

function cloneTransactionFilters(filters = EMPTY_TRANSACTION_FILTERS) {
  return {
    search: String(filters.search || ""),
    accountId: String(filters.accountId || ""),
    categoryId: String(filters.categoryId || ""),
    startDate: String(filters.startDate || ""),
    endDate: String(filters.endDate || "")
  };
}

function normalizeTransactionFilters(filters = EMPTY_TRANSACTION_FILTERS) {
  return {
    search: String(filters.search || "").trim(),
    accountId: String(filters.accountId || ""),
    categoryId: String(filters.categoryId || ""),
    startDate: String(filters.startDate || ""),
    endDate: String(filters.endDate || "")
  };
}

function hasPartialTransactionDateRange(filters = state.transactionDraftFilters) {
  return Boolean(filters.startDate) !== Boolean(filters.endDate);
}

function hasAnyTransactionInput(filters = state.transactionDraftFilters) {
  return Boolean(
    String(filters.search || "").trim() ||
      filters.accountId ||
      filters.categoryId ||
      filters.startDate ||
      filters.endDate
  );
}

function countActiveTransactionFilters(filters = state.transactionFilters) {
  let count = 0;

  if (String(filters.search || "").trim()) {
    count += 1;
  }

  if (filters.accountId) {
    count += 1;
  }

  if (filters.categoryId) {
    count += 1;
  }

  if (filters.startDate && filters.endDate) {
    count += 1;
  }

  return count;
}

function getTransactionsQueryParams({ offset = 0, limit = TRANSACTION_LIMIT } = {}) {
  const filters = normalizeTransactionFilters(state.transactionFilters);
  const params = {
    limit,
    offset
  };

  if (filters.search) {
    params.search = filters.search;
  }

  if (filters.accountId) {
    params.account_ids = [filters.accountId];
  }

  if (filters.categoryId) {
    params.category_ids = [filters.categoryId];
  }

  if (filters.startDate && filters.endDate) {
    params.start_date = filters.startDate;
    params.end_date = filters.endDate;
  }

  return params;
}

function setupTransactionsPaginationObserver() {
  if (transactionsPaginationObserver || !transactionsPaginationSentinelEl) {
    return;
  }

  if (!("IntersectionObserver" in window)) {
    return;
  }

  transactionsPaginationObserver = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (!entry?.isIntersecting) {
        return;
      }

      if (
        state.currentView !== "transactions" ||
        !state.auth?.authenticated ||
        state.refreshInFlight ||
        state.transactionsLoading ||
        state.transactions.length >= state.transactionsTotalCount
      ) {
        return;
      }

      loadMoreTransactions().catch((error) => {
        setStatus("error", "Transaction load failed", error.message || String(error));
      });
    },
    {
      root: null,
      rootMargin: "0px 0px 220px 0px",
      threshold: 0.01
    }
  );

  transactionsPaginationObserver.observe(transactionsPaginationSentinelEl);
}

function isInitialLoading() {
  return state.refreshInFlight && !state.initialLoadResolved;
}

function syncLoadingState() {
  const initialLoading = isInitialLoading();
  const surfaceRefreshing = state.refreshInFlight && state.initialLoadResolved;

  appFrameEl.classList.toggle("is-loading", initialLoading);
  appFrameEl.classList.toggle("is-surface-refreshing", surfaceRefreshing);
  loadingTextEls.forEach((element) => {
    element.classList.toggle("loading-mask", initialLoading);
  });
}

function buildLoadingLine(width, extraClass = "") {
  return `<span class="loading-line${extraClass ? ` ${extraClass}` : ""}" style="width: ${width}%"></span>`;
}

function buildAccountsLoading(count = 6) {
  return `
    <div class="loading-stack" aria-hidden="true">
      ${Array.from({ length: count }, (_value, index) => {
        const widths = [44, 36, 18, 14, 12, 16];
        return `
          <div class="loading-list-row">
            <div class="loading-row-copy">
              ${buildLoadingLine(widths[index % widths.length])}
              ${buildLoadingLine(26 + (index % 3) * 6, "short")}
            </div>
            <div class="loading-row-meta">
              ${buildLoadingLine(18, "pill")}
              ${buildLoadingLine(12, "pill")}
              ${buildLoadingLine(10, "pill")}
              ${buildLoadingLine(16, "pill")}
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function buildTransactionsLoading(count = 7) {
  return `
    <div class="loading-stack" aria-hidden="true">
      ${Array.from({ length: count }, (_value, index) => `
        <div class="loading-list-row">
          <div class="loading-row-meta">
            ${buildLoadingLine(12, "pill")}
          </div>
          <div class="loading-row-copy">
            ${buildLoadingLine(40 - (index % 3) * 4)}
            ${buildLoadingLine(24 + (index % 4) * 5, "short")}
          </div>
          <div class="loading-row-meta">
            ${buildLoadingLine(16, "pill")}
            ${buildLoadingLine(14, "pill")}
            ${buildLoadingLine(12, "pill")}
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function buildBudgetSnapshotLoading(count = 6) {
  return `
    <div class="loading-stack" aria-hidden="true">
      ${Array.from({ length: count }, (_value, index) => `
        <div class="loading-list-row is-budget">
          <div class="loading-row-copy">
            ${buildLoadingLine(34 + (index % 4) * 6)}
          </div>
          <div class="loading-row-meta">
            ${buildLoadingLine(18, "pill")}
            ${buildLoadingLine(12, "pill")}
          </div>
          <div class="loading-progress">
            <span class="loading-progress-fill" style="width: ${46 + (index % 4) * 12}%"></span>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function buildBudgetTilesLoading(count = 4) {
  return `
    <div class="loading-tile-grid" aria-hidden="true">
      ${Array.from({ length: count }, (_value, index) => `
        <article class="loading-tile">
          ${buildLoadingLine(22, "tiny")}
          ${buildLoadingLine(48 - (index % 3) * 4)}
          ${buildLoadingLine(28, "short")}
          <div class="loading-spark"></div>
          <div class="loading-row-meta">
            ${buildLoadingLine(16, "pill")}
            ${buildLoadingLine(12, "pill")}
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function buildLoadingChart(count = 12) {
  const heights = [34, 48, 42, 56, 38, 64, 46, 58, 52, 68, 44, 60];
  return `
    <div class="loading-chart-state" aria-hidden="true">
      <div class="loading-chart-bars">
        ${Array.from({ length: count }, (_value, index) => `
          <span class="loading-chart-bar" style="height: ${heights[index % heights.length]}%"></span>
        `).join("")}
      </div>
      <div class="loading-row-meta">
        ${buildLoadingLine(16, "pill")}
        ${buildLoadingLine(14, "pill")}
      </div>
    </div>
  `;
}

function renderInitialLoadingState() {
  if (!isInitialLoading()) {
    return;
  }

  accountFootnoteEl.textContent = "Loading account health…";
  transactionsFootnoteEl.textContent = "Loading recent transactions…";
  transactionsResultsMetaEl.textContent = "Loading transaction activity…";
  budgetSnapshotFootnoteEl.textContent = "Loading current-month budget…";
  budgetHistoryFootnoteEl.textContent = "Loading budget history…";
  cashflowFootnoteEl.textContent = "Loading monthly cash flow…";

  budgetSnapshotListEl.innerHTML = buildBudgetSnapshotLoading();
  accountsFeedEl.innerHTML = buildAccountsLoading();
  transactionsListEl.innerHTML = buildTransactionsLoading();
  budgetTilesEl.innerHTML = buildBudgetTilesLoading();
  cashflowChartEl.innerHTML = buildLoadingChart();

  chartSvgEl.innerHTML = "";
  chartEmptyEl.hidden = false;
  chartEmptyEl.style.display = "grid";
  chartEmptyEl.classList.add("is-loading");
  chartEmptyEl.innerHTML = buildLoadingChart(10);
  renderTransactionControls();
}

function setStatus(kind, label, detail) {
  const message = `${label}: ${detail}`;
  if (kind === "error") {
    console.error(message);
    return;
  }

  console.info(message);
}

function updateTopbarActions() {
  const isAuthenticated = Boolean(state.auth?.authenticated);
  refreshButtonEl.disabled = state.refreshInFlight;
  refreshButtonEl.textContent = state.refreshInFlight ? "Refreshing…" : "Refresh";

  authActionButtonEl.disabled = state.refreshInFlight;
  authActionButtonEl.textContent = isAuthenticated ? "Logout" : "Sign in";
  authActionButtonEl.classList.toggle("primary", !isAuthenticated);
  authActionButtonEl.classList.toggle("subtle", isAuthenticated);
}

function updateWorkspaceTabs() {
  workspaceTabs.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === state.currentView);
  });

  const copy = WORKSPACE_COPY[state.currentView] || WORKSPACE_COPY.dashboard;
  workspaceHeadingEl.textContent = copy.title;
  workspaceSubtitleEl.textContent = copy.subtitle;

  const showDashboard = state.currentView === "dashboard";
  const showAccounts = state.currentView === "accounts";
  const showTransactions = state.currentView === "transactions";
  const showCashflow = state.currentView === "cashflow";
  const showBudgets = state.currentView === "budgets";
  dashboardViewEl.hidden = !showDashboard;
  accountsViewEl.hidden = !showAccounts;
  transactionsViewEl.hidden = !showTransactions;
  cashflowViewEl.hidden = !showCashflow;
  budgetsViewEl.hidden = !showBudgets;
  dashboardViewEl.classList.toggle("is-active", showDashboard);
  accountsViewEl.classList.toggle("is-active", showAccounts);
  transactionsViewEl.classList.toggle("is-active", showTransactions);
  cashflowViewEl.classList.toggle("is-active", showCashflow);
  budgetsViewEl.classList.toggle("is-active", showBudgets);
}

function renderBudgetRangeButtons() {
  budgetRangeButtons.forEach((button) => {
    const months = Number(button.dataset.months);
    button.classList.toggle("is-active", months === state.budgetHistoryMonths);
  });
}

function renderCashflowRangeButtons() {
  cashflowRangeButtons.forEach((button) => {
    const months = Number(button.dataset.months);
    button.classList.toggle("is-active", months === state.cashflowHistoryMonths);
  });
}

function renderUpdateBanner() {
  const update = state.appUpdate;
  const currentVersion = formatVersion(state.runtimeInfo?.appVersion || update?.currentVersion);
  const latestVersion = formatVersion(update?.latestVersion);
  const hasNewerVersion = compareVersions(latestVersion, currentVersion) > 0;
  const shouldShow =
    Boolean(update?.enabled && update?.downloadUrl && hasNewerVersion) &&
    state.currentView === "dashboard" &&
    state.dismissedUpdateVersion !== update?.latestVersion;

  updateBannerEl.hidden = !shouldShow;
  if (!shouldShow) {
    return;
  }

  updateBannerTitleEl.textContent = `Monarch Mac ${latestVersion} is available`;
  const publishedCopy = update?.publishedAt ? ` Released ${formatDate(update.publishedAt)}.` : "";
  updateBannerBodyEl.textContent =
    `You're on ${currentVersion}. Download the latest DMG to update this app.${publishedCopy}`;
}

function scheduleNextRefresh() {
  state.nextRefreshAt = Date.now() + REFRESH_INTERVAL_MS;
}

function getAccountMonitorState(account) {
  const updatedAt = account.displayLastUpdatedAt || account.updatedAt || account.createdAt;

  if (account.deactivatedAt) {
    return { kind: "offline", label: "Deactivated", priority: 0, updatedAt };
  }

  if (account.credential?.updateRequired) {
    return { kind: "attention", label: "Reconnect", priority: 1, updatedAt };
  }

  if (account.syncDisabled) {
    return { kind: "attention", label: "Sync off", priority: 2, updatedAt };
  }

  if (account.isManual) {
    return { kind: "manual", label: "Manual", priority: 3, updatedAt };
  }

  return { kind: "live", label: "Live", priority: 4, updatedAt };
}

function getDisplayBalance(account) {
  return typeof account.displayBalance === "number" ? account.displayBalance : null;
}

function getMonitorAccounts() {
  return state.accounts.filter((account) => !account.deactivatedAt && !account.hideFromList);
}

function getNetWorthAccounts() {
  return state.accounts.filter(
    (account) =>
      !account.deactivatedAt &&
      account.includeInNetWorth !== false &&
      account.includeBalanceInNetWorth !== false
  );
}

function matchesFilter(account, monitorState) {
  switch (state.currentFilter) {
    case "attention":
      return monitorState.kind === "attention";
    case "assets":
      return account.isAsset;
    case "liabilities":
      return !account.isAsset;
    default:
      return true;
  }
}

function sortAccounts(accounts) {
  return [...accounts].sort((left, right) => {
    const leftState = getAccountMonitorState(left);
    const rightState = getAccountMonitorState(right);

    if (leftState.priority !== rightState.priority) {
      return leftState.priority - rightState.priority;
    }

    const leftUpdated = parseTimestamp(leftState.updatedAt) || 0;
    const rightUpdated = parseTimestamp(rightState.updatedAt) || 0;
    if (leftUpdated !== rightUpdated) {
      return leftUpdated - rightUpdated;
    }

    const leftBalance = Math.abs(getDisplayBalance(left) || 0);
    const rightBalance = Math.abs(getDisplayBalance(right) || 0);
    return rightBalance - leftBalance;
  });
}

function renderFilterButtons() {
  filterButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.filter === state.currentFilter);
  });
}

function renderTransactionControls() {
  const accounts = [...getMonitorAccounts()].sort((left, right) =>
    String(left.displayName || "").localeCompare(String(right.displayName || ""))
  );
  const accountIds = new Set(accounts.map((account) => String(account.id)));
  const categories = [...state.transactionCategories].sort((left, right) => {
    const leftGroup = String(left.group?.name || "");
    const rightGroup = String(right.group?.name || "");
    if (leftGroup !== rightGroup) {
      return leftGroup.localeCompare(rightGroup);
    }

    return String(left.name || "").localeCompare(String(right.name || ""));
  });
  const categoryIds = new Set(categories.map((category) => String(category.id)));

  if (state.transactionDraftFilters.accountId && !accountIds.has(state.transactionDraftFilters.accountId)) {
    state.transactionDraftFilters = {
      ...state.transactionDraftFilters,
      accountId: ""
    };
  }

  if (state.transactionFilters.accountId && !accountIds.has(state.transactionFilters.accountId)) {
    state.transactionFilters = {
      ...state.transactionFilters,
      accountId: ""
    };
  }

  if (
    state.transactionDraftFilters.categoryId &&
    !categoryIds.has(state.transactionDraftFilters.categoryId)
  ) {
    state.transactionDraftFilters = {
      ...state.transactionDraftFilters,
      categoryId: ""
    };
  }

  if (state.transactionFilters.categoryId && !categoryIds.has(state.transactionFilters.categoryId)) {
    state.transactionFilters = {
      ...state.transactionFilters,
      categoryId: ""
    };
  }

  const accountOptionsMarkup = [
    '<option value="">All accounts</option>',
    ...accounts.map(
      (account) =>
        `<option value="${escapeHtml(account.id)}">${escapeHtml(
          account.displayName || "Untitled account"
        )}</option>`
    )
  ].join("");

  const categoryOptionsMarkup = [
    '<option value="">All categories</option>',
    ...categories.map((category) => {
      const groupName = category.group?.name ? `${category.group.name} • ` : "";
      return `<option value="${escapeHtml(category.id)}">${escapeHtml(
        `${groupName}${category.name || "Untitled category"}`
      )}</option>`;
    })
  ].join("");

  if (transactionsAccountFilterEl.innerHTML !== accountOptionsMarkup) {
    transactionsAccountFilterEl.innerHTML = accountOptionsMarkup;
  }

  if (transactionsCategoryFilterEl.innerHTML !== categoryOptionsMarkup) {
    transactionsCategoryFilterEl.innerHTML = categoryOptionsMarkup;
  }

  if (transactionsSearchInputEl.value !== state.transactionDraftFilters.search) {
    transactionsSearchInputEl.value = state.transactionDraftFilters.search;
  }

  if (transactionsAccountFilterEl.value !== state.transactionDraftFilters.accountId) {
    transactionsAccountFilterEl.value = state.transactionDraftFilters.accountId;
  }

  if (transactionsCategoryFilterEl.value !== state.transactionDraftFilters.categoryId) {
    transactionsCategoryFilterEl.value = state.transactionDraftFilters.categoryId;
  }

  if (transactionsStartDateEl.value !== state.transactionDraftFilters.startDate) {
    transactionsStartDateEl.value = state.transactionDraftFilters.startDate;
  }

  if (transactionsEndDateEl.value !== state.transactionDraftFilters.endDate) {
    transactionsEndDateEl.value = state.transactionDraftFilters.endDate;
  }

  const isAuthenticated = Boolean(state.auth?.authenticated);
  const partialDateRange = hasPartialTransactionDateRange();
  const hasMoreTransactions = state.transactions.length < state.transactionsTotalCount;
  const remainingTransactions = Math.max(
    state.transactionsTotalCount - state.transactions.length,
    0
  );
  const showPagination =
    isAuthenticated && state.transactions.length > 0 && (hasMoreTransactions || state.transactionsLoading);

  transactionsSearchInputEl.disabled = !isAuthenticated;
  transactionsAccountFilterEl.disabled = !isAuthenticated;
  transactionsCategoryFilterEl.disabled = !isAuthenticated;
  transactionsStartDateEl.disabled = !isAuthenticated;
  transactionsEndDateEl.disabled = !isAuthenticated;
  transactionsApplyButtonEl.disabled =
    !isAuthenticated || state.refreshInFlight || state.transactionsLoading || partialDateRange;
  transactionsResetButtonEl.disabled =
    !isAuthenticated ||
    state.refreshInFlight ||
    state.transactionsLoading ||
    (!hasAnyTransactionInput() && countActiveTransactionFilters() === 0);
  transactionsDateHintEl.hidden = !partialDateRange;

  transactionsPaginationEl.hidden = !showPagination;
  transactionsPaginationEl.classList.toggle(
    "is-loading",
    state.transactionsLoading && hasMoreTransactions
  );
  transactionsPaginationCopyEl.textContent =
    state.transactionsLoading && hasMoreTransactions
      ? "Loading more transactions…"
      : `Scroll for ${formatInteger(Math.min(TRANSACTION_LIMIT, remainingTransactions))} more`;
}

function renderTransactionsMeta() {
  if (!state.auth?.authenticated) {
    transactionsFootnoteEl.textContent = "Sign in to view recent transaction activity.";
    transactionsResultsMetaEl.textContent = "More transactions will appear here once signed in.";
    transactionsPaginationEl.hidden = true;
    return;
  }

  const activeFilters = countActiveTransactionFilters();
  const descriptor = activeFilters ? "matching transactions" : "recent transactions";
  const filterLabel =
    activeFilters > 0 ? ` • ${activeFilters} filter${activeFilters === 1 ? "" : "s"} active` : "";
  const remainingTransactions = Math.max(
    state.transactionsTotalCount - state.transactions.length,
    0
  );

  if ((!state.transactionsInitialized || state.transactionsLoading) && !state.transactions.length) {
    transactionsFootnoteEl.textContent = "Loading recent transactions…";
    transactionsResultsMetaEl.textContent = "Loading transaction activity…";
    return;
  }

  transactionsFootnoteEl.textContent = `Showing ${formatInteger(
    state.transactions.length
  )} of ${formatInteger(state.transactionsTotalCount)} ${descriptor}${filterLabel}.`;

  if (!state.transactions.length) {
    transactionsResultsMetaEl.textContent = activeFilters
      ? "No transactions match the current filters."
      : "No transactions available for this view.";
    return;
  }

  transactionsResultsMetaEl.textContent =
    remainingTransactions > 0
      ? `${formatInteger(remainingTransactions)} more ${descriptor} available.`
      : activeFilters > 0
        ? "End of filtered results."
        : "End of recent activity.";
}

async function refreshAppUpdateStatus(options = {}) {
  try {
    const update = await window.monarchDesktop.checkForAppUpdates(Boolean(options.force));
    state.appUpdate = update;
    renderUpdateBanner();
  } catch (error) {
    setStatus("error", "Update check failed", error.message || String(error));
  }
}

function renderTransactions() {
  if (!state.transactions.length) {
    transactionsListEl.innerHTML =
      '<div class="empty-state padded">No transactions available for this view.</div>';
    renderTransactionsMeta();
    renderTransactionControls();
    return;
  }

  transactionsListEl.innerHTML = state.transactions
    .map((transaction) => {
      const merchant =
        transaction.merchant?.name ||
        transaction.plaidName ||
        transaction.dataProviderDescription ||
        "Unknown merchant";
      const accountName = transaction.account?.displayName || "Unknown account";
      const categoryName = transaction.category?.name || "Uncategorized";
      const amount = typeof transaction.amount === "number" ? transaction.amount : 0;
      const amountClass = amount >= 0 ? "amount-positive" : "amount-negative";
      const notes = transaction.notes
        ? `<span class="transaction-note">${escapeHtml(transaction.notes)}</span>`
        : "";

      return `
        <div class="transaction-row">
          <span class="mono">${escapeHtml(formatDate(transaction.date))}</span>
          <span class="transaction-main">
            <strong>${escapeHtml(merchant)}</strong>
            ${notes}
          </span>
          <span>${escapeHtml(accountName)}</span>
          <span>${escapeHtml(categoryName)}</span>
          <span class="numeric mono ${amountClass}">${escapeHtml(formatCurrency(amount))}</span>
        </div>
      `;
    })
    .join("");

  renderTransactionsMeta();
  renderTransactionControls();
}

function renderAccounts() {
  const accounts = sortAccounts(getMonitorAccounts()).filter((account) =>
    matchesFilter(account, getAccountMonitorState(account))
  );

  if (!accounts.length) {
    accountsFeedEl.innerHTML =
      '<div class="empty-state padded">No accounts match the current filter.</div>';
    return;
  }

  accountsFeedEl.innerHTML = accounts
    .map((account) => {
      const balance = getDisplayBalance(account);
      const monitorState = getAccountMonitorState(account);
      const institutionName = account.institution?.name || "Manual";
      const provider = account.dataProvider
        ? String(account.dataProvider).toUpperCase()
        : "MANUAL";
      const transactionsCount = formatInteger(account.transactionsCount || 0);

      return `
        <div class="account-row">
          <span class="account-main">
            <strong class="account-name">${escapeHtml(account.displayName || "Untitled account")}</strong>
            <span class="account-sub">${escapeHtml(institutionName)} • ${escapeHtml(provider)}</span>
          </span>
          <span class="state-badge tone-${escapeHtml(monitorState.kind)}">
            <span class="state-dot"></span>
            ${escapeHtml(monitorState.label)}
          </span>
          <span class="mono">
            ${escapeHtml(formatRelative(monitorState.updatedAt))}
          </span>
          <span class="mono">
            ${escapeHtml(transactionsCount)} tx
          </span>
          <span class="numeric mono">
            ${escapeHtml(formatCurrency(balance))}
          </span>
        </div>
      `;
    })
    .join("");
}

function renderBudgetSnapshot() {
  const categories = [...(state.budgetHistory?.categories || [])]
    .filter((category) => (category.currentMonth?.actual || 0) > 0.01)
    .sort((left, right) => (right.currentMonth?.actual || 0) - (left.currentMonth?.actual || 0));

  if (!categories.length) {
    budgetSnapshotFootnoteEl.textContent = state.auth?.authenticated
      ? "No current-month category spend yet."
      : "Sign in to inspect current-month category spend.";
    budgetSnapshotListEl.innerHTML =
      `<div class="empty-state padded">${
        state.auth?.authenticated
          ? "No current-month category spend yet."
          : "Sign in to inspect current-month category spend."
      }</div>`;
    return;
  }

  budgetSnapshotFootnoteEl.textContent = formatMonth(state.budgetHistory?.endMonth);
  budgetSnapshotListEl.innerHTML = categories
    .map((category) => {
      const currentMonth = category.currentMonth || {};
      const tone = getBudgetTone(category);
      const planned = currentMonth.planned || 0;
      const utilization = currentMonth.utilization;
      const fillWidth = planned > 0 && typeof utilization === "number"
        ? Math.min(utilization, 1) * 100
        : currentMonth.actual > 0.01
          ? 100
          : 0;

      return `
        <article class="budget-snapshot-row tone-${escapeHtml(tone)}">
          <div class="budget-snapshot-head">
            <strong class="budget-snapshot-name">
              ${escapeHtml(category.name || "Untitled category")}
            </strong>
            <div class="budget-snapshot-values">
              <strong class="budget-snapshot-amount">${escapeHtml(formatCurrency(currentMonth.actual))}</strong>
              <span class="budget-snapshot-target">
                ${planned > 0 ? escapeHtml(formatCurrency(planned)) : "No target"}
              </span>
            </div>
          </div>

          <div class="budget-snapshot-bar">
            <span class="budget-snapshot-fill" style="width: ${fillWidth.toFixed(2)}%"></span>
          </div>
        </article>
      `;
    })
    .join("");
}

function buildLinePath(points) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
}

function buildAreaPath(points, height, paddingY) {
  return [
    `M ${points[0].x.toFixed(2)} ${(height - paddingY).toFixed(2)}`,
    ...points.map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`),
    `L ${points[points.length - 1].x.toFixed(2)} ${(height - paddingY).toFixed(2)}`,
    "Z"
  ].join(" ");
}

function buildSeriesPoints(values, width, height, paddingX, paddingY, maxValue) {
  return values.map((value, index) => {
    const x =
      paddingX + (index / Math.max(values.length - 1, 1)) * (width - paddingX * 2);
    const y =
      height -
      paddingY -
      (value / Math.max(maxValue, 1)) * (height - paddingY * 2);
    return { x, y };
  });
}

function getBudgetTone(category) {
  const currentMonth = category.currentMonth || {};

  if ((currentMonth.planned || 0) <= 0 && (currentMonth.actual || 0) > 0.01) {
    return "unbudgeted";
  }

  if ((currentMonth.variance || 0) > 0.01) {
    return "over";
  }

  if ((currentMonth.variance || 0) < -0.01) {
    return "under";
  }

  return "flat";
}

function formatBudgetStatus(currentMonth) {
  const planned = currentMonth.planned || 0;
  const actual = currentMonth.actual || 0;
  const variance = currentMonth.variance || 0;

  if (planned <= 0 && actual > 0.01) {
    return "Unbudgeted";
  }

  if (variance > 0.01) {
    return `${formatMetricCurrency(variance)} over`;
  }

  if (variance < -0.01) {
    return `${formatMetricCurrency(Math.abs(variance))} under`;
  }

  return "On plan";
}

function formatBudgetUtilization(currentMonth) {
  const utilization = currentMonth.utilization;
  if (typeof utilization !== "number" || Number.isNaN(utilization)) {
    return "No target set";
  }

  return `${percentFormatter.format(utilization)} used`;
}

function renderBudgetTile(category) {
  const series = category.series || [];
  const currentMonth = category.currentMonth || {};
  const tone = getBudgetTone(category);
  const values = series.flatMap((point) => [point.actual || 0, point.planned || 0]);
  const maxValue = Math.max(...values, 1);
  const actualPoints = buildSeriesPoints(
    series.map((point) => point.actual || 0),
    SPARKLINE_WIDTH,
    SPARKLINE_HEIGHT,
    SPARKLINE_PADDING_X,
    SPARKLINE_PADDING_Y,
    maxValue
  );
  const plannedPoints = buildSeriesPoints(
    series.map((point) => point.planned || 0),
    SPARKLINE_WIDTH,
    SPARKLINE_HEIGHT,
    SPARKLINE_PADDING_X,
    SPARKLINE_PADDING_Y,
    maxValue
  );

  const actualLinePath = buildLinePath(actualPoints);
  const actualAreaPath = buildAreaPath(actualPoints, SPARKLINE_HEIGHT, SPARKLINE_PADDING_Y);
  const plannedLinePath = buildLinePath(plannedPoints);
  const startMonth = series[0]?.month;
  const endMonth = series[series.length - 1]?.month;

  return `
    <article class="budget-tile tone-${escapeHtml(tone)}">
      <div class="budget-tile-top">
        <span class="budget-group-label">${escapeHtml(category.group?.name || "Budget")}</span>
        <span class="budget-status">${escapeHtml(formatBudgetStatus(currentMonth))}</span>
      </div>

      <div class="budget-tile-main">
        <h3>${escapeHtml(category.name || "Untitled category")}</h3>
        <strong>${escapeHtml(formatCurrency(currentMonth.actual))}</strong>
      </div>

      <div class="budget-tile-meta">
        <span>Target ${escapeHtml(formatCurrency(currentMonth.planned))}</span>
        <span>${escapeHtml(formatBudgetUtilization(currentMonth))}</span>
      </div>

      <div class="budget-spark-shell">
        <svg
          class="budget-spark"
          viewBox="0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}"
          preserveAspectRatio="none"
          aria-label="${escapeHtml(category.name || "Budget category")} history"
        >
          <path class="budget-spark-plan" d="${plannedLinePath}"></path>
          <path class="budget-spark-area" d="${actualAreaPath}"></path>
          <path class="budget-spark-line" d="${actualLinePath}"></path>
        </svg>
      </div>

      <div class="budget-tile-axis">
        <span>${escapeHtml(formatMonth(startMonth))}</span>
        <span>${escapeHtml(formatMonth(endMonth))}</span>
      </div>
    </article>
  `;
}

function getBudgetSections(categories, groups) {
  const sectionMap = new Map();

  (groups || []).forEach((group) => {
    if (!group?.id) {
      return;
    }

    sectionMap.set(group.id, {
      group,
      categories: []
    });
  });

  categories.forEach((category) => {
    const group = category.group || {};
    const groupId = group.id || "ungrouped";

    if (!sectionMap.has(groupId)) {
      sectionMap.set(groupId, {
        group: {
          id: groupId,
          name: group.name || "Other",
          order: group.order || 0,
          type: group.type || ""
        },
        categories: []
      });
    }

    sectionMap.get(groupId).categories.push(category);
  });

  return [...sectionMap.values()]
    .filter((section) => section.categories.length)
    .map((section) => {
      const actualCurrentMonth = section.categories.reduce(
        (sum, category) => sum + ((category.currentMonth || {}).actual || 0),
        0
      );
      const plannedCurrentMonth = section.categories.reduce(
        (sum, category) => sum + ((category.currentMonth || {}).planned || 0),
        0
      );

      return {
        ...section,
        actualCurrentMonth,
        plannedCurrentMonth
      };
    })
    .sort((left, right) => {
      const leftOrder = left.group?.order || 0;
      const rightOrder = right.group?.order || 0;
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return String(left.group?.name || "").localeCompare(String(right.group?.name || ""));
    });
}

function renderBudgetSection(section) {
  return `
    <section class="budget-group-section">
      <header class="budget-group-header">
        <div class="budget-group-copy">
          <p class="budget-group-kicker">Budget group</p>
          <h3>${escapeHtml(section.group?.name || "Other")}</h3>
        </div>

        <div class="budget-group-summary">
          <span>${escapeHtml(formatInteger(section.categories.length))} categories</span>
          <span>${escapeHtml(formatCurrency(section.actualCurrentMonth))} spent</span>
          <span>${escapeHtml(formatCurrency(section.plannedCurrentMonth))} planned</span>
        </div>
      </header>

      <div class="budget-group-grid">
        ${section.categories.map((category) => renderBudgetTile(category)).join("")}
      </div>
    </section>
  `;
}

function renderBudgetHistory() {
  const categories = state.budgetHistory?.categories || [];
  const summary = state.budgetHistory?.summary || {};

  if (!categories.length) {
    budgetCategoryCountEl.textContent = "0";
    budgetOverCountEl.textContent = "0";
    budgetUnderCountEl.textContent = "0";
    budgetActualTotalEl.textContent = "—";
    budgetPlannedTotalEl.textContent = "—";
    budgetHistoryFootnoteEl.textContent = state.auth?.authenticated
      ? "No budget categories with activity in this window."
      : "Sign in to load monthly budget history.";
    budgetTilesEl.innerHTML =
      `<div class="empty-state padded">${
        state.auth?.authenticated
          ? "No budget categories with activity in this window."
          : "Sign in to load budget category trends."
      }</div>`;
    return;
  }

  budgetCategoryCountEl.textContent = formatInteger(summary.categoryCount || categories.length);
  budgetOverCountEl.textContent = formatInteger(summary.overPlanCount || 0);
  budgetUnderCountEl.textContent = formatInteger(summary.underPlanCount || 0);
  budgetActualTotalEl.textContent = formatMetricCurrency(summary.actualCurrentMonth || 0);
  budgetPlannedTotalEl.textContent = formatMetricCurrency(summary.plannedCurrentMonth || 0);
  const sections = getBudgetSections(categories, state.budgetHistory?.groups || []);
  budgetHistoryFootnoteEl.textContent =
    `${formatInteger(categories.length)} categories across ${formatInteger(sections.length)} groups • ${formatMonth(state.budgetHistory?.startMonth)} to ${formatMonth(state.budgetHistory?.endMonth)}`;
  budgetTilesEl.innerHTML = sections.map((section) => renderBudgetSection(section)).join("");
}

function renderCashflowHistory() {
  const series = state.cashflowHistory?.series || [];
  const summary = state.cashflowHistory?.summary || {};

  if (!series.length) {
    cashflowFootnoteEl.textContent = state.auth?.authenticated
      ? "No monthly cashflow activity in this window."
      : "Sign in to load monthly income and expense history.";
    cashflowIncomeTotalEl.textContent = "—";
    cashflowExpenseTotalEl.textContent = "—";
    cashflowNetTotalEl.textContent = "—";
    cashflowBestMonthEl.textContent = "—";
    cashflowBestMonthCaptionEl.textContent = "Highest monthly net";
    cashflowChartEl.innerHTML =
      `<div class="empty-state padded">${
        state.auth?.authenticated
          ? "No monthly cashflow activity in this window."
          : "Sign in to load monthly money flow."
      }</div>`;
    return;
  }

  const activeIndex =
    typeof state.cashflowHoverIndex === "number" &&
    state.cashflowHoverIndex >= 0 &&
    state.cashflowHoverIndex < series.length
      ? state.cashflowHoverIndex
      : series.length - 1;
  const activePoint = series[activeIndex];
  const bestNetMonth = summary.bestNetMonth || null;
  const maxValue = Math.max(
    ...series.map((point) => Math.max(point.flow || 0, point.income || 0, point.expense || 0)),
    1
  );
  const guideValue = Math.max(activePoint.income || 0, activePoint.expense || 0, 0);
  const guideY = 100 - (guideValue / maxValue) * 100;
  const focusLeft = ((activeIndex + 0.5) / series.length) * 100;
  const densityClass =
    series.length > 18 ? " is-ultra-dense" : series.length > 12 ? " is-dense" : "";

  cashflowIncomeTotalEl.textContent = formatMetricCurrency(summary.totalIncome || 0);
  cashflowExpenseTotalEl.textContent = formatMetricCurrency(summary.totalExpense || 0);
  cashflowNetTotalEl.textContent = formatSignedCompactCurrency(summary.totalNet || 0);
  cashflowBestMonthEl.textContent = bestNetMonth?.month
    ? formatMonth(bestNetMonth.month)
    : "—";
  cashflowBestMonthCaptionEl.textContent = bestNetMonth
    ? `${formatSignedCompactCurrency(bestNetMonth.net || 0)} net`
    : "Highest monthly net";
  cashflowFootnoteEl.textContent =
    `${formatMonth(state.cashflowHistory?.startMonth)} to ${formatMonth(state.cashflowHistory?.endMonth)}`;

  const monthBars = series
    .map((point, index) => {
      const flowHeight = ((point.flow || 0) / maxValue) * 100;
      const incomeHeight = ((point.income || 0) / maxValue) * 100;
      const expenseHeight = ((point.expense || 0) / maxValue) * 100;
      const isActive = index === activeIndex;

      return `
        <div class="cashflow-month">
          <button
            class="cashflow-month-button${isActive ? " is-active" : ""}"
            data-index="${index}"
            type="button"
            aria-label="${escapeHtml(formatMonth(point.month))} cashflow"
          >
            <span class="cashflow-flow-bar" style="height: ${flowHeight.toFixed(2)}%"></span>
            <span class="cashflow-income-bar" style="height: ${incomeHeight.toFixed(2)}%"></span>
            <span class="cashflow-expense-bar" style="height: ${expenseHeight.toFixed(2)}%"></span>
          </button>
          <span class="cashflow-month-label">${escapeHtml(formatMonthShort(point.month))}</span>
        </div>
      `;
    })
    .join("");

  cashflowChartEl.innerHTML = `
    <div
      class="cashflow-plot"
      style="--cashflow-guide-y: ${guideY.toFixed(2)}%; --cashflow-focus-left: ${focusLeft.toFixed(2)}%;"
    >
      <div class="cashflow-guide"></div>
      <div class="cashflow-tooltip">
        <span class="cashflow-tooltip-label">${escapeHtml(formatMonth(activePoint.month))}</span>
        <strong>${escapeHtml(formatCurrency(activePoint.income || 0))}</strong>
        <div class="cashflow-tooltip-meta">
          <span>Income</span>
          <span>${escapeHtml(formatCurrency(activePoint.income || 0))}</span>
          <span>Expense</span>
          <span>${escapeHtml(formatCurrency(activePoint.expense || 0))}</span>
          <span>Net</span>
          <span>${escapeHtml(formatSignedCurrency(activePoint.net || 0))}</span>
        </div>
      </div>
      <div class="cashflow-focus-dot"></div>
      <div
        class="cashflow-month-grid${densityClass}"
        style="grid-template-columns: repeat(${series.length}, minmax(0, 1fr));"
      >
        ${monthBars}
      </div>
    </div>
  `;
}

function renderNetWorthChart() {
  const series = state.netWorthHistory?.series || [];

  if (!series.length) {
    chartSvgEl.innerHTML = "";
    chartEmptyEl.classList.remove("is-loading");
    chartEmptyEl.hidden = false;
    chartEmptyEl.style.display = "grid";
    chartEmptyEl.textContent = state.auth?.authenticated
      ? "No net worth history in this window."
      : "Sign in to load net worth history.";
    historyCurrentEl.textContent = "—";
    historyChangeEl.textContent = "—";
    historyRangeEl.textContent = "—";
    historyChangeEl.classList.remove("amount-positive", "amount-negative");
    historyStartEl.textContent = "—";
    historyEndEl.textContent = "—";
    return;
  }

  chartEmptyEl.hidden = true;
  chartEmptyEl.style.display = "none";
  chartEmptyEl.classList.remove("is-loading");
  chartEmptyEl.innerHTML = "";

  const values = series.map((point) => point.netWorth);
  let minValue = Math.min(...values);
  let maxValue = Math.max(...values);
  if (minValue === maxValue) {
    minValue -= 1;
    maxValue += 1;
  }

  const points = series.map((point, index) => {
    const x =
      CHART_PADDING_X +
      (index / Math.max(series.length - 1, 1)) * (CHART_WIDTH - CHART_PADDING_X * 2);
    const y =
      CHART_HEIGHT -
      CHART_PADDING_Y -
      ((point.netWorth - minValue) / (maxValue - minValue)) *
        (CHART_HEIGHT - CHART_PADDING_Y * 2);
    return { x, y, point };
  });

  const linePath = buildLinePath(points);
  const areaPath = buildAreaPath(points, CHART_HEIGHT, CHART_PADDING_Y);
  const gridLines = Array.from({ length: 4 }, (_value, index) => {
    const y = CHART_PADDING_Y + (index / 3) * (CHART_HEIGHT - CHART_PADDING_Y * 2);
    return `<line x1="${CHART_PADDING_X}" y1="${y.toFixed(2)}" x2="${CHART_WIDTH - CHART_PADDING_X}" y2="${y.toFixed(2)}"></line>`;
  }).join("");

  const latestPoint = series[series.length - 1];
  const firstPoint = series[0];
  const rangeDelta = latestPoint.netWorth - firstPoint.netWorth;
  const rangeChange =
    Math.abs(firstPoint.netWorth || 0) > 0.01
      ? rangeDelta / Math.abs(firstPoint.netWorth)
      : null;
  const rangeLabel = `${formatDate(firstPoint.date)} → ${formatDate(latestPoint.date)}`;

  chartSvgEl.innerHTML = `
    <g class="chart-grid">${gridLines}</g>
    <path class="chart-area" d="${areaPath}"></path>
    <path class="chart-line" d="${linePath}"></path>
    <circle class="chart-endpoint" cx="${points[points.length - 1].x.toFixed(2)}" cy="${points[points.length - 1].y.toFixed(2)}" r="4"></circle>
  `;

  historyCurrentEl.textContent = formatCurrency(latestPoint.netWorth);
  historyChangeEl.textContent = formatSignedPercent(rangeChange);
  historyChangeEl.classList.toggle("amount-positive", (rangeChange || 0) > 0);
  historyChangeEl.classList.toggle("amount-negative", (rangeChange || 0) < 0);
  historyRangeEl.textContent = rangeLabel;
  historyStartEl.textContent = formatDate(firstPoint.date);
  historyEndEl.textContent = formatDate(latestPoint.date);
}

function resetSurface(auth = {}) {
  state.auth = auth;
  state.accounts = [];
  state.budgetHistory = null;
  state.cashflowHistory = null;
  state.summary = {};
  state.currentMonthSummary = null;
  state.transactions = [];
  state.transactionsTotalCount = 0;
  state.transactionsLoading = false;
  state.transactionsInitialized = false;
  state.transactionCategories = [];
  state.netWorthHistory = null;
  state.historyFetchedAt = null;
  state.cashflowFetchedAt = null;
  state.cashflowHoverIndex = null;

  netWorthTotalEl.textContent = "—";
  assetTotalEl.textContent = "—";
  liabilityTotalEl.textContent = "—";
  incomeTotalEl.textContent = "—";
  expenseTotalEl.textContent = "—";
  transactionCountEl.textContent = "0";
  institutionCountEl.textContent = "0";
  accountCountEl.textContent = "0";
  liveCountEl.textContent = "0";
  manualCountEl.textContent = "0";
  accountFootnoteEl.textContent = "Sign in to load account state.";
  transactionsFootnoteEl.textContent = "Sign in to view recent transaction activity.";
  transactionsResultsMetaEl.textContent = "More transactions will appear here once signed in.";
  summaryFirstEl.textContent = "—";
  summaryLastEl.textContent = "—";

  renderNetWorthChart();
  renderTransactions();
  renderAccounts();
  renderBudgetSnapshot();
  renderBudgetHistory();
  renderCashflowHistory();
  renderTransactionControls();
  renderUpdateBanner();
  updateTopbarActions();
  syncLoadingState();
}

function updateMonitorSummary() {
  const visibleAccounts = getMonitorAccounts();
  const trackedNetWorthAccounts = getNetWorthAccounts();
  const institutions = new Set(
    visibleAccounts.map((account) => account.institution?.name || "Manual")
  );
  const attentionCount = visibleAccounts.filter((account) => {
    const monitorState = getAccountMonitorState(account);
    return monitorState.kind === "attention" || monitorState.kind === "offline";
  }).length;
  const manualCount = visibleAccounts.filter(
    (account) => getAccountMonitorState(account).kind === "manual"
  ).length;
  const liveCount = visibleAccounts.filter(
    (account) => getAccountMonitorState(account).kind === "live"
  ).length;

  const fallbackNetWorth = trackedNetWorthAccounts.reduce((sum, account) => {
    const balance = getDisplayBalance(account);
    return typeof balance === "number" ? sum + balance : sum;
  }, 0);
  const fallbackAssets = trackedNetWorthAccounts.reduce((sum, account) => {
    const balance = getDisplayBalance(account);
    if (!account.isAsset || typeof balance !== "number") {
      return sum;
    }
    return sum + balance;
  }, 0);
  const fallbackLiabilities = trackedNetWorthAccounts.reduce((sum, account) => {
    const balance = getDisplayBalance(account);
    if (account.isAsset || typeof balance !== "number") {
      return sum;
    }
    return sum + Math.abs(balance);
  }, 0);

  const latestHistoryPoint =
    state.netWorthHistory?.series?.[state.netWorthHistory.series.length - 1];
  const netWorth = latestHistoryPoint?.netWorth ?? fallbackNetWorth;
  const assets = latestHistoryPoint?.assets ?? fallbackAssets;
  const liabilities = latestHistoryPoint?.liabilities ?? fallbackLiabilities;
  const monthSummary = state.currentMonthSummary?.summary || {};
  const income = Math.abs(monthSummary.sumIncome || 0);
  const expenses = Math.abs(monthSummary.sumExpense || 0);

  netWorthTotalEl.textContent = formatMetricCurrency(netWorth);
  assetTotalEl.textContent = formatMetricCurrency(assets);
  liabilityTotalEl.textContent = formatMetricCurrency(liabilities);
  incomeTotalEl.textContent = formatMetricCurrency(income);
  expenseTotalEl.textContent = formatMetricCurrency(expenses);
  transactionCountEl.textContent = formatInteger(monthSummary.count || 0);
  institutionCountEl.textContent = formatInteger(institutions.size);
  accountCountEl.textContent = formatInteger(visibleAccounts.length);
  liveCountEl.textContent = formatInteger(liveCount);
  manualCountEl.textContent = formatInteger(manualCount);
  summaryFirstEl.textContent = formatDate(state.summary.first);
  summaryLastEl.textContent = formatDate(state.summary.last);
  accountFootnoteEl.textContent =
    `${visibleAccounts.length} visible accounts • ${attentionCount} attention • ${manualCount} manual`;
  renderTransactionsMeta();
}

async function refreshTransactions(options = {}) {
  if (state.transactionsLoading || !state.auth?.authenticated) {
    renderTransactionsMeta();
    renderTransactionControls();
    return;
  }

  const { reset = false } = options;
  const offset = reset ? 0 : state.transactions.length;
  state.transactionsLoading = true;
  renderTransactionsMeta();
  renderTransactionControls();

  if (!state.transactions.length) {
    transactionsListEl.innerHTML = buildTransactionsLoading();
  }

  try {
    const payload = await window.monarchDesktop.getTransactions(
      getTransactionsQueryParams({ offset })
    );
    const nextTransactions = payload.transactions || [];

    state.transactions = reset ? nextTransactions : [...state.transactions, ...nextTransactions];
    state.transactionsTotalCount = payload.totalCount || state.transactions.length;
    state.transactionsInitialized = true;
    renderTransactions();
  } catch (error) {
    if (!state.transactions.length) {
      renderTransactions();
    }
    setStatus("error", "Transaction load failed", error.message || String(error));
  } finally {
    state.transactionsLoading = false;
    renderTransactionsMeta();
    renderTransactionControls();
  }
}

function shouldRefreshNetWorthHistory(forceHistory) {
  if (forceHistory) {
    return true;
  }

  if (!state.historyFetchedAt || !state.netWorthHistory?.series?.length) {
    return true;
  }

  return Date.now() - state.historyFetchedAt >= HISTORY_REFRESH_INTERVAL_MS;
}

function shouldRefreshCashflowHistory(forceHistory) {
  if (forceHistory) {
    return true;
  }

  if (!state.cashflowFetchedAt || !state.cashflowHistory?.series?.length) {
    return true;
  }

  return Date.now() - state.cashflowFetchedAt >= HISTORY_REFRESH_INTERVAL_MS;
}

async function refreshData(options = {}) {
  if (state.refreshInFlight) {
    return;
  }

  const { forceHistory = false, forceTransactions = false } = options;
  state.refreshInFlight = true;
  updateTopbarActions();
  syncLoadingState();
  renderInitialLoadingState();
  renderTransactionControls();
  document.body.classList.add("is-refreshing");

  try {
    const auth = await window.monarchDesktop.authStatus();
    state.auth = auth;
    updateTopbarActions();

    if (!auth.authenticated) {
      state.initialLoadResolved = true;
      resetSurface(auth);
      state.lastRefreshAt = Date.now();
      scheduleNextRefresh();
      return;
    }

    const netWorthHistoryPromise = shouldRefreshNetWorthHistory(forceHistory)
      ? window.monarchDesktop.getNetWorthHistory(HISTORY_DAYS)
      : Promise.resolve(null);
    const cashflowHistoryPromise =
      state.currentView === "cashflow" && shouldRefreshCashflowHistory(forceHistory)
        ? window.monarchDesktop.getCashflowHistory(state.cashflowHistoryMonths)
        : Promise.resolve(null);
    const transactionCategoriesPromise = state.transactionCategories.length
      ? Promise.resolve(null)
      : window.monarchDesktop.getTransactionCategories().catch((error) => {
          setStatus("error", "Category load failed", error.message || String(error));
          return null;
        });

    const [
      accountsPayload,
      budgetHistoryPayload,
      summaryPayload,
      currentMonthSummaryPayload,
      transactionCategoriesPayload,
      historyPayload,
      cashflowHistoryPayload
    ] = await Promise.all([
      window.monarchDesktop.getAccounts(),
      window.monarchDesktop.getBudgetHistory(state.budgetHistoryMonths),
      window.monarchDesktop.getSummary(),
      window.monarchDesktop.getCurrentMonthSummary(),
      transactionCategoriesPromise,
      netWorthHistoryPromise,
      cashflowHistoryPromise
    ]);

    state.accounts = accountsPayload.accounts || [];
    state.budgetHistory = budgetHistoryPayload;
    state.summary = summaryPayload.aggregates?.[0]?.summary || {};
    state.currentMonthSummary = currentMonthSummaryPayload;
    if (transactionCategoriesPayload?.categories) {
      state.transactionCategories = transactionCategoriesPayload.categories;
    }

    if (historyPayload) {
      state.netWorthHistory = historyPayload;
      state.historyFetchedAt = Date.now();
    }

    if (cashflowHistoryPayload) {
      state.cashflowHistory = cashflowHistoryPayload;
      state.cashflowFetchedAt = Date.now();
      if (
        typeof state.cashflowHoverIndex !== "number" ||
        state.cashflowHoverIndex >= (cashflowHistoryPayload.series || []).length
      ) {
        state.cashflowHoverIndex = Math.max(
          (cashflowHistoryPayload.series || []).length - 1,
          0
        );
      }
    }

    state.initialLoadResolved = true;
    syncLoadingState();
    updateMonitorSummary();
    renderFilterButtons();
    renderTransactionControls();
    renderCashflowRangeButtons();
    renderNetWorthChart();
    renderAccounts();
    renderBudgetSnapshot();
    renderBudgetHistory();
    renderCashflowHistory();

    if (forceTransactions || !state.transactionsInitialized) {
      await refreshTransactions({ reset: true });
    } else {
      renderTransactions();
    }

    state.lastRefreshAt = Date.now();
    scheduleNextRefresh();
  } catch (error) {
    if (!state.initialLoadResolved) {
      state.initialLoadResolved = true;
      resetSurface(state.auth || {});
    }
    setStatus("error", "Error", error.message || String(error));
    scheduleNextRefresh();
  } finally {
    state.refreshInFlight = false;
    syncLoadingState();
    updateTopbarActions();
    renderTransactionControls();
    window.setTimeout(() => {
      document.body.classList.remove("is-refreshing");
    }, 220);
  }
}

function updateTransactionDraft(partial) {
  state.transactionDraftFilters = {
    ...state.transactionDraftFilters,
    ...partial
  };
  renderTransactionControls();
}

async function applyTransactionFilters() {
  if (!state.auth?.authenticated || state.refreshInFlight || hasPartialTransactionDateRange()) {
    renderTransactionControls();
    return;
  }

  state.transactionFilters = normalizeTransactionFilters(state.transactionDraftFilters);
  await refreshTransactions({ reset: true });
}

async function resetTransactionFilters() {
  const nextFilters = { ...EMPTY_TRANSACTION_FILTERS };
  const wasDirty = hasAnyTransactionInput() || countActiveTransactionFilters() > 0;

  state.transactionDraftFilters = nextFilters;
  state.transactionFilters = nextFilters;
  renderTransactionControls();

  if (state.auth?.authenticated && wasDirty) {
    await refreshTransactions({ reset: true });
  }
}

async function loadMoreTransactions() {
  if (
    state.currentView !== "transactions" ||
    state.refreshInFlight ||
    state.transactionsLoading ||
    state.transactions.length >= state.transactionsTotalCount
  ) {
    renderTransactionControls();
    return;
  }

  renderTransactionControls();
  await refreshTransactions();
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.currentFilter = button.dataset.filter || "all";
    renderFilterButtons();
    renderAccounts();
  });
});

transactionsSearchInputEl.addEventListener("input", () => {
  updateTransactionDraft({ search: transactionsSearchInputEl.value });
});

transactionsSearchInputEl.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter") {
    return;
  }

  event.preventDefault();
  await applyTransactionFilters();
});

transactionsAccountFilterEl.addEventListener("change", () => {
  updateTransactionDraft({ accountId: transactionsAccountFilterEl.value });
});

transactionsCategoryFilterEl.addEventListener("change", () => {
  updateTransactionDraft({ categoryId: transactionsCategoryFilterEl.value });
});

transactionsStartDateEl.addEventListener("input", () => {
  updateTransactionDraft({ startDate: transactionsStartDateEl.value });
});

transactionsEndDateEl.addEventListener("input", () => {
  updateTransactionDraft({ endDate: transactionsEndDateEl.value });
});

transactionsApplyButtonEl.addEventListener("click", async () => {
  await applyTransactionFilters();
});

transactionsResetButtonEl.addEventListener("click", async () => {
  await resetTransactionFilters();
});

workspaceTabs.forEach((button) => {
  button.addEventListener("click", async () => {
    const view = button.dataset.view || "dashboard";
    if (view === state.currentView) {
      return;
    }

    state.currentView = view;
    updateWorkspaceTabs();

    if (view === "transactions" && state.auth?.authenticated && !state.transactionsInitialized) {
      await refreshTransactions({ reset: true });
      return;
    }

    if (view === "cashflow") {
      await refreshData();
    }
  });
});

budgetRangeButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    const months = Number(button.dataset.months);
    if (!months || months === state.budgetHistoryMonths) {
      return;
    }

    state.budgetHistoryMonths = months;
    renderBudgetRangeButtons();
    await refreshData();
  });
});

cashflowRangeButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    const months = Number(button.dataset.months);
    if (!months || months === state.cashflowHistoryMonths) {
      return;
    }

    state.cashflowHistoryMonths = months;
    state.cashflowHoverIndex = null;
    renderCashflowRangeButtons();
    await refreshData({ forceHistory: true });
  });
});

cashflowChartEl.addEventListener("mouseover", (event) => {
  const button = event.target.closest(".cashflow-month-button");
  if (!button) {
    return;
  }

  const index = Number(button.dataset.index);
  if (!Number.isInteger(index) || index === state.cashflowHoverIndex) {
    return;
  }

  state.cashflowHoverIndex = index;
  renderCashflowHistory();
});

cashflowChartEl.addEventListener("focusin", (event) => {
  const button = event.target.closest(".cashflow-month-button");
  if (!button) {
    return;
  }

  const index = Number(button.dataset.index);
  if (!Number.isInteger(index) || index === state.cashflowHoverIndex) {
    return;
  }

  state.cashflowHoverIndex = index;
  renderCashflowHistory();
});

refreshButtonEl.addEventListener("click", async () => {
  await refreshData({
    forceHistory: true,
    forceTransactions: state.currentView === "transactions"
  });
  await refreshAppUpdateStatus();
});

authActionButtonEl.addEventListener("click", async () => {
  if (state.auth?.authenticated) {
    try {
      await window.monarchDesktop.logout();
      await refreshData({ forceHistory: true });
    } catch (error) {
      setStatus("error", "Logout failed", error.message || String(error));
    }
    return;
  }

  try {
    await window.monarchDesktop.openBrowserLogin();
  } catch (error) {
    setStatus("error", "Browser auth failed", error.message || String(error));
  }
});

updateDownloadButtonEl.addEventListener("click", async () => {
  try {
    await window.monarchDesktop.openUpdateDownload();
  } catch (error) {
    setStatus("error", "Update download failed", error.message || String(error));
  }
});

updateDismissButtonEl.addEventListener("click", () => {
  state.dismissedUpdateVersion = state.appUpdate?.latestVersion || null;
  renderUpdateBanner();
});

window.setInterval(() => {
  if (state.nextRefreshAt && Date.now() >= state.nextRefreshAt) {
    refreshData().catch((error) => {
      setStatus("error", "Polling error", error.message || String(error));
    });
  }
}, 1000);

window.setInterval(() => {
  refreshAppUpdateStatus().catch((error) => {
    setStatus("error", "Update polling failed", error.message || String(error));
  });
}, 30 * 60 * 1000);

async function boot() {
  try {
    state.runtimeInfo = await window.monarchDesktop.runtimeInfo();
    setupTransactionsPaginationObserver();
    updateTopbarActions();
    updateWorkspaceTabs();
    renderBudgetRangeButtons();
    renderCashflowRangeButtons();
    renderTransactionControls();
    renderUpdateBanner();
    await Promise.all([
      refreshData({ forceHistory: true }),
      refreshAppUpdateStatus({ force: true })
    ]);
  } catch (error) {
    setStatus("error", "Startup failed", error.message || String(error));
  }
}

boot();
