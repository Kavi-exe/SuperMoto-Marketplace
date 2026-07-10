# Email verification / OTP verification wiring

Current implementation blocks/accepts accounts based on `ALLOWED_EMAIL_DOMAINS` env var (comma-separated). OTP delivery is not wired to email provider.

Frontend expects:
- POST /api/auth/register => { ok, verificationRequired:true, verificationToken, otpCode (dev only) }
- POST /api/auth/verify-registration => { ok:true, accessToken, user }

To switch from returning `otpCode` to real email delivery:
- remove `otpCode` from /api/auth/register response
- send code using an email provider

