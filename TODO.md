# TODO - 2-step registration + fake email protection

- [x] Implement DB support for pending/verified users and OTP codes
- [x] Add config for allowed email domains
- [x] Add API: `POST /api/auth/register` step 1 (create pending user + generate OTP)
- [x] Add API: `POST /api/auth/verify-registration` step 2 (verify OTP + issue tokens)
- [x] Ensure login/auth cannot authenticate unverified accounts
- [x] Update frontend (`app.js` + `main.html`) to support the 2-step verification UI
- [x] Add frontend validation for allowed email domains
- [ ] Test flows: register -> verify -> login; fake domain blocked; wrong OTP blocked; OTP expiry

