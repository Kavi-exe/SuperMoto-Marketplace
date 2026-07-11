# Email OTP Verification System - Frontend Integration Guide

## Overview

This guide explains how to integrate the secure email OTP verification system into your existing registration and login flows.

## Files Created

- `verify-email.html` - Verification page
- `verify-email.css` - Verification page styles
- `verify-email.js` - Verification page logic

## Integration Steps

### Step 1: Update Registration Form Handler

Your registration form should:
1. POST to `/api/auth/register`
2. Store the `verificationToken` and `email` in sessionStorage
3. Redirect to `verify-email.html`

Example JavaScript code for your registration page:

```javascript
async function handleRegistration(e) {
  e.preventDefault();

  const name = document.getElementById('name').value;
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      showError(data.error || 'Registration failed');
      return;
    }

    // Store verification data in sessionStorage
    sessionStorage.setItem('verificationToken', data.verificationToken);
    sessionStorage.setItem('verificationEmail', data.email || email);

    // In dev mode, also store OTP for easy testing
    if (data.otpCode) {
      sessionStorage.setItem('devOtpCode', data.otpCode);
    }

    // Redirect to verification page
    window.location.href = '/verify-email.html';
  } catch (error) {
    console.error('Registration error:', error);
    showError('Network error. Please try again.');
  }
}

// Attach to form
document.getElementById('registrationForm').addEventListener('submit', handleRegistration);
```

### Step 2: Update Login Form Handler

Your login form should check for unverified email status:

```javascript
async function handleLogin(e) {
  e.preventDefault();

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Check if it's an unverified email error
      if (response.status === 403 && data.error.includes('verification')) {
        showWarning('Please verify your email before logging in.');
        // Optionally offer to resend verification code
        offerEmailVerification(email);
        return;
      }

      showError(data.error || 'Login failed');
      return;
    }

    // Success - store token and redirect
    localStorage.setItem('accessToken', data.accessToken);
    window.location.href = '/dashboard.html';
  } catch (error) {
    console.error('Login error:', error);
    showError('Network error. Please try again.');
  }
}

// Attach to form
document.getElementById('loginForm').addEventListener('submit', handleLogin);
```

### Step 3: Store and Use Access Token

After verification or login, store the access token for authenticated requests:

```javascript
// Store token after successful login/verification
localStorage.setItem('accessToken', data.accessToken);

// Use token in subsequent requests
async function fetchWithAuth(url, options = {}) {
  const token = localStorage.getItem('accessToken');

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  // Handle token expiration
  if (response.status === 401) {
    // Try to refresh token
    const refreshResponse = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });

    if (refreshResponse.ok) {
      const refreshData = await refreshResponse.json();
      localStorage.setItem('accessToken', refreshData.accessToken);
      
      // Retry original request
      return fetchWithAuth(url, options);
    } else {
      // Redirect to login
      window.location.href = '/login.html';
    }
  }

  return response;
}

// Usage example
const response = await fetchWithAuth('/api/auth/me');
const user = await response.json();
```

### Step 4: Verify User on Page Load

Check if user is logged in when page loads:

```javascript
async function checkAuthStatus() {
  const token = localStorage.getItem('accessToken');

  if (!token) {
    // Not logged in
    redirectToLogin();
    return;
  }

  try {
    const response = await fetchWithAuth('/api/auth/me');

    if (response.ok) {
      const data = await response.json();
      // User is authenticated
      console.log('Current user:', data.user);
      displayUserInfo(data.user);
      return data.user;
    } else {
      // Token invalid
      localStorage.removeItem('accessToken');
      redirectToLogin();
    }
  } catch (error) {
    console.error('Auth check failed:', error);
    redirectToLogin();
  }
}

// Call on page load
document.addEventListener('DOMContentLoaded', checkAuthStatus);
```

### Step 5: Logout Handler

```javascript
function logout() {
  // Clear stored token
  localStorage.removeItem('accessToken');
  sessionStorage.clear();

  // Redirect to login
  window.location.href = '/login.html';
}

// Attach to logout button
document.getElementById('logoutBtn').addEventListener('click', logout);
```

## Verification Page Redirect URL

After registration, redirect to the verification page with parameters:

**Option 1: URL Parameters**

```javascript
window.location.href = `/verify-email.html?token=${data.verificationToken}&email=${encodeURIComponent(email)}`;
```

**Option 2: Session Storage (Recommended)**

```javascript
sessionStorage.setItem('verificationToken', data.verificationToken);
sessionStorage.setItem('verificationEmail', email);
window.location.href = '/verify-email.html';
```

The verify-email.js automatically handles both methods.

## HTML Form Examples

### Registration Form

```html
<form id="registrationForm">
  <div class="form-group">
    <label for="name">Full Name</label>
    <input type="text" id="name" name="name" required>
  </div>

  <div class="form-group">
    <label for="email">Email</label>
    <input type="email" id="email" name="email" required>
  </div>

  <div class="form-group">
    <label for="password">Password</label>
    <input type="password" id="password" name="password" required minlength="8">
    <small>Minimum 8 characters</small>
  </div>

  <button type="submit" id="registerBtn">Register</button>
</form>

<div id="registerError" class="error-message"></div>
```

### Login Form

```html
<form id="loginForm">
  <div class="form-group">
    <label for="loginEmail">Email</label>
    <input type="email" id="loginEmail" name="email" required>
  </div>

  <div class="form-group">
    <label for="loginPassword">Password</label>
    <input type="password" id="loginPassword" name="password" required>
  </div>

  <button type="submit" id="loginBtn">Login</button>
</form>

<div id="loginError" class="error-message"></div>
<div id="loginWarning" class="warning-message"></div>
```

## Component Integration

### Redirect After Verification

The verify-email.js automatically redirects to `/main.html` after successful verification. You can customize this:

In `verify-email.js`, find this line:

```javascript
window.location.href = '/main.html';
```

Change it to your dashboard URL:

```javascript
window.location.href = '/dashboard.html';
```

### Custom Styling

The verify-email.css uses a professional dark theme. To customize:

1. **Colors**: Modify CSS variables
2. **Fonts**: Update font-family
3. **Layout**: Adjust grid/flex properties

Example customization:

```css
/* Override in your stylesheet */
:root {
  --primary-color: #00d4ff;
  --bg-dark: #0a0a0f;
  --text-light: #f0f0f5;
}

.verification-card {
  max-width: 600px; /* Make wider */
}
```

### Error Handling

Add proper error handling for different scenarios:

```javascript
function showError(message) {
  const errorDiv = document.getElementById('registerError');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';

  // Auto-hide after 5 seconds
  setTimeout(() => {
    errorDiv.style.display = 'none';
  }, 5000);
}

function showSuccess(message) {
  const successDiv = document.getElementById('registerSuccess');
  successDiv.textContent = message;
  successDiv.style.display = 'block';

  setTimeout(() => {
    successDiv.style.display = 'none';
  }, 3000);
}
```

## API Communication Best Practices

### 1. CORS Setup

Ensure your frontend URL is allowed in CORS:

In `server/index.js`:

```javascript
app.use(
  cors({
    origin: ['http://localhost:3000', 'https://example.com'],
    credentials: true,
  })
);
```

### 2. Credentials for Cookies

Always include credentials for requests with cookies:

```javascript
fetch(url, {
  credentials: 'include',  // Important for cookies
})
```

### 3. Error Response Handling

Handle all types of responses:

```javascript
if (response.status === 400) {
  // Bad request - validation error
} else if (response.status === 401) {
  // Unauthorized - invalid credentials
} else if (response.status === 403) {
  // Forbidden - email not verified
} else if (response.status === 409) {
  // Conflict - email already exists
} else if (response.status === 429) {
  // Rate limited
} else if (response.status === 500) {
  // Server error
}
```

## Testing Integration

### Test Flow

1. **Register a new user**
   - Fill form with valid data
   - Submit
   - Verify redirected to verification page

2. **Verify email**
   - Enter OTP
   - Verify success message appears
   - Verify redirected to dashboard

3. **Login with verified account**
   - Use same email and password
   - Verify logged in successfully

4. **Try to login with unverified email**
   - Register but don't verify
   - Try to login
   - Verify get "email not verified" error

## Environment Variables for Frontend

Create `.env.local` or similar for frontend configuration:

```
VITE_API_URL=http://localhost:3001/api
VITE_VERIFY_PAGE=/verify-email.html
VITE_LOGIN_PAGE=/login.html
VITE_DASHBOARD_PAGE=/dashboard.html
```

Use in code:

```javascript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
```

## Production Checklist

- [ ] Email configuration set up (Gmail App Password)
- [ ] HTTPS enabled
- [ ] CORS origins configured correctly
- [ ] JWT secrets set to strong random values
- [ ] Rate limiting configured appropriately
- [ ] Error messages don't leak sensitive information
- [ ] Session timeout set appropriately
- [ ] Token refresh working correctly
- [ ] Logout clears all session data
- [ ] Mobile responsive design tested
- [ ] Cross-browser compatibility tested
- [ ] Performance optimized (JS bundle size, etc.)

## Troubleshooting

### Issue: CORS Error

**Problem**: Getting CORS blocked error

**Solution**:
1. Check backend CORS configuration
2. Ensure credentials: 'include' is set
3. Check frontend and backend URLs match

### Issue: Token Not Working

**Problem**: Requests failing with 401

**Solution**:
1. Verify token is being stored
2. Check Authorization header is correct
3. Try refreshing token
4. Check token hasn't expired

### Issue: Verification Email Not Sent

**Problem**: Email not arriving at user

**Solution**:
1. Check email configuration
2. Verify Gmail 2FA enabled
3. Check spam folder
4. Review server logs

### Issue: Timer Not Counting Down

**Problem**: Timer stuck at 15:00

**Solution**:
1. Check JavaScript console for errors
2. Verify setInterval is working
3. Clear browser cache
4. Try different browser

## Support

For issues or questions:
- Check API-ENDPOINTS.md for endpoint details
- Review TESTING-GUIDE.md for test cases
- Check browser console for JavaScript errors
- Review server logs for API errors
