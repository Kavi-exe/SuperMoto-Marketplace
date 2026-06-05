# TODO - Login/Signup Gate + Local Server Auth

## Step 1: Backend scaffolding (Express + SQLite)
- [ ] Create `server/index.js`
- [ ] Create `server/database.js` (SQLite schema + helpers)
- [ ] Add `server/package.json` (or update root `package.json`)
- [x] Implement auth endpoints:
  - [x] `POST /api/auth/signup`
  - [x] `POST /api/auth/login`
  - [x] `POST /api/auth/logout`
  - [x] `GET /api/auth/me`
- [x] Session storage (HTTP-only cookie)


## Step 2: Frontend auth UI (matches theme)
- [ ] Add `#auth-overlay` overlay + login/signup form markup to `main.html`
- [ ] Add CSS for auth overlay to `style.css`

## Step 3: Frontend gating
- [ ] Update `app.js` to fetch `/api/auth/me` on load
- [ ] Block navigation to `post-ad` and `profile` when logged out
- [ ] Open auth overlay when blocked; continue to intended view after login
- [ ] Implement login/signup submit handlers
- [ ] Implement logout button + UI state changes

## Step 4: Run & test
- [ ] Install backend dependencies
- [ ] Start backend server
- [ ] Start frontend dev server
- [ ] Validate signup/login flow and route gating

