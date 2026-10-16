# End-to-end tests

Playwright, `bun run test:e2e -- <file> --reporter=line`. It reuses a dev server already on the address below, else starts `bun run dev`. A spec is a file in `e2e/` (`e2e/<name>.e2e.ts`), or a folder per ticket where it has person checks (`e2e/<ticket>/<ticket>.e2e.ts` with `<ticket>.manual.md`); shared helpers in `e2e/helpers/`. Steps 03 to 05 and the done screen have no spec yet.

## Settings

playwright.config.ts loads the repo's `.env`; a variable already set in the shell wins. Never commit a value.

| Name | Purpose | Example for a local run |
| --- | --- | --- |
| `PLAYWRIGHT_BASE_URL` | The app the tests drive (optional) | `http://localhost:3000` (the default) |
| `DATABASE_URL` | The app's Postgres, which `e2e/helpers/db.ts` reads to check what a flow saved and to delete the test users | `postgres://<user>:<password>@127.0.0.1:5433/<database>` (the value in `.env`) |
| `DEV_LOGIN_SECRET` | The header secret for `POST /api/dev-login`, how tests sign in | any long random string; made per run when unset. A reused dev server must have the same value in its own `.env` |

Test accounts use the `e2e.starter.test` domain (`e2e/helpers/accounts.ts`) and every test deletes the users it creates.
