# Play Store Analytics Monitor (Android)

Dashboard + backend that monitors all of your **Google Play Store** apps: real
installs, opens/active users and uninstalls — with one color per app and
`1D / 7D / 30D` windows. Backed by Firebase + a free Render web service.

## Run & Operate

- `pnpm --filter @workspace/firebase-analytics-mobile run dev` — run the Expo (Android) app
- `pnpm --filter @workspace/api-server run dev` — run the API backend (port 5000)
- `pnpm run typecheck` — typecheck all packages
- `pnpm run build` — typecheck + build all packages
- Current API routes (mounted under `/api`):
  - `GET /healthz`
  - `GET /apps`
  - `GET /overview?range=1D|7D|30D`
  - `GET /insights?range=1D|7D|30D`
- The backend serves **demo data until you add real Google credentials**. See
  **`SETUP.md`** for the exact steps to go live (service accounts, Play/Firebase
  access, Render deployment, app base URL).

## Stack

- pnpm workspaces, Node.js/TypeScript
- API: Express 5 (routes in `artifacts/api-server/src/routes`)
- Analytics: provider abstraction in `artifacts/api-server/src/lib/analytics`
  (demo provider + real Google service-account OAuth client)
- Android app: Expo / React Native in `artifacts/firebase-analytics-mobile`
- API contract: `lib/api-spec/openapi.yaml`

## User preferences

- Android app. Metrics must be real (`dataSource: "live"`), not faked.
- Different color per app; `1D/7D/30D` windows; show installs, opens, uninstalls.
- Everything must stay within **free-tier** limits.

## Pointers

- Mobile ↔ backend contract types: `services/api.ts` (client) and
  `artifacts/api-server/src/lib/analytics/types.ts` (server) are kept in sync.
- Follow `SETUP.md` before reporting anything as broken.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
