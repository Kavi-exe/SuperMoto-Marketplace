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
  const name = userName ? String(userName).trim().split(' ')[0] : 'there';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your CeylonSuperHub account</title>
  <style>
    body { margin: 0; padding: 0; background: #0a0a0f; font-family: 'Segoe UI', Arial, sans-serif; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #13131a; border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.07); }
    .header { background: linear-gradient(135deg, #0a0a0f 0%, #13131a 100%); padding: 36px 40px 28px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.06); }
    .logo { font-size: 22px; font-weight: 800; letter-spacing: 0.5px; color: #ffffff; }
    .logo span { color: #00d4ff; }
    .body { padding: 36px 40px; }
    .greeting { font-size: 20px; font-weight: 700; color: #f0f0f5; margin: 0 0 12px; }
    .text { font-size: 15px; color: #9a9ab0; line-height: 1.7; margin: 0 0 28px; }
    .otp-box { background: #0a0a0f; border: 1px solid rgba(0, 212, 255, 0.25); border-radius: 12px; padding: 24px; text-align: center; margin: 0 0 28px; }
    .otp-label { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #9a9ab0; margin: 0 0 12px; }
    .otp-code { font-size: 42px; font-weight: 800; letter-spacing: 10px; color: #00d4ff; margin: 0; font-variant-numeric: tabular-nums; }
    .otp-expiry { font-size: 12px; color: #9a9ab0; margin: 12px 0 0; }
    .divider { border: none; border-top: 1px solid rgba(255,255,255,0.06); margin: 0 0 24px; }
    .warning { font-size: 13px; color: #9a9ab0; line-height: 1.6; margin: 0 0 8px; }
    .warning strong { color: #f0f0f5; }
    .footer { background: #0d0d14; padding: 20px 40px; text-align: center; border-top: 1px solid rgba(255,255,255,0.05); }
    .footer-text { font-size: 12px; color: #5a5a70; margin: 0; }
    .footer-text a { color: #00d4ff; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo">Ceylon<span>Super</span>Hub</div>
    </div>
    <div class="body">
      <p class="greeting">Hey ${name}, welcome! 👋</p>
      <p class="text">
        You're one step away from joining <strong style="color:#f0f0f5">CeylonSuperHub</strong> — Sri Lanka's premier marketplace for elite vehicles and performance machines.<br><br>
        Use the verification code below to confirm your email address and activate your account.
      </p>

      <div class="otp-box">
        <p class="otp-label">Your verification code</p>
        <p class="otp-code">${otpCode}</p>
        <p class="otp-expiry">This code expires in <strong>15 minutes</strong></p>
      </div>

      <hr class="divider">

      <p class="warning">🔒 <strong>Never share this code</strong> with anyone. CeylonSuperHub will never ask for it by phone or chat.</p>
      <p class="warning">If you didn't create an account, you can safely ignore this email.</p>
    </div>
    <div class="footer">
      <p class="footer-text">
        &copy; ${new Date().getFullYear()} CeylonSuperHub &nbsp;·&nbsp;
        <a href="mailto:theceylonsuperhub@gmail.com">theceylonsuperhub@gmail.com</a>
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
