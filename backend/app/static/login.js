const statusPill = document.getElementById("status-pill");
const statusDetail = document.getElementById("status-detail");

const credentialsForm = document.getElementById("credentials-form");
const otpForm = document.getElementById("otp-form");
const tokenForm = document.getElementById("token-form");

const otpTitle = document.getElementById("otp-title");
const otpDetail = document.getElementById("otp-detail");
const otpLabel = document.getElementById("otp-label");
const otpCodeInput = document.getElementById("otp-code");

const successDetail = document.getElementById("success-detail");
const errorTitle = document.getElementById("error-title");
const errorDetail = document.getElementById("error-detail");

const tokenPanel = document.getElementById("token-panel");
const tokenLink = document.getElementById("token-link");
const tokenClose = document.getElementById("token-close");
const successDone = document.getElementById("success-done");
const successLogout = document.getElementById("success-logout");
const errorRetry = document.getElementById("error-retry");
const errorReset = document.getElementById("error-reset");
const otpBack = document.getElementById("otp-back");

const screens = Array.from(document.querySelectorAll("[data-screen]"));
const indicators = Array.from(document.querySelectorAll("[data-step-indicator]"));

const state = {
  screen: "credentials",
  email: "",
  password: "",
  challengeCode: "email_otp_required",
  lastError: "",
  lastScreenBeforeError: "credentials"
};

function setStatus(authenticated, source, detail) {
  statusPill.className = "status-pill";
  if (authenticated) {
    statusPill.classList.add("ok");
    statusPill.textContent = "Authenticated";
  } else {
    statusPill.classList.add("warn");
    statusPill.textContent = "Signed out";
  }

  statusDetail.textContent = detail || (
    authenticated
      ? `Backend session is active via ${source || "credentials"}.`
      : "No active backend session."
  );
}

async function parseResponse(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const payload = await parseResponse(response);

  if (!response.ok) {
    const code = payload?.detail?.code || payload?.code || "request_failed";
    const message =
      payload?.detail?.message ||
      payload?.detail ||
      payload?.message ||
      "Request failed";
    const error = new Error(message);
    error.code = code;
    throw error;
  }

  return payload;
}

function setStepState(screen) {
  indicators.forEach((indicator) => {
    const name = indicator.dataset.stepIndicator;
    indicator.classList.remove("is-active", "is-complete");

    if (screen === "credentials" && name === "credentials") {
      indicator.classList.add("is-active");
    }

    if (screen === "otp") {
      if (name === "credentials") indicator.classList.add("is-complete");
      if (name === "otp") indicator.classList.add("is-active");
    }

    if (screen === "success") {
      if (name === "credentials" || name === "otp") indicator.classList.add("is-complete");
      if (name === "done") indicator.classList.add("is-active");
    }

    if (screen === "error") {
      if (name === state.lastScreenBeforeError) {
        indicator.classList.add("is-active");
      }
    }
  });
}

function showScreen(screen) {
  state.screen = screen;
  screens.forEach((element) => {
    element.classList.toggle("is-active", element.dataset.screen === screen);
  });
  setStepState(screen);
}

function showTokenPanel(visible) {
  tokenPanel.hidden = !visible;
  tokenPanel.classList.toggle("is-active", visible);
}

function configureOtpScreen(code, message) {
  state.challengeCode = code;

  if (code === "mfa_required") {
    otpTitle.textContent = "Enter verification code";
    otpLabel.textContent = "Verification code";
    otpDetail.textContent = message || "Enter the one-time code required for this Monarch login.";
  } else {
    otpTitle.textContent = "Check your email";
    otpLabel.textContent = "Email OTP";
    otpDetail.textContent = message || "Enter the verification code Monarch sent to your email.";
  }

  otpCodeInput.value = "";
}

function showError(message, fallbackScreen = "credentials") {
  state.lastError = message;
  state.lastScreenBeforeError = fallbackScreen;
  errorTitle.textContent = "We could not complete sign in.";
  errorDetail.textContent = message;
  showScreen("error");
}

async function refreshStatus() {
  try {
    const status = await request("/auth/status");
    setStatus(status.authenticated, status.auth_source);
    if (status.authenticated) {
      successDetail.textContent = `Backend session is active via ${status.auth_source || "credentials"}.`;
      showScreen("success");
    }
  } catch (error) {
    statusPill.className = "status-pill error";
    statusPill.textContent = "Unavailable";
    statusDetail.textContent = error.message;
  }
}

credentialsForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(credentialsForm);
  state.email = String(formData.get("email") || "").trim();
  state.password = String(formData.get("password") || "");

  try {
    const result = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: state.email,
        password: state.password
      })
    });
    successDetail.textContent = `Backend session is active via ${result.auth_source || "credentials"}.`;
    setStatus(true, result.auth_source);
    showScreen("success");
  } catch (error) {
    if (error.code === "email_otp_required" || error.code === "mfa_required") {
      configureOtpScreen(error.code, error.message);
      showScreen("otp");
      return;
    }

    await refreshStatus();
    showError(error.message, "credentials");
  }
});

otpForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const code = otpCodeInput.value.trim();
  if (!code) {
    showError("Enter the verification code before continuing.", "otp");
    return;
  }

  const payload = {
    email: state.email,
    password: state.password
  };

  if (state.challengeCode === "mfa_required") {
    payload.mfa_code = code;
  } else {
    payload.email_otp = code;
  }

  try {
    const result = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    successDetail.textContent = `Backend session is active via ${result.auth_source || "credentials"}.`;
    setStatus(true, result.auth_source);
    showScreen("success");
  } catch (error) {
    await refreshStatus();
    showError(error.message, "otp");
  }
});

tokenForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const token = document.getElementById("token").value.trim();
  if (!token) {
    showError("Paste a token before continuing.", "credentials");
    return;
  }

  try {
    const result = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ token })
    });
    successDetail.textContent = `Backend session is active via ${result.auth_source || "token"}.`;
    setStatus(true, result.auth_source);
    showTokenPanel(false);
    showScreen("success");
  } catch (error) {
    await refreshStatus();
    showError(error.message, "credentials");
  }
});

tokenLink.addEventListener("click", () => {
  showTokenPanel(true);
});

tokenClose.addEventListener("click", () => {
  showTokenPanel(false);
});

otpBack.addEventListener("click", () => {
  showScreen("credentials");
});

errorRetry.addEventListener("click", () => {
  showScreen(state.lastScreenBeforeError || "credentials");
});

errorReset.addEventListener("click", () => {
  otpCodeInput.value = "";
  showTokenPanel(false);
  showScreen("credentials");
});

successLogout.addEventListener("click", async () => {
  try {
    await request("/auth/logout", { method: "POST" });
  } catch {
    // Ignore logout failures and refresh status below.
  }

  await refreshStatus();
  showScreen("credentials");
});

successDone.addEventListener("click", () => {
  window.location.reload();
});

refreshStatus();
