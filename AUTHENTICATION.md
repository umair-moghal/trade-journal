# Authentication and private journals

The application uses backend email/password registration, PBKDF2-HMAC-SHA256 password hashing (600,000 iterations and a random 128-bit salt), and random 256-bit session tokens. Only session-token hashes are stored. Cookies are HttpOnly, SameSite=Lax, and Secure on HTTPS. Remember-me sessions expire after 30 days; browser-session cookies have a 24-hour server expiry. Database throttles apply to registration, login, and recovery.

The recovery code generated at signup is shown once. Users should download it and save it in a password manager. Forgot/reset password requires the account email plus that recovery code. A reset rotates the code and password, invalidates all prior sessions, and requires a fresh login. This version does not send email reset links; no email delivery provider is configured. A lost password AND lost recovery code cannot be reset through an unverified request.

Every API operation derives identity from the session cookie. `user_trades` and `user_preferences` have composite keys `(user_id,id)`; all reads, mutations, imports and deletes are scoped to the authenticated user. Screenshots require an owned `user_images` entry and are served with no-store caching. User IDs in submitted trade payloads are discarded. D1 does not provide PostgreSQL-style RLS: ownership is enforced through server-only parameterized SQL and foreign keys, not client filtering. Direct database credentials are never exposed to clients.

Existing `trades`, `preferences`, and stored image objects are retained unchanged by the additive migrations. They are inaccessible through ordinary journal APIs. The legacy restore endpoint requires BOTH a journal session and the hosting platform's verified original-owner identity, with matching email. `LEGACY_OWNER_EMAIL` is configured as a server-only Sites runtime value. The restore copies records and image references into the verified owner's account in a database batch and preserves the originals. New registrations cannot claim old records. Existing settings in the target account are replaced by the restored legacy settings.

The platform's `/signin-with-chatgpt` integration remains intact and is used only for legacy owner verification. Normal journal login uses the application's email/password accounts.

## Local migrations and tests

Apply all pending Drizzle migrations before starting the new version. Do not copy a previous deployment's database over the current database. For a production-style local preview, run the build and apply pending migrations using Wrangler's D1 migration command and `.wrangler/state` persistence path.

`node tests/auth-isolation.mjs` tests actual D1 and R2 emulation with two accounts, signup/login/logout/recovery, portable password hashing verified against native PBKDF2, session revocation, cross-account access, imports, private images, origin checks, throttling, and verified-owner migration. `node tests/calculations.mjs`, `node tests/detection.mjs`, and `node tests/outcome.mjs` exercise unchanged trading logic.

Do not simulate the trusted hosting identity headers in public deployments. Local owner-migration tests inject them only into an isolated test database.

The hosted native PBKDF2 API rejects iteration counts above 100,000. Password derivation uses `@noble/hashes` with the same 600,000 rounds and encoding; it does not lower the work factor. Production signup and login should be tested after deployment because local Workerd can have different native crypto limits.
