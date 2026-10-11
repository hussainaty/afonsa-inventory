# Workflow state

Resumed on 2026-10-11 at the review phases of `engineering-workflow`; the build itself predates the workflow files.

| Phase | Gate | Status | Evidence |
|---|---|---|---|
| 0 Recall and route | Route chosen, memory read | Passed | Route: engineering-workflow (coordinator) + the-jury + product-quality-loop + graphify + scrapegraphai-research (fallback route). Global memory had no entry for this project. |
| 1 Research | Cited research | Passed | `workflow/RESEARCH.md` |
| 2 Question gate | Human answers | **Open** | See "Open questions" below |
| 5 Jury and judge | Verdict | REVISE -> fixed -> ACCEPT (round 1) | See "Jury" below |
| 6/8 Testing | Suite green | Passed | See "Testing report" |
| 9 Document and remember | Graph + memory | Graph built (`graphify-out/`) | — |

`error-analysis` was not run as written: it analyses LLM pipeline traces and this app has no LLM. Its method (categorise observed failures) is applied to the review findings below.

## Jury (4 jurors, blind, one lens each; orchestrator acted as judge and verified every finding in code)

No juror found a blocker. Tenant isolation and the core ledger (`applyMoves`, reference sequence, validation locking) were independently reported as sound.

### Confirmed and fixed

| # | Lens | Finding | Fix | Proof |
|---|---|---|---|---|
| S1 | Security | Any member could list pending invitations through Better Auth's HTTP API and claim an admin invitation | `/api/auth/*` allow-list (sign-in, sign-up, sign-out, get-session only) | live check: `organization/list-invitations` -> 404 |
| S3 | Security | Rate limiter was in memory per serverless instance | `rateLimit.storage: "database"` + `rate_limit` table (migration 0003) | live check: 4th wrong sign-in -> 429 |
| S4 | Security | Open sign-up with no limits | optional `SIGNUP_ALLOWED_EMAILS` allow-list (invited emails always allowed), `organizationLimit: 5` | code; needs owner decision to enable |
| S5 | Security | Open redirect via `next=/\evil.com` | same-origin check with `new URL` | code |
| S6 | Security | No Content-Security-Policy | CSP header | live check |
| S7/O9 | Security/Ops | Upload size checked only after buffering; 4.5–5 MB files hit Vercel's limit | reject missing/oversized `content-length`, 4 MB cap | code |
| C1 | Correctness | "Save & validate" left an orphan draft and burned a reference on failure | create + validate in one transaction | `tests/review-fixes.test.ts` |
| C2/O1 | Correctness/Ops | Workspace deletion endpoint was live and would fail half-way or wipe the ledger | `disableOrganizationDeletion: true` | live check: -> 404 |
| C3 | Correctness | Physical count lost-update race | `FOR UPDATE` on the quant | test (serialised on PGlite) |
| C4/C8 | Correctness | Same item name could split into two items; new size could carry a different unit/category | adopt the existing item by name; inherit shared fields; refuse rename onto another item | tests |
| C5 | Correctness | Opposite transfers could deadlock | lock all touched quants in one order | code (not reproducible on PGlite) |
| C6 | Correctness | Stale `?location=` crashed the product list (NUL byte) | return empty list | test |
| C7 | Correctness | Prices above 21,474,836.47 overflowed the cents column | cap at 21,000,000 | test |
| C9 | Correctness | Category delete could fail with a generic error | explicit message | test |
| C10 | Correctness | Empty number field became 0 (a blank count zeroed stock) | empty -> validation error | test |
| C11 | Correctness | Internal transfer pre-selected the same source and destination | re-key selects on type | code |
| C12/U8/U11 | Correctness/UX | Archiving a size with stock stranded it; last location could be archived; archived stock counted in totals | refuse both; filter totals; archived notice | tests |
| O2/O3 | Ops | Preview builds would migrate production; migrations ran before the build | migrate only when `VERCEL_ENV=production`, after `next build` | preview-style build + migrate run |
| O4 | Ops | Free Supabase pauses after a week idle | `/api/health` + daily Vercel cron | live check |
| O10/O12 | Ops | 30 s connect hang; PGlite loaded in production; DB opened at import | `connect_timeout: 10`; lazy client; PGlite required on demand | build without DB passes |
| O13 | Ops | Workspace setup transaction on every cold start | removed from request path | e2e |
| O18 | Ops | Unused `@libsql/client`; no `engines` | removed; `node 24.x` | — |
| — | Ops | New advisories in Next.js 16.0–16.3.7, sharp, source-map-js | Next 16.3.8, `npm audit fix` | `npm audit --omit=dev`: only the dev-only esbuild chain remains |
| U1 | UX | Scan button did nothing when already on Products | Scan is a button; scanner re-keys | code |
| U2/U4 | UX | A validation error wiped the whole form; offline submit showed the crash page | shared `useServerForm` hook (no reset, offline message); `(app)/error.tsx` | e2e |
| U3 | UX | Move was a dead end with one location / an empty size | explanation + link; open on a stocked size | code |
| U5 | UX | No loading feedback on navigation | `(app)/loading.tsx` | code |
| U7 | UX | Archive/Delete wording said "product" for one size | size-specific copy | code |
| U9 | UX | History showed "Partners/Vendors", "Virtual/Inventory adjustment" | Supplier / Customer / Stock count / Damaged | code |
| U12/U13 | UX | Amount erased on location change; silent errors on compact buttons | fixed | code |
| U14/U15 | UX | Field borders 1.25:1, placeholders 3.1:1; 36 px touch targets | darker field border, full-contrast placeholder, 44 px on touch | code |

### Confirmed, not fixed (follow-ups)

- **No pagination**: product list caps at 1,000 sizes, history and operations at 200 (O5). Fine for a first deploy; needed before ~1,000 sizes.
- **Thumbnails** load the full photo through an auth round trip (O6); a stored small thumbnail would cut bucket downloads.
- **Camera scanning on iPhone** probably falls back to typing because Safari lacks `BarcodeDetector` (U10, unverified on a device); needs a JS decoder.
- **No password reset** (U6): there is no email provider. See open questions.
- **Invite link is a bearer link** for its 48 h life (S2); by design without email.
- Members can delete photos and cancel any draft (S9, design choice); images are not re-encoded, EXIF kept (S8); service-worker cache never pruned (O14); e2e not in CI (O17); mixed "product/item/size" wording, no currency symbol, RTL not supported (U18); operation form lists up to 1,000 products without search (U16).

### Dissent preserved

- Security juror wanted signed photo URLs cut to 5–10 minutes; operations juror wanted them stable and cached longer to save bucket downloads. Kept at 1 hour.
- Operations juror suggested a scheduled `pg_dump` to GitHub artifacts. Rejected: artifacts of a public repository are downloadable by any signed-in GitHub user, which would publish the database. An in-app export is proposed instead.

## Testing report — project

- Commands and results: `npm run typecheck` -> 0; `npm run lint` -> 0; `npm test` -> 0 (28 passed, 3 files); `next build` -> 0; `npx playwright test` -> 0 (2/2: desktop and Pixel 7 journeys); preview-style build without `DATABASE_URL` -> 0.
- Live checks on a local production server: health 200; closed auth endpoints 404; sign-in throttled on the 4th attempt; CSP header present.
- Not run, and why: nothing against real Postgres/Supabase or the S3 bucket from this machine, and no deployment smoke test — the Vercel project has no `DATABASE_URL` or bucket keys yet. CI now applies the migrations twice to a real Postgres service.

## Open questions (Phase 2 gate)

1. **Blocking for go-live:** the Supabase database password / `DATABASE_URL` and the Backblaze bucket + key must be created by the owner (secrets are not handled by the agent).
2. Who may sign up? Default is open sign-up. Recommended: set `SIGNUP_ALLOWED_EMAILS` to the owner's email so everyone else joins by invite only.
3. Add a free email provider (e.g. Resend) for password reset and emailed invites? Without it a forgotten password cannot be recovered.
4. Which of the researched next features matter (see `RESEARCH.md`): CSV export/import, location QR labels, multiple barcodes, count sessions with approval, dead-stock report, lots/serials.
5. Are iPhones used in the warehouse? If yes, the scanner needs a JS barcode decoder.
