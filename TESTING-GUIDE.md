# Secure Email OTP Verification System - Testing Guide

## Table of Contents

1. [Setup for Testing](#setup-for-testing)
2. [Manual Testing](#manual-testing)
3. [API Testing with cURL](#api-testing-with-curl)
4. [Frontend Testing](#frontend-testing)
5. [Security Testing](#security-testing)
6. [Performance Testing](#performance-testing)

---

## Setup for Testing

### Prerequisites

- Node.js 14+ installed
- SQLite3 installed
- Git configured
- Internet connection (for email sending)

### Initial Setup

1. **Install Dependencies**

```bash
cd server
npm install
```

2. **Configure Environment**

```bash
# Copy the example file
cp .env.example .env

# Edit .env and add your configuration
# For Gmail:
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-char-app-password
```

3. **Start the Server**

```bash
npm run dev
# Server runs on http://localhost:3001
```

4. **Verify Server is Running**

```bash
curl http://localhost:3001/api/config/public
# Should return: {"ok": true, "stripePublishableKey": "...", ...}
```

---

## Manual Testing

### Scenario 1: Successful Registration and Verification

#### Steps:

1. **Open Registration Page**
   - Navigate to `http://localhost:3000/main.html` (or your registration page)

2. **Fill Registration Form**
   - Name: `Test User`
   - Email: `testuser@example.com`
   - Password: `TestPassword123!`

3. **Submit Registration**
   - Click "Register" button
   - Should be redirected to verification page

4. **Check Email**
   - For Gmail: Check inbox for verification code
   - For dev mode (no email config): OTP appears in browser console

5. **Enter OTP**
   - Copy OTP from email or console
   - Paste into verification page
   - Or if 6 digits entered, auto-submits

6. **Verify Success**
   - Page should show "Email verified successfully"
   - User redirected to dashboard
   - Can now log in with registered credentials

### Scenario 2: Invalid OTP Submission

#### Steps:

1. **Complete registration** (as in Scenario 1)

2. **Enter Wrong OTP**
   - Try: `000000`
   - Should show error: "Invalid verification code"
   - Attempts remaining should decrement

3. **Try Multiple Wrong OTPs**
   - Enter wrong OTP 5 times
   - On 5th attempt: "Too many failed attempts. Account locked for 30 minutes."
   - Cannot verify for 30 minutes

4. **Verify Lockout Works**
   - Cannot click verify button
   - Input field disabled
   - Must wait 30 minutes

### Scenario 3: Resend OTP

#### Steps:

1. **Complete registration** (as in Scenario 1)

2. **Wait for OTP Expiration** (or skip this step for testing)

3. **Click "Resend Code"**
   - Should show success: "Verification code sent successfully"
   - New OTP sent to email
   - Timer resets to 15:00
   - Resend button disabled for 60 seconds
   - Attempts remaining should decrease

4. **Try Maximum Resends**
   - Resend code 3 times
   - On 4th attempt: "Too many resend requests. Please wait 15 minutes..."

### Scenario 4: Re-registration with Unverified Email

#### Steps:

1. **Register with email** (don't verify)

2. **Try to Register Again with Same Email**
   - Should succeed with new OTP
   - Previous OTP invalidated
   - New verification token issued

3. **Verify with New OTP**
   - Should successfully verify account
   - Can now log in

### Scenario 5: Login Protection

#### Steps:

1. **Try to Login with Unverified Account**
   - After registration, try to login
   - Should fail: "Email verification required"

2. **Verify Email** (as in Scenario 1)

3. **Login**
   - Now should succeed with access token
   - User profile retrieved
   - Redirected to dashboard

---

## API Testing with cURL

### Test 1: Register User

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "testuser@example.com",
    "password": "TestPassword123!"
  }' \
  | jq .
```

**Expected Response:**

```json
{
  "ok": true,
  "message": "Registration successful!...",
  "verificationRequired": true,
  "verificationToken": "eyJ...",
  "otpCode": "123456"
}
```

**Save the `verificationToken` and `otpCode` for next tests**

### Test 2: Verify OTP (Success)

```bash
curl -X POST http://localhost:3001/api/auth/verify-registration \
  -H "Content-Type: application/json" \
  -d '{
    "verificationToken": "eyJ...",
    "otp": "123456"
  }' \
  | jq .
```

**Expected Response:**

```json
{
  "ok": true,
  "message": "Email verified successfully",
  "user": {
    "id": 1,
    "name": "Test User",
    "email": "testuser@example.com",
    "role": "user"
  },
  "accessToken": "eyJ..."
}
```

### Test 3: Verify OTP (Invalid)

```bash
curl -X POST http://localhost:3001/api/auth/verify-registration \
  -H "Content-Type: application/json" \
  -d '{
    "verificationToken": "eyJ...",
    "otp": "000000"
  }' \
  | jq .
```

**Expected Response (401):**

```json
{
  "ok": false,
  "error": "Invalid verification code",
  "attemptsRemaining": 4
}
```

### Test 4: Resend OTP

```bash
curl -X POST http://localhost:3001/api/auth/resend-otp \
  -H "Content-Type: application/json" \
  -d '{
    "verificationToken": "eyJ..."
  }' \
  | jq .
```

**Expected Response:**

```json
{
  "ok": true,
  "message": "Verification code sent successfully",
  "verificationToken": "eyJ...",
  "resendAttemptsRemaining": 2,
  "otpCode": "654321"
}
```

### Test 5: Login (Unverified)

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "unverified@example.com",
    "password": "TestPassword123!"
  }' \
  | jq .
```

**Expected Response (403):**

```json
{
  "ok": false,
  "error": "Email verification required"
}
```

### Test 6: Login (Verified)

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "TestPassword123!"
  }' \
  | jq .
```

**Expected Response:**

```json
{
  "ok": true,
  "user": {
    "id": 1,
    "name": "Test User",
    "email": "testuser@example.com",
    "role": "user"
  },
  "accessToken": "eyJ..."
}
```

### Test 7: Get Current User

```bash
curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer eyJ..." \
  | jq .
```

**Expected Response:**

```json
{
  "ok": true,
  "user": {
    "id": 1,
    "name": "Test User",
    "email": "testuser@example.com",
    "role": "user"
  }
}
```

---

## Frontend Testing

### Test Page: `verify-email.html`

#### Test Case 1: OTP Input Validation

1. **Numeric Only Input**
   - Type letters in OTP field
   - Should only accept digits 0-9

2. **Auto-Submit on 6 Digits**
   - Type exactly 6 digits
   - Form should auto-submit after a short delay

3. **Max Length**
   - Try to type more than 6 digits
   - Should stop at 6 digits

#### Test Case 2: Timer Functionality

1. **Timer Starts**
   - Timer should display "15:00" on page load
   - Should countdown every second

2. **Color Changes**
   - From 15:00 to 1:01 - Blue (#00d4ff)
   - From 1:00 to 0:01 - Orange (expiring)
   - At 0:00 - Red (expired)

3. **Form Disabled on Expiration**
   - At 0:00, OTP input disabled
   - Verify button disabled
   - Show message to request new code

#### Test Case 3: Resend Button

1. **Initial State**
   - Resend button enabled
   - Shows "Resend Code"

2. **After Click**
   - Button disabled for 60 seconds
   - Shows countdown "Resend in 59s", etc.
   - After 60s, button re-enables

3. **Rate Limiting**
   - After 3 resends in 15 minutes
   - Should show error message
   - Resend button disabled

#### Test Case 4: Error Messages

1. **Invalid OTP**
   - Enter wrong OTP
   - Should show error in red
   - OTP input highlighted
   - Attempts remaining displayed

2. **Network Error**
   - Disconnect internet
   - Try to verify
   - Should show network error message

3. **Session Expired**
   - Don't interact for 30+ minutes
   - Try to verify
   - Should show session expired error

#### Test Case 5: Success Behavior

1. **Successful Verification**
   - Enter correct OTP
   - Should show success message
   - Redirect to dashboard after 2 seconds

2. **Button Loading State**
   - During verification
   - Button should show spinner
   - Text should say "Verifying..."

---

## Security Testing

### Test 1: Rate Limiting

#### Verification Rate Limit (10 per 15 minutes)

```bash
# Run this script 10+ times in quick succession
for i in {1..15}; do
  curl -X POST http://localhost:3001/api/auth/verify-registration \
    -H "Content-Type: application/json" \
    -d '{"verificationToken": "test", "otp": "000000"}' \
    | jq '.error'
done
```

**Expected:** 10 success/error responses, then 429 error: "Too many verification attempts"

#### Resend Rate Limit (3 per 15 minutes)

```bash
# Run resend endpoint 4+ times
for i in {1..5}; do
  curl -X POST http://localhost:3001/api/auth/resend-otp \
    -H "Content-Type: application/json" \
    -d '{"verificationToken": "eyJ..."}' | jq '.error'
done
```

**Expected:** 3 success, then 429 error: "Too many resend requests"

#### Login Rate Limit (5 per 15 minutes)

```bash
# Run login 6+ times with wrong password
for i in {1..7}; do
  curl -X POST http://localhost:3001/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email": "test@example.com", "password": "wrong"}' \
    | jq '.error'
done
```

**Expected:** 5 error responses, then 429 rate limit error

### Test 2: Account Locking

```bash
# Submit wrong OTP 5 times
for i in {1..5}; do
  curl -X POST http://localhost:3001/api/auth/verify-registration \
    -H "Content-Type: application/json" \
    -d '{"verificationToken": "eyJ...", "otp": "000000"}' \
    | jq '.'
done

# Attempt 5 shows: "Account locked for 30 minutes"
# Try immediately after (within 30 mins)
curl -X POST http://localhost:3001/api/auth/verify-registration \
  -H "Content-Type: application/json" \
  -d '{"verificationToken": "eyJ...", "otp": "123456"}' \
  | jq '.error'
```

**Expected:** "Too many failed attempts. Account locked for 30 minutes."

### Test 3: OTP Hashing

1. **Database Check**
   - Query database: `SELECT * FROM email_verification_otps;`
   - Code should NOT be stored in plain text
   - Should be hashed (SHA256 format)

2. **OTP Not in Response**
   - After verification, response should NOT contain OTP
   - Only in dev mode without email configured

### Test 4: Email Validation

```bash
# Invalid email format
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Test", "email": "notanemail", "password": "password123"}' \
  | jq '.error'
```

**Expected:** "Invalid email format"

### Test 5: Password Strength

```bash
# Too short password
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Test", "email": "test@example.com", "password": "short"}' \
  | jq '.error'
```

**Expected:** "Password must be at least 8 characters"

### Test 6: SQL Injection Prevention

```bash
# Try SQL injection
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Test", "email": "test@example.com'; DROP TABLE users; --", "password": "password123"}' \
  | jq '.error'
```

**Expected:** "Invalid email format" (injection attempt blocked)

---

## Performance Testing

### Test 1: Response Time

```bash
# Measure login endpoint response time
time curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'
```

**Expected:** < 500ms response time

### Test 2: Concurrent Requests

```bash
# Send 10 concurrent registration requests
for i in {1..10}; do
  curl -X POST http://localhost:3001/api/auth/register \
    -H "Content-Type: application/json" \
    -d "{\"name\": \"User$i\", \"email\": \"user$i@example.com\", \"password\": \"password123\"}" &
done
wait
```

**Expected:** All requests succeed, no database locks

---

## Database Testing

### Check User Creation

```sql
-- Check users table
SELECT id, name, email, email_verified, verification_failed_attempts FROM users;

-- Check OTP table
SELECT id, user_id, email, code_hash, expires_at, used_at FROM email_verification_otps;

-- Check resend tracking
SELECT user_id, COUNT(*) as resend_count FROM resend_otp_tracking 
WHERE attempted_at > datetime('now', '-15 minutes') 
GROUP BY user_id;
```

### Clean Test Data

```sql
-- Delete test users
DELETE FROM users WHERE email LIKE 'test%';
DELETE FROM email_verification_otps WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test%');
```

---

## Troubleshooting Tests

### Issue: OTP not being sent

1. **Check email configuration**
   ```bash
   echo $GMAIL_APP_PASSWORD  # Should show app password
   ```

2. **Check Gmail account**
   - Enable 2FA
   - Generate app password
   - Verify app password in .env

3. **Check server logs**
   ```bash
   # Look for email sending errors
   npm run dev 2>&1 | grep -i email
   ```

### Issue: Tests failing with 500 error

1. **Check database**
   ```bash
   # Verify database exists
   ls -la server/data/app.sqlite
   ```

2. **Check error logs**
   - Review console output for stack traces
   - Check database connection issues

3. **Restart server**
   ```bash
   npm run dev
   ```

### Issue: Tests failing with 429 rate limit

1. **Wait for rate limit window to pass** (15 minutes)

2. **Clear in-memory tracking**
   - Restart server to reset rate limit counters

3. **Test with different IPs** (for IP-based rate limits)
   - Use different devices/networks

---

## Test Results Template

Record test results:

```
Date: 2024-01-15
Tester: Name
Server: http://localhost:3001

Test Results:
- [ ] Registration works
- [ ] OTP verification succeeds
- [ ] Invalid OTP rejected
- [ ] Rate limiting enforced
- [ ] Account locking works
- [ ] Resend OTP works
- [ ] Login blocked for unverified
- [ ] Login works for verified
- [ ] Email sent correctly
- [ ] Timer counts down
- [ ] Form validation works

Issues Found:
- None

Notes:
- All tests passed
```

---

## CI/CD Testing

To run tests in CI/CD pipeline:

```bash
#!/bin/bash
cd server
npm install

# Start server in background
npm run dev &
SERVER_PID=$!

# Wait for server to start
sleep 2

# Run tests
npm test

# Capture exit code
TEST_EXIT_CODE=$?

# Kill server
kill $SERVER_PID

# Exit with test result
exit $TEST_EXIT_CODE
```

---

## Next Steps

After successful testing:

1. **Deploy to staging environment**
2. **Run load testing** with more users
3. **Security audit** with penetration testing tools
4. **Monitor email delivery** rates
5. **Collect user feedback** on verification flow
