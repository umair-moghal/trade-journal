# My Trading Journal — source and local setup

Latest published version: v10 (13 October 2026)
Source commit: 72a0a8f7cf962d1dd4624029100314cdfaa9fb5c
Live site: https://my-trading-journal.moonumair92.chatgpt.site

This package contains the published application source, including private user journals and the signup hashing fix. The application source is unchanged; this guide is added to the archive. Dependencies, compiled output, passwords, sessions, production database contents, and uploaded trade screenshots are not included.

## 1. Requirements

- Node.js 22.13.0 or newer (use Node 22 LTS or 24 LTS).
- pnpm 11.25.0; install with `npm install -g pnpm@11.25.0`.
- Internet access for dependency installation. Screenshot OCR model assets are included under public/.
- Windows PowerShell, macOS Terminal, or Linux shell. No Bash or Cloudflare login is needed for the local commands below.

Extract the ZIP, open a terminal inside `My-Trading-Journal` (the folder containing package.json), then check:

```sh
node --version
pnpm --version
```

## 2. Install

In `pnpm-workspace.yaml`, change this existing line:

```yaml
  tesseract.js: set this to true or false
```

to:

```yaml
  tesseract.js: false
```

This explicitly skips Tesseract's dependency install hook, which is not needed for the bundled browser OCR assets. Keep the other build permissions unchanged. This resolves the `ERR_PNPM_IGNORED_BUILDS` error seen with the exported installation policy.

Then run:

```sh
pnpm install --frozen-lockfile
pnpm build
```

Use pnpm with the included pnpm lockfile. Do not use the starter's `install:ci` script or npm ci for this package. A clean extraction defaults to the portable execution profile automatically.

## 3. Initialize the local database — first run only

After the build succeeds, run both commands from the project root, in this exact order. They work in PowerShell as well as macOS/Linux shells:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_crazy_iron_patriot.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_amazing_mandroid.sql
```

These initialize local tables only. Do not rerun them against a database that already has those tables. If upgrading an older local copy that already applied 0000, run only 0001. Stop the local server and back up `.wrangler/state` before upgrading an existing local database.

There is no `pnpm db:local` script in this exact published source. Use the commands above; they avoid the Windows dynamic-import path problem from earlier packages.

## 4. Start

For the built application:

```sh
pnpm start -- --port 8787
```

Open http://127.0.0.1:8787/signup and create a local account. Use a password of 12–128 characters and save the recovery code shown at signup. There is no default admin account or password.

For development with hot reload, stop the built server with Ctrl+C, then run:

```sh
pnpm dev
```

Open the URL printed in the terminal, normally http://localhost:5173. Use the same hostname consistently during a session because localhost and 127.0.0.1 have separate browser cookies.

Both modes use the same project-local `.wrangler/state` directory for D1 and R2. Local trades and screenshots persist after refresh and server restarts. Do not delete that directory unless you intend to erase the local data. Restart with `pnpm start -- --port 8787`; no rebuild or database initialization is needed unless the source/schema changes.

## 5. Accounts and production data

- Local accounts and data are separate from the hosted site's accounts and data.
- No external auth API key is needed for local email/password signup/login.
- Password recovery uses the code issued at signup/reset. Email delivery is not configured.
- Authentication uses 600,000-round PBKDF2-SHA256 through @noble/hashes, with hashed server-side session tokens and HttpOnly cookies.
- Each account's trades, settings, strategies, and screenshot access are scoped by server-verified ownership.
- Existing hosted trades remain on the hosted site. Use Profile → Restore previous journal there, signed in with the Site-owner email and verified ChatGPT identity.
- That legacy restoration depends on the Sites hosting identity boundary and the server-only LEGACY_OWNER_EMAIL setting. A fresh local install does not need it. Do not expose locally simulated identity headers or the development server publicly.
- Source code does not include a database backup. Export your journal separately before moving deployments. Screenshot URL references in a journal export are not the screenshot image files and will not transfer image storage between environments automatically.

## 6. Verify your local setup

1. Sign up and save the recovery code.
2. Log out, log in, and confirm an empty private dashboard.
3. Add a manual BUY trade with actual entry 4190, actual exit 4200, and lot 0.01: expect +100 pips and +$10.
4. Change lot to 0.03: expect +$30 immediately.
5. Save, refresh, and verify the trade remains.
6. Upload a screenshot and verify preview and detected fields.
7. Create another account and verify it cannot see the first account's trades.

Automated tests (run from the project root):

```sh
node tests/calculations.mjs
node tests/detection.mjs
node tests/outcome.mjs
node tests/auth-isolation.mjs
```

The auth test creates isolated emulated storage; it does not use your live journal database. It checks cross-user access, private images, sessions, recovery, and ownership migration. The portable password hash is compared against Node's native PBKDF2 output. The published version also passed live signup, login, journal access, and logout checks. Windows execution has not been tested directly here.

## 7. Troubleshooting

- `ERR_PNPM_IGNORED_BUILDS`: make the Tesseract policy edit from step 2, then rerun pnpm install --frozen-lockfile.
- `no such table`: complete the build and local SQL initialization, using the same .wrangler/state path.
- `table already exists`: that migration was already applied; do not replay it. Do not delete your data to resolve this.
- `Cannot find package @noble/hashes`: install dependencies from this package's updated package.json and pnpm-lock.yaml.
- Windows ESM errors: use this package's scripts, which use file URLs for dynamic imports; do not copy older local-db.mjs helpers into it.
- `pnpm.ps1 cannot be loaded`: use `pnpm.cmd` instead of `pnpm` in PowerShell, or use Command Prompt. No execution-policy change is required.
- Port busy: stop the other process or use `pnpm start -- --port 8788`.
- Signup rate limit: wait 15 minutes after repeated failed attempts.
- Changes absent in built mode: rerun pnpm build and restart pnpm start.

## 8. Deployment notes

`pnpm build` creates a Cloudflare Worker application; it is not a static HTML export. It requires D1 (`DB`) and R2 (`BUCKET`) bindings. The included .openai/hosting.json identifies the existing Sites project; do not reuse that identity when creating an unrelated Site. For a non-Sites deployment, configure your own Worker, D1, R2, migrations, domain, and trusted identity integration. The local placeholder database ID is not a production database ID. Do not deploy with development identity simulation or blindly trust public oai-authenticated-user-* headers.

See AUTHENTICATION.md for security architecture and the preserved-data migration design. README.md contains the original framework/starter notes; follow this guide for this application's local installation.
