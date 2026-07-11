# Secure Email OTP Verification System - API Documentation

## Overview

This document provides complete documentation for the secure email OTP verification system API endpoints.

## Base URL

```
http://localhost:3001/api
```

## Authentication

Most endpoints require Bearer token authentication:

```
Authorization: Bearer <access_token>
```

## Error Responses

All error responses follow this format:

```json
{
  "ok": false,
  "error": "Error message describing what went wrong"
}
```

### Common HTTP Status Codes

- `200 OK` - Request successful
- `400 Bad Request` - Invalid input or validation error
- `401 Unauthorized` - Invalid or missing credentials/token
- `403 Forbidden` - Access denied (e.g., unverified email)
- `404 Not Found` - Resource not found
- `409 Conflict` - Conflict (e.g., email already in use)
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

---

## Endpoints

### 1. Register User

**Endpoint:** `POST /auth/register`

**Description:** Create a new user account and send verification OTP to email.

**Request Body:**

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePassword123"
}
```

**Validation Rules:**

- `name`: Required, non-empty string
- `email`: Required, valid email format
- `password`: Required, minimum 8 characters

**Success Response (200):**

```json
{
  "ok": true,
  "message": "Registration successful! Check your email for the verification code.",
  "verificationRequired": true,
  "verificationToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "otpCode": "123456"
}
```

**Note:** In development mode (without email configured), the `otpCode` is returned in the response. In production with email configured, the OTP is only sent via email.

**Error Responses:**

```json
{
  "ok": false,
  "error": "Email already in use"
}
```

- `400` - Invalid email format, password too short, or missing required fields
- `409` - Email already verified and in use

---

### 2. Verify OTP

**Endpoint:** `POST /auth/verify-registration`

**Description:** Verify the OTP sent to user's email and activate their account.

**Request Body:**

```json
{
  "verificationToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "otp": "123456"
}
```

**Rate Limiting:**

- Maximum 10 verification attempts per 15 minutes per IP
- Account locked for 30 minutes after 5 failed attempts

**Success Response (200):**

```json
{
  "ok": true,
  "message": "Email verified successfully",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**

```json
{
  "ok": false,
  "error": "Invalid verification code",
  "attemptsRemaining": 3
}
```

- `400` - Invalid OTP format, expired OTP, or invalid token
- `401` - Invalid OTP code
- `429` - Too many attempts, account locked

---

### 3. Resend OTP

**Endpoint:** `POST /auth/resend-otp`

**Description:** Request a new OTP code to be sent to the user's email.

**Request Body:**

```json
{
  "verificationToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Rate Limiting:**

- Maximum 3 resend attempts per 15 minutes per user

**Success Response (200):**

```json
{
  "ok": true,
  "message": "Verification code sent successfully",
  "verificationToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "resendAttemptsRemaining": 2,
  "otpCode": "654321"
}
```

**Note:** `otpCode` is only included in development mode.

**Error Responses:**

```json
{
  "ok": false,
  "error": "Too many resend requests. Please wait 15 minutes before trying again."
}
```

- `400` - Email already verified, missing token
- `401` - Invalid or expired token
- `404` - User not found
- `429` - Too many resend attempts

---

### 4. Login

**Endpoint:** `POST /auth/login`

**Description:** Authenticate user and obtain access token.

**Request Body:**

```json
{
  "email": "john@example.com",
  "password": "SecurePassword123"
}
```

**Rate Limiting:**

- Maximum 5 login attempts per 15 minutes per IP

**Success Response (200):**

```json
{
  "ok": true,
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**

```json
{
  "ok": false,
  "error": "Email verification required"
}
```

- `401` - Invalid credentials
- `403` - Email not verified

---

### 5. Get Current User

**Endpoint:** `GET /auth/me`

**Description:** Get authenticated user's profile information.

**Authentication:** Required (Bearer token)

**Success Response (200):**

```json
{
  "ok": true,
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

**Error Responses:**

- `401` - Missing or invalid token
- `404` - User not found

---

### 6. Refresh Token

**Endpoint:** `POST /auth/refresh`

**Description:** Refresh access token using refresh token from cookie.

**Success Response (200):**

```json
{
  "ok": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**

- `401` - Missing or invalid refresh token

---

## OTP Specifications

### OTP Format

- **Length:** 6 digits
- **Format:** Numeric only (0-9)
- **Generation:** Cryptographically secure random generation
- **Expiration:** 15 minutes

### OTP Hashing

- **Algorithm:** SHA256 for storage
- **Plain Text OTP:** Never stored in database
- **Comparison:** Constant-time comparison to prevent timing attacks

---

## Security Features

### 1. Rate Limiting

- **Registration:** No limit (per endpoint)
- **Verification:** 10 attempts per 15 minutes per IP
- **Resend:** 3 attempts per 15 minutes per user
- **Login:** 5 attempts per 15 minutes per IP

### 2. Account Locking

- **Failed Verification Attempts:** 5 failed attempts lock account for 30 minutes
- **Automatic Unlock:** Account automatically unlocks after lock period expires

### 3. Input Validation

- Email format validation
- OTP format validation (must be 6 digits)
- Password strength requirements (minimum 8 characters)
- Input sanitization to prevent injection attacks

### 4. CORS Protection

- Configured for development and production
- Credentials allowed: `true`
- Secure cookie handling with httpOnly flag

### 5. HTTPS Ready

- Secure cookie flag set based on NODE_ENV
- SAMESIITE strict cookie policy
- Secure headers configured

---

## Integration Guide

### Frontend Registration Flow

1. User fills registration form (name, email, password)
2. POST to `/auth/register`
3. If successful, receive `verificationToken`
4. Redirect to verification page with token in URL or session
5. User enters OTP
6. POST to `/auth/verify-registration` with token and OTP
7. If successful, receive `accessToken` and user data
8. User logged in and redirected to dashboard

### Frontend Login Flow

1. User enters email and password
2. POST to `/auth/login`
3. If unverified email error (403), prompt to verify email first
4. If successful, receive `accessToken`
5. Store token in localStorage/sessionStorage
6. Set Authorization header for subsequent requests

### Using Access Token

Include in all authenticated requests:

```
Authorization: Bearer <access_token>
```

Example with fetch:

```javascript
const response = await fetch('/api/auth/me', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

---

## Environment Variables

```env
# JWT Secrets
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
JWT_EMAIL_VERIFICATION_SECRET=your-email-verification-secret

# Email Configuration (Gmail)
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-app-password

# Alternative SMTP
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=your-email@example.com
EMAIL_PASSWORD=your-password

# App Settings
PORT=3001
NODE_ENV=development
ALLOWED_EMAIL_DOMAINS=  # Comma-separated, empty for all
OTP_EXPIRATION_MINUTES=15
```

---

## Testing with cURL

### 1. Register User

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "SecurePassword123"
  }'
```

### 2. Verify OTP

```bash
curl -X POST http://localhost:3001/api/auth/verify-registration \
  -H "Content-Type: application/json" \
  -d '{
    "verificationToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "otp": "123456"
  }'
```

### 3. Resend OTP

```bash
curl -X POST http://localhost:3001/api/auth/resend-otp \
  -H "Content-Type: application/json" \
  -d '{
    "verificationToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

### 4. Login

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePassword123"
  }'
```

### 5. Get Current User

```bash
curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## Response Headers

All responses include standard HTTP headers:

- `Content-Type: application/json`
- `Cache-Control: no-store` (for sensitive endpoints)
- `X-Content-Type-Options: nosniff`

---

## Troubleshooting

### Email Not Sending

1. Check `GMAIL_APP_PASSWORD` is set correctly
2. Verify Gmail account has 2FA enabled
3. Check firewall allows outbound SMTP connections
4. Review console logs for detailed error messages

### OTP Verification Failing

1. Verify OTP format is exactly 6 digits
2. Check OTP hasn't expired (15-minute window)
3. Ensure verification token is still valid (30-minute window)
4. Check failed attempts haven't triggered account lock

### Rate Limiting Issues

1. Wait 15 minutes for rate limit to reset
2. Check if using same email/IP for multiple requests
3. Verify rate limiter is based on correct identifier (IP or User ID)

---

## Changelog

### Version 1.0.0 (2024)

- Initial release
- Secure OTP generation and verification
- Email sending with SMTP
- Rate limiting and brute-force protection
- Account locking after failed attempts
- Resend OTP with limits
- Email verification required for login
- Comprehensive error handling
