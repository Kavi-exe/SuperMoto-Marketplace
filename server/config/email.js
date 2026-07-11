const nodemailer = require('nodemailer');

// ── Transporter ───────────────────────────────────────────────────────────────
// Uses Gmail with an App Password (not your normal Gmail password).
// Set GMAIL_APP_PASSWORD in your .env – see README for instructions.

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  const user = process.env.GMAIL_USER || 'theceylonsuperhub@gmail.com';
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!pass) {
    console.warn('[email] GMAIL_APP_PASSWORD is not set – email sending is disabled.');
    return null;
  }

  _transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  return _transporter;
}

function isEmailConfigured() {
  return Boolean(process.env.GMAIL_APP_PASSWORD);
}

// ── HTML template ─────────────────────────────────────────────────────────────
function buildVerificationEmailHtml(otpCode, userName) {
  const name = userName ? String(userName).trim().split(' ')[0] : 'User';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your CeylonSuperHub Account</title>
  <style>
    * { box-sizing: border-box; }
    body { 
      margin: 0; 
      padding: 0; 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; 
      background-color: #f6f8fa;
      color: #24292e;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border: 1px solid #e1e4e8;
      border-radius: 6px;
      overflow: hidden;
    }
    .header {
      background-color: #f6f8fa;
      padding: 16px 24px;
      text-align: center;
      border-bottom: 1px solid #e1e4e8;
    }
    .logo {
      font-size: 24px;
      font-weight: 600;
      color: #24292e;
      margin: 0;
      letter-spacing: -0.5px;
    }
    .logo-highlight {
      color: #0366d6;
    }
    .content {
      padding: 24px 24px;
      line-height: 1.6;
    }
    .greeting {
      font-size: 18px;
      font-weight: 600;
      color: #24292e;
      margin: 0 0 12px;
    }
    .description {
      font-size: 14px;
      color: #586069;
      margin: 0 0 20px;
    }
    .code-box {
      background-color: #f6f8fa;
      border: 1px solid #e1e4e8;
      border-radius: 6px;
      padding: 16px 24px;
      margin: 24px 0;
      text-align: center;
    }
    .code-label {
      font-size: 12px;
      color: #586069;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0 0 8px;
      display: block;
    }
    .code-value {
      font-size: 36px;
      font-weight: 600;
      color: #0366d6;
      margin: 0;
      letter-spacing: 4px;
      font-family: 'Courier New', monospace;
      word-spacing: 8px;
    }
    .code-expiry {
      font-size: 12px;
      color: #586069;
      margin: 8px 0 0;
    }
    .code-expiry strong {
      color: #24292e;
    }
    .divider {
      border: none;
      border-top: 1px solid #e1e4e8;
      margin: 20px 0;
    }
    .warning {
      background-color: #fafbfc;
      border-left: 4px solid #f6be45;
      padding: 12px 16px;
      margin: 16px 0;
      font-size: 14px;
      color: #24292e;
    }
    .warning strong {
      color: #24292e;
      font-weight: 600;
    }
    .security-info {
      background-color: #fafbfc;
      border: 1px solid #e1e4e8;
      border-radius: 6px;
      padding: 16px;
      margin: 16px 0;
      font-size: 13px;
      color: #586069;
    }
    .footer {
      background-color: #fafbfc;
      border-top: 1px solid #e1e4e8;
      padding: 16px 24px;
      text-align: center;
      font-size: 12px;
      color: #586069;
    }
    .footer a {
      color: #0366d6;
      text-decoration: none;
    }
    .footer-text {
      margin: 0;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <p class="logo">Ceylon<span class="logo-highlight">Super</span>Hub</p>
    </div>
    
    <div class="content">
      <p class="greeting">Verify your email, ${name}</p>
      
      <p class="description">
        Thank you for registering with CeylonSuperHub. To complete your registration and verify your email address, please use the verification code below.
      </p>

      <div class="code-box">
        <span class="code-label">Your verification code</span>
        <p class="code-value">${otpCode}</p>
        <p class="code-expiry">This code is valid for <strong>15 minutes</strong> and can only be used once.</p>
      </div>

      <div class="warning">
        <strong>🔒 Never share this code</strong> with anyone. CeylonSuperHub will never ask for it on the phone or via email.
      </div>

      <div class="security-info">
        <p style="margin: 0; font-weight: 600;">How to verify:</p>
        <ol style="margin: 8px 0 0; padding-left: 20px; color: #586069;">
          <li>Go to the CeylonSuperHub verification page</li>
          <li>Enter your email address</li>
          <li>Enter the 6-digit code above</li>
          <li>Click "Verify & Continue"</li>
        </ol>
      </div>

      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e1e4e8; font-size: 13px; color: #586069;">
        <p style="margin: 0 0 8px;">If you did not create this account, you can safely ignore this email.</p>
        <p style="margin: 0;">If you're having trouble, please contact us at <a href="mailto:theceylonsuperhub@gmail.com" style="color: #0366d6;">theceylonsuperhub@gmail.com</a></p>
      </div>
    </div>

    <div class="footer">
      <p class="footer-text">
        © ${new Date().getFullYear()} CeylonSuperHub. All rights reserved.<br>
        <a href="https://theceylonsuperhub.com">Visit our website</a> · 
        <a href="mailto:theceylonsuperhub@gmail.com">Contact support</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

// ── Send verification email ───────────────────────────────────────────────────
async function sendVerificationEmail({ to, otpCode, userName }) {
  const transporter = getTransporter();

  if (!transporter) {
    // Dev fallback: log to console so development still works without email config
    console.log(`[email:dev] OTP for ${to}: ${otpCode}`);
    return { sent: false, devMode: true };
  }

  const fromAddress = process.env.GMAIL_USER || 'theceylonsuperhub@gmail.com';

  await transporter.sendMail({
    from: `"CeylonSuperHub" <${fromAddress}>`,
    to,
    subject: `${otpCode} is your CeylonSuperHub verification code`,
    text: `Hey ${userName || 'there'},\n\nYour CeylonSuperHub verification code is: ${otpCode}\n\nThis code expires in 15 minutes.\n\nIf you didn't create an account, ignore this email.\n\n— The CeylonSuperHub Team`,
    html: buildVerificationEmailHtml(otpCode, userName),
  });

  return { sent: true, devMode: false };
}

module.exports = { sendVerificationEmail, isEmailConfigured };
