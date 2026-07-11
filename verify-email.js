// ── Configuration ──────────────────────────────────────────────────────────

const API_BASE_URL = 'http://localhost:3001/api';
const OTP_EXPIRATION_SECONDS = 15 * 60; // 15 minutes

// ── State Management ───────────────────────────────────────────────────────
let state = {
  verificationToken: null,
  email: null,
  expirationTime: null,
  timerInterval: null,
  isSubmitting: false,
  isResending: false,
  lastResendTime: null,
  resendAttemptsRemaining: 3,
};

// ── Initialization ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Get data from URL parameters or session storage
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get('token');
  const urlEmail = params.get('email');

  const sessionToken = sessionStorage.getItem('verificationToken');
  const sessionEmail = sessionStorage.getItem('verificationEmail');

  state.verificationToken = urlToken || sessionToken;
  state.email = urlEmail || sessionEmail;

  if (!state.verificationToken || !state.email) {
    showError('Invalid or missing verification session. Please register again.');
    disableForm();
    return;
  }

  // Store in session for persistence
  sessionStorage.setItem('verificationToken', state.verificationToken);
  sessionStorage.setItem('verificationEmail', state.email);

  // Display email
  document.getElementById('emailDisplay').textContent = state.email;

  // Show actionable hint if backend email may be disabled
  // (When GMAIL_APP_PASSWORD is not set, server logs the OTP as [email:dev] ...)
  const resendHelp = document.getElementById('resendHelp');
  if (resendHelp) resendHelp.style.display = 'block';


  // Set expiration time
  state.expirationTime = Date.now() + (OTP_EXPIRATION_SECONDS * 1000);

  // Start countdown timer
  startCountdownTimer();

  // Setup form handlers
  setupFormHandlers();

  // Auto-focus OTP input
  setTimeout(() => {
    document.getElementById('otp').focus();
  }, 300);
});

// ── Form Handlers ──────────────────────────────────────────────────────────
function setupFormHandlers() {
  const otpInput = document.getElementById('otp');
  const form = document.getElementById('verificationForm');

  // Allow only numbers in OTP field
  otpInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/[^0-9]/g, '');
    if (value.length > 6) {
      value = value.slice(0, 6);
    }
    e.target.value = value;

    // Auto-submit if 6 digits entered
    if (value.length === 6) {
      setTimeout(() => form.dispatchEvent(new Event('submit')), 100);
    }
  });

  // Prevent non-numeric input
  otpInput.addEventListener('keypress', (e) => {
    if (!/[0-9]/.test(e.key)) {
      e.preventDefault();
    }
  });

  // Form submission
  form.addEventListener('submit', handleVerifySubmit);
}

// ── Verify OTP Submission ──────────────────────────────────────────────────
async function handleVerifySubmit(e) {
  e.preventDefault();

  const otp = document.getElementById('otp').value.trim();

  // Validate OTP
  if (!otp || !/^\d{6}$/.test(otp)) {
    showOtpError('Please enter a valid 6-digit code');
    return;
  }

  if (state.isSubmitting) {
    return;
  }

  state.isSubmitting = true;
  setVerifyButtonLoading(true);
  clearMessages();

  // If email sending is disabled on the server, OTP is logged as [email:dev] in the backend console.

  try {

    const response = await fetch(`${API_BASE_URL}/auth/verify-registration`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        verificationToken: state.verificationToken,
        otp: otp,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Handle specific error cases
      if (response.status === 429) {
        showError(data.error || 'Too many attempts. Please try again later.');
        disableForm();
      } else if (response.status === 401) {
        showOtpError(data.error || 'Invalid verification code');
        document.getElementById('otp').value = '';
        document.getElementById('otp').focus();
      } else {
        showError(data.error || 'Verification failed. Please try again.');
      }
      return;
    }

    // Success
    showSuccess('✓ Email verified successfully!');
    clearMessages();

    // Show success for 2 seconds then redirect
    setTimeout(() => {
      // Clear session storage
      sessionStorage.removeItem('verificationToken');
      sessionStorage.removeItem('verificationEmail');

      // Redirect to dashboard or home page
      window.location.href = '/main.html';
    }, 2000);
  } catch (err) {
    console.error('[verify-otp]', err);
    showError('Network error. Please check your connection and try again.');
  } finally {
    state.isSubmitting = false;
    setVerifyButtonLoading(false);
  }
}

// ── Resend OTP ─────────────────────────────────────────────────────────────
async function resendCode() {
  if (state.isResending) {
    return;
  }

  state.isResending = true;
  const resendBtn = document.getElementById('resendBtn');
  resendBtn.disabled = true;
  clearMessages();

  try {
    const response = await fetch(`${API_BASE_URL}/auth/resend-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        verificationToken: state.verificationToken,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      showError(data.error || 'Failed to resend code. Please try again.');
      resendBtn.disabled = false;
      return;
    }

    // Success
    showSuccess(data.message || '✓ New verification code sent!');

    // Update verification token if provided
    if (data.verificationToken) {
      state.verificationToken = data.verificationToken;
      sessionStorage.setItem('verificationToken', state.verificationToken);
    }

    // Update resend attempts
    if (data.resendAttemptsRemaining !== undefined) {
      state.resendAttemptsRemaining = data.resendAttemptsRemaining;
      updateResendAttemptsDisplay();
    }

    // Reset timer
    state.expirationTime = Date.now() + (OTP_EXPIRATION_SECONDS * 1000);

    // Clear OTP input
    document.getElementById('otp').value = '';
    document.getElementById('otp').focus();

    // Disable resend button for 60 seconds
    let countdown = 60;
    resendBtn.textContent = `Resend in ${countdown}s`;
    const countdownInterval = setInterval(() => {
      countdown--;
      if (countdown <= 0) {
        clearInterval(countdownInterval);
        resendBtn.disabled = false;
        resendBtn.textContent = 'Resend Code';
        state.isResending = false;
      } else {
        resendBtn.textContent = `Resend in ${countdown}s`;
      }
    }, 1000);
  } catch (err) {
    console.error('[resend-otp]', err);
    showError('Network error. Please check your connection and try again.');
    resendBtn.disabled = false;
  }
}

// ── Countdown Timer ────────────────────────────────────────────────────────
function startCountdownTimer() {
  function updateTimer() {
    const now = Date.now();
    const remaining = Math.max(0, state.expirationTime - now);
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    const timerDisplay = document.getElementById('timerDisplay');
    timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    // Change color based on time remaining
    if (remaining <= 0) {
      timerDisplay.classList.add('expired');
      timerDisplay.textContent = 'EXPIRED';
      disableForm();
      if (state.timerInterval) {
        clearInterval(state.timerInterval);
      }
    } else if (remaining <= 60000) { // 1 minute or less
      timerDisplay.classList.add('expiring');
    }
  }

  updateTimer(); // Initial call
  state.timerInterval = setInterval(updateTimer, 1000);
}

// ── Change Email ───────────────────────────────────────────────────────────
function changeEmail() {
  const modal = document.getElementById('changeEmailModal');
  modal.style.display = 'flex';
}

function closeChangeEmailModal() {
  const modal = document.getElementById('changeEmailModal');
  modal.style.display = 'none';
}

function confirmStartNewRegistration() {
  // Clear session storage
  sessionStorage.removeItem('verificationToken');
  sessionStorage.removeItem('verificationEmail');

  // Redirect to main page to start registration
  window.location.href = '/main.html';
}

function startNewRegistration() {
  changeEmail();
}

// ── UI Helpers ─────────────────────────────────────────────────────────────
function showError(message) {
  const errorEl = document.getElementById('errorMessage');
  errorEl.textContent = message;
  errorEl.classList.add('show');
}

function showSuccess(message) {
  const successEl = document.getElementById('successMessage');
  successEl.textContent = message;
  successEl.classList.add('show');
}

function showInfo(message) {
  const infoEl = document.getElementById('infoMessage');
  infoEl.textContent = message;
  infoEl.classList.add('show');
}

function clearMessages() {
  document.getElementById('errorMessage').classList.remove('show');
  document.getElementById('successMessage').classList.remove('show');
  document.getElementById('infoMessage').classList.remove('show');
}

function showOtpError(message) {
  const otpInput = document.getElementById('otp');
  const errorEl = document.getElementById('otpError');

  otpInput.classList.add('error');
  errorEl.textContent = message;
  errorEl.classList.add('show');

  setTimeout(() => {
    otpInput.classList.remove('error');
    errorEl.classList.remove('show');
  }, 5000);
}

function setVerifyButtonLoading(isLoading) {
  const btn = document.getElementById('verifyBtn');
  const btnText = btn.querySelector('.btn-text');
  const btnLoader = btn.querySelector('.btn-loader');

  if (isLoading) {
    btn.disabled = true;
    btnText.style.display = 'none';
    btnLoader.style.display = 'flex';
  } else {
    btn.disabled = false;
    btnText.style.display = 'flex';
    btnLoader.style.display = 'none';
  }
}

function updateResendAttemptsDisplay() {
  const attemptsEl = document.getElementById('resendAttempts');
  if (state.resendAttemptsRemaining > 0) {
    attemptsEl.textContent = `${state.resendAttemptsRemaining} attempt${state.resendAttemptsRemaining !== 1 ? 's' : ''} remaining`;
    attemptsEl.style.color = state.resendAttemptsRemaining === 1 ? '#ffa502' : '#9a9ab0';
  } else {
    attemptsEl.textContent = 'No resend attempts remaining';
    attemptsEl.style.color = '#ff4757';
  }
}

function disableForm() {
  document.getElementById('otp').disabled = true;
  document.getElementById('verifyBtn').disabled = true;
  document.getElementById('resendBtn').disabled = true;
}

// Close modal when clicking outside
window.addEventListener('click', (e) => {
  const modal = document.getElementById('changeEmailModal');
  if (e.target === modal) {
    closeChangeEmailModal();
  }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
  }
});
