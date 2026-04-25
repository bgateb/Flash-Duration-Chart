# Flash Duration Chart

A modern web chart for visualizing measured **t0.1 flash duration** across power settings for every flash unit I've tested (plus readings I've collected from elsewhere).

Inspired in function by [photonstophotos.net/Charts/PDR](https://www.photonstophotos.net/Charts/PDR.htm), but with a cleaner UI and a small admin panel so I can add flashes and readings without editing files.

Live at [flashduration.bgateb.com](https://flashduration.bgateb.com).

## Stack

- **Next.js 15** (App Router) + TypeScript + React 19
- **MySQL** via `mysql2/promise`
- **Tailwind CSS** + shadcn-style components
- **Recharts** for the line chart
- **iron-session** for single-password admin auth
- **zod** for input validation

## Data model

Two tables (see [db/schema.sql](db/schema.sql)):

- `flashes` — manufacturer, model, type, slug, firmware, rated_ws, tested_on, notes
- `readings` — flash_id, mode, stops_below_full, t_one_tenth_seconds, color_temp_k, notes

Power is stored canonically as *stops below full* (a real number ≤ 0). Fractional labels (`1/32`, etc.) are derived in code so the UI can toggle between the two representations without losing precision.

`mode` lives on the **reading**, not the flash, so a single physical unit can hold multiple test configurations (e.g. `Normal` / `Freeze` / `Color` / `Action`) without being duplicated. Each mode renders as its own line on the chart, color-matched to the flash but with a distinct dash pattern.

`rated_ws` (watt-seconds) on the flash powers the **Absolute Ws** compare mode, which lets you compare flashes of different max output at roughly the same effective power.

`type` is one of `Pack + Head`, `Speedlight`, `Monobloc`, `Battery-powered Monobloc` — used for filtering on the public chart.

## Setup

### 1. Install

```bash
cd apps/flashduration
npm install
```

### 2. Configure MySQL

Create a database and user:

```sql
CREATE DATABASE flashduration CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'flashduration'@'localhost' IDENTIFIED BY 'your-password';
GRANT ALL PRIVILEGES ON flashduration.* TO 'flashduration'@'localhost';
FLUSH PRIVILEGES;
```

Apply the schema (fresh install):

```bash
mysql -u flashduration -p flashduration < db/schema.sql
```

If you're upgrading an existing install, apply the [db/migrations/](db/migrations/) files in order instead — they cover adding `rated_ws`, moving `mode` from flashes to readings, and adding `type`.

### 3. Set env vars

```bash
cp .env.local.example .env.local
```

Then edit `.env.local`:

- `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`
- `ADMIN_PASSWORD` — chosen by you, used at `/login`
- `SESSION_SECRET` — must be 32+ chars. Generate with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Run

```bash
npm run dev
```

Visit:
- http://localhost:3000 — public chart
- http://localhost:3000/admin — admin (prompted for password)

## Usage

### Public chart (`/`)

- Toggle individual flashes on/off via the left picker (or the mobile filter drawer).
- Filter the visible set by **Brand**, **Type**, **Power range**, and **Effective Ws output** — useful for narrowing down to "all monoblocs around 400Ws" without manually un-checking dozens of units.
- Switch the X-axis between **fractional power** (`1/1`, `1/2`, …) and **stops below full**.
- Switch the Y-axis between **`1/Xs`** and **seconds**.
- Toggle **Absolute Ws** to compare flashes with different max power against each other at roughly equivalent output (uses `rated_ws`).
- Toggle dark mode via the header button.
- The active selection and filters are reflected in the URL — copy the address bar to share a specific view.

### Admin (`/admin`)

1. Log in at `/login` with `ADMIN_PASSWORD`.
2. Click **Add flash** — enter manufacturer, model, type, and (optionally) rated Ws and firmware.
3. On the flash's edit page, add readings under one or more **mode tabs** (Normal / Freeze / Color / etc.). Each reading accepts flexible input:
   - **Power:** `1/1`, `1/32`, or stops (`-5`). All normalize to stops.
   - **Duration (t0.1):** `1/4000`, `0.00025`, `0.25ms`, `250µs`. All normalize to seconds.
   - **Color temp:** Kelvin, optional.
   - **Notes:** free-form, optional.
4. Modes can be renamed (including `Normal`) without losing readings.

## Production build

```bash
npm run build
npm start
```

## Deploying to the DreamHost VPS

The repo ships with two helper scripts for the VPS at `~/flashduration.bgateb.com` (Ubuntu 22, Node 20 via nvm, pm2 already installed, Apache serving the subdomain).

### First-run (one time)

1. Push this code to a GitHub repo. From your Mac:

   ```bash
   git remote add origin git@github.com:<you>/<repo>.git
   git push -u origin main
   ```

2. Run the first-run setup script against the VPS:

   ```bash
   FLASHDURATION_REPO=git@github.com:<you>/<repo>.git ./scripts/first-run-setup.sh
   ```

   On the first pass it generates a read-only SSH deploy key on the VPS and prints the public key. Add it to the GitHub repo under **Settings → Deploy keys → Add deploy key** (read-only), then re-run.

3. When the script prompts that `.env.local` is missing, edit it on the VPS (`ssh vps`, then edit `~/flashduration.bgateb.com/.env.local`) with your MySQL creds, `ADMIN_PASSWORD`, and a 32+ char `SESSION_SECRET`, then re-run the script.

4. Apply the MySQL schema once (the VPS has the `mysql` client):

   ```bash
   ssh vps 'cd ~/flashduration.bgateb.com && \
     mysql -h "$MYSQL_HOST" -u "$MYSQL_USER" -p "$MYSQL_DATABASE" < db/schema.sql'
   ```

5. **Disable ModSecurity for the subdomain in the DreamHost panel** (`Websites → ModSecurity → (subdomain) → Disable`). DreamHost's mod_security3 + OWASP CRS silently 404s some Next.js chunk URLs and can't be disabled from `.htaccess`. The denied-files rules in [vps/htaccess.example](vps/htaccess.example) provide belt-and-suspenders coverage.

6. If the subdomain doesn't route to the app (502 / timeout):

   - Confirm `mod_proxy_http` is active on the VPS (the default `.htaccess` from [vps/htaccess.example](vps/htaccess.example) uses it), **or**
   - In the DreamHost panel, enable **Proxy Server** for `flashduration.bgateb.com` pointing at `http://127.0.0.1:3000/`, and remove the `.htaccess`.

7. To make pm2 resurrect on reboot, SSH in once and run `pm2 startup`, then follow the `sudo` line it prints.

### Subsequent deploys

From your Mac, inside `apps/flashduration/`:

```bash
./scripts/deploy.sh
```

That pushes the current branch to GitHub, SSHes into the VPS, pulls, runs `npm ci && npm run build`, and `pm2 reload flashduration`. If `.htaccess` is missing on the VPS (e.g. blown away by a panel change) it's restored from `vps/htaccess.example` automatically. Pass `--skip-push` if you've already pushed.

When the schema changes, apply the new migration on the VPS before deploying:

```bash
ssh vps 'cd ~/flashduration.bgateb.com && \
  mysql -h "$MYSQL_HOST" -u "$MYSQL_USER" -p "$MYSQL_DATABASE" < db/migrations/000X_*.sql'
```

### Env vars the scripts respect

| Variable | Default | Purpose |
|---|---|---|
| `FLASHDURATION_HOST` | `vps` | SSH host alias |
| `FLASHDURATION_DIR` | `/home/bgatebvps/flashduration.bgateb.com` | Deploy path on VPS |
| `FLASHDURATION_BRANCH` | `main` | Branch to deploy |
| `FLASHDURATION_REPO` | _(required for first-run)_ | Repo URL, `git@github.com:…` |
| `FLASHDURATION_PM2_NAME` | `flashduration` | pm2 app name |

## Project structure

```
apps/flashduration/
├── db/
│   ├── schema.sql                       ← run against MySQL once
│   └── migrations/                      ← incremental ALTERs for upgrades
├── scripts/
│   ├── deploy.sh
│   ├── first-run-setup.sh
│   ├── import-hve-elinchrom.mjs         ← bulk-import Hans van Eijsden Elinchrom data
│   └── fix-hve-stops.mjs
├── vps/
│   └── htaccess.example                 ← Apache proxy + denied-files config
├── ecosystem.config.cjs                 ← pm2 process definition
├── src/
│   ├── app/
│   │   ├── page.tsx                     ← public chart
│   │   ├── api/
│   │   │   ├── chart-data/route.ts
│   │   │   ├── flashes/route.ts
│   │   │   ├── flashes/[id]/route.ts
│   │   │   ├── readings/route.ts
│   │   │   ├── readings/[id]/route.ts
│   │   │   ├── readings/rename-mode/route.ts
│   │   │   └── auth/route.ts
│   │   ├── login/page.tsx               ← password login
│   │   └── admin/
│   │       ├── layout.tsx               ← admin header + auth gate
│   │       ├── page.tsx                 ← flash list (with brand/type/power filters)
│   │       └── flashes/
│   │           ├── new/page.tsx
│   │           └── edit/page.tsx        ← edit flash + readings (uses ?id=)
│   ├── components/
│   │   ├── FlashChart.tsx
│   │   ├── FlashChartView.tsx           ← URL-stateful chart container
│   │   ├── FlashFilters.tsx             ← brand/type/range filter UI
│   │   ├── FlashPicker.tsx
│   │   ├── LoginForm.tsx
│   │   ├── LogoutButton.tsx
│   │   ├── ThemeToggle.tsx              ← dark mode toggle
│   │   ├── admin/FlashForm.tsx
│   │   ├── admin/ReadingsEditor.tsx     ← mode tabs + per-mode reading rows
│   │   └── ui/…                         ← button, input, card, sheet (mobile drawer), etc.
│   └── lib/
│       ├── db.ts                        ← mysql2 pool
│       ├── queries.ts
│       ├── session.ts                   ← iron-session config
│       ├── api.ts                       ← guardAdmin helper
│       ├── filters.ts                   ← multi-select + range filter primitives
│       ├── power.ts                     ← stops ↔ fraction, effective Ws math
│       ├── duration.ts                  ← seconds ↔ 1/Xs
│       ├── slug.ts
│       ├── colors.ts
│       ├── cn.ts
│       └── types.ts
└── .env.local.example
```

The flash edit page lives at `/admin/flashes/edit?id=X` rather than `/admin/flashes/[id]` because Apache on DreamHost rejects URL-encoded brackets (`%5B`/`%5D`) in dynamic-segment chunk URLs.

## Out of scope (for now)

- t0.5 duration (only t0.1 captured — easy additive change later)
- Multiple users / full OAuth (single-password admin only)
- CSV import (a one-off Elinchrom importer exists in [scripts/](scripts/) but there's no general UI)
- PNG / SVG export of the chart
