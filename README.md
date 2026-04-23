# Flash Duration Chart

A modern web chart for visualizing measured **t.1 flash duration** across power settings for every flash unit I've tested.

Inspired in function by [photonstophotos.net/Charts/PDR](https://www.photonstophotos.net/Charts/PDR.htm), but with a cleaner UI and a small admin panel so I can add flashes and readings without editing files.

## Stack

- **Next.js 15** (App Router) + TypeScript
- **MySQL** via `mysql2/promise`
- **Tailwind CSS** + shadcn-style components
- **Recharts** for the line chart
- **iron-session** for single-password admin auth

## Data model

Two tables (see [db/schema.sql](db/schema.sql)):

- `flashes` — manufacturer, model, slug, mode, firmware, tested_on, notes
- `readings` — flash_id, stops_below_full, t_one_tenth_seconds, color_temp_k, notes

Power is stored canonically as *stops below full* (a real number ≤ 0). Fractional labels (`1/32`, etc.) are derived in code so you can toggle between the two representations without losing precision.

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

Apply the schema:

```bash
mysql -u flashduration -p flashduration < db/schema.sql
```

### 3. Set env vars

```bash
cp .env.local.example .env.local
```

Then edit `.env.local`:

- `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`
- `ADMIN_PASSWORD` — chosen by you, used for `/admin/login`
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

1. Log in at `/admin/login` with `ADMIN_PASSWORD`.
2. Click **Add flash** — enter manufacturer + model (e.g. `Godox` / `AD200 Pro`). `Mode` is free-form (`Normal`, `Freeze`, etc.) to distinguish different test configurations of the same unit.
3. On the flash's edit page, add readings. Each reading accepts flexible input:
   - **Power:** `1/1`, `1/32`, or stops (`-5`). All normalize to stops.
   - **Duration (t.1):** `1/4000`, `0.00025`, `0.25ms`, `250µs`. All normalize to seconds.
   - **Color temp:** Kelvin, optional.
   - **Notes:** free-form, optional.
4. Visit `/` to see the chart. Toggle flashes via the left picker; switch X-axis between fractional / stops; switch Y-axis between `1/Xs` / seconds.

## Production build

```bash
npm run build
npm start
```

## Deploying to the DreamHost VPS

The repo ships with two helper scripts designed for this app's VPS:
`~/flashduration.bgateb.com` on Ubuntu 22, Node 20 via nvm, pm2 already installed,
Apache serving the subdomain.

### First-run (one time)

1. Create the GitHub repo (private), push this code to it. From your Mac:

   ```bash
   git remote add origin git@github.com:<you>/<repo>.git
   git push -u origin main
   ```

2. Run the first-run setup script against the VPS:

   ```bash
   FLASHDURATION_REPO=git@github.com:<you>/<repo>.git ./scripts/first-run-setup.sh
   ```

   On the first pass it generates a read-only SSH deploy key on the VPS and
   prints the public key. Add it to the GitHub repo under
   **Settings → Deploy keys → Add deploy key** (read-only), then re-run.

3. When the script prompts that `.env.local` is missing, edit it on the VPS
   (`ssh vps`, then edit `~/flashduration.bgateb.com/.env.local`) with your
   MySQL creds, `ADMIN_PASSWORD`, and a 32+ char `SESSION_SECRET`, then re-run
   the script.

4. Apply the MySQL schema once (the VPS has the `mysql` client):

   ```bash
   ssh vps 'cd ~/flashduration.bgateb.com && \
     mysql -h "$MYSQL_HOST" -u "$MYSQL_USER" -p "$MYSQL_DATABASE" < db/schema.sql'
   ```

5. If the subdomain doesn't route to the app (502 / timeout), either:

   - Confirm `mod_proxy_http` is active on the VPS (the default `.htaccess` from
     [vps/htaccess.example](vps/htaccess.example) uses it), **or**
   - In the DreamHost panel, enable **Proxy Server** for
     `flashduration.bgateb.com` pointing at `http://127.0.0.1:3000/`, and
     remove the `.htaccess`.

6. To make pm2 resurrect on reboot, SSH in once and run `pm2 startup`, then
   follow the `sudo` line it prints.

### Subsequent deploys

From your Mac, inside `apps/flashduration/`:

```bash
./scripts/deploy.sh
```

That pushes the current branch to GitHub, SSHes into the VPS, pulls, runs
`npm ci && npm run build`, and `pm2 reload flashduration`. Pass `--skip-push`
if you've already pushed.

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
├── db/schema.sql                        ← run against MySQL once
├── src/
│   ├── app/
│   │   ├── page.tsx                     ← public chart
│   │   ├── api/
│   │   │   ├── chart-data/route.ts
│   │   │   ├── flashes/route.ts
│   │   │   ├── flashes/[id]/route.ts
│   │   │   ├── readings/route.ts
│   │   │   ├── readings/[id]/route.ts
│   │   │   └── auth/route.ts
│   │   └── admin/
│   │       ├── login/page.tsx
│   │       └── (gated)/
│   │           ├── layout.tsx           ← admin header
│   │           ├── page.tsx             ← flash list
│   │           └── flashes/
│   │               ├── new/page.tsx
│   │               └── [id]/page.tsx    ← edit flash + readings
│   ├── components/
│   │   ├── FlashChart.tsx
│   │   ├── FlashChartView.tsx
│   │   ├── FlashPicker.tsx
│   │   ├── LoginForm.tsx
│   │   ├── LogoutButton.tsx
│   │   ├── admin/FlashForm.tsx
│   │   ├── admin/ReadingsEditor.tsx
│   │   └── ui/…                         ← button, input, card, etc.
│   ├── lib/
│   │   ├── db.ts                        ← mysql2 pool
│   │   ├── queries.ts
│   │   ├── session.ts                   ← iron-session config
│   │   ├── api.ts                       ← guardAdmin helper
│   │   ├── power.ts                     ← stops ↔ fraction
│   │   ├── duration.ts                  ← seconds ↔ 1/Xs
│   │   ├── slug.ts
│   │   ├── colors.ts
│   │   ├── cn.ts
│   │   └── types.ts
│   └── middleware.ts                    ← gates /admin/**
└── .env.local.example
```

## Out of scope (for now)

- t.5 duration (only t.1 captured — easy additive change later)
- Multiple users / full OAuth (single-password admin only)
- CSV import (readings entered manually)
- PNG / SVG export of the chart
