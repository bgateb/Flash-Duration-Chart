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

## Deploying on cPanel (Node.js Selector)

1. In cPanel, open **Setup Node.js App** → **Create Application**.
2. Node version: 20 or newer. Application root: `apps/flashduration`. Application URL: your chosen subdomain (e.g. `flashduration.example.com`).
3. Application startup file: leave default; we'll override the start command.
4. In the application's shell: `npm install && npm run build`.
5. Add all env vars from `.env.local.example` via the cPanel UI.
6. In **Startup File**, point to `node_modules/next/dist/bin/next` and set the **application startup command** to `start -p $PORT` (the exact UI varies). Alternatively, set the startup file to a small `server.js`:

   ```js
   require("next/dist/bin/next").default();
   ```

7. Restart the application. cPanel's Passenger will reverse-proxy HTTP to your Node process.

## Deploying on a plain VPS

```bash
cd apps/flashduration
npm install && npm run build
pm2 start "npx next start -p 3000" --name flashduration
# then reverse-proxy :3000 behind nginx on your chosen domain
```

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
