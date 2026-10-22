# WR Sales Hub

Internal sales operations portal for **Water Regime (Pvt.) Ltd.** It replaces the three Excel files
(target companies, visit plan, weekly dashboard) with one shared system: salespeople record the
companies they chase, every visit and every deal; managers and the CEO see the state of sales
without asking anyone.

- **Next.js 16** (App Router, Cache Components, Server Actions) · React 19 · TypeScript · Tailwind CSS 4
- **Live database:** MariaDB / MySQL on Hostinger (Drizzle ORM + mysql2)
- **Local development:** a JSON file (`.data/db.json`) — no database to install
- **Hosting:** Vercel

Design source: `WR Sales Hub design system/` (Claude Design export — open the `.dc.html` files in a browser).

---

## Screens

| Screen | Who | Answers |
|---|---|---|
| **My Week** (`/my-week`) | Sales, Manager, Admin | What do I need to do today? Outcomes to set (48-hour countdown, late reason after that), follow-ups due (tick off with undo), my open deals, self-correction flags |
| **Log a visit** (`/log`) | Sales, Manager, Admin | Record what happened — searchable company, linked deal, visit type, time in PKT, outcome, skip reason, next action |
| **Visits** (`/visits`) | Sales (own) / Manager, Admin (team) | Visit history with filters and Excel export |
| **Accounts** (`/accounts`, `/accounts/new`, `/accounts/[id]`) | Sales, Manager, Admin (CEO: read-only detail) | Which companies are we chasing? Filters, add company with duplicate warning, contacts (call / WhatsApp / email), claim, timeline |
| **Team Pulse** (`/pulse`, `/deals/new`, `/deals/[id]`) | Sales, Manager, Admin (CEO: read-only detail) | Where is every deal? Kanban by stage, filters, edit deal, stage changes with lost reasons, proposals |
| **Cockpit** (`/cockpit`) | Everyone (home for the CEO) | How is sales going? Date filter, weighted pipeline, win rate, by salesperson, flags with drill-downs, lost reasons |
| **Users** / **Audit log** (`/admin/...`) | Admin | Add users, roles, reset passwords, deactivate; every change recorded |

Roles: **Sales · Manager · CEO (read-only) · Admin**. Light and dark theme (user menu), phone and desktop layouts.

**Rules built in:** an outcome is due within 48 hours of a visit (after that a written late reason is required);
skipped visits need a reason; deals more than 30 days in one stage are *stuck*; owned accounts with no visit
in 60 days are *dormant*; open deals past their expected close date are flagged. All enforced on the server.

**Security:** passwords hashed with bcrypt; signed, HTTP-only session cookies; sign-in locks for 15 minutes
after 5 wrong passwords; everyone must replace the shared starting password at first sign-in; password
changes and role changes sign out other devices; Server Actions are protected against cross-site requests;
the CEO account cannot change anything.

---

## Run it on your computer

Requirements: **Node.js 20.9+** (22 LTS recommended).

```bash
npm install
npm run dev
```

Open http://localhost:3000. The first `npm run dev` creates `.data/db.json` with the 332 companies and
33 pipeline deals from `seed_data/WR_Pakistan_Industry_Master_FINAL.xlsx`, plus **demo activity**
(sample salespeople, contacts, visits, proposals) so every screen has something to show.

Sign-in accounts (password for all: `ChangeMe123!`, or `SEED_DEFAULT_PASSWORD` if you set it):

| Account | Role | Notes |
|---|---|---|
| `ali.raza@waterregime.com` | Sales | demo — lots of activity |
| `bilal.ahmed@waterregime.com` | Manager | demo |
| `zainab.qureshi@waterregime.com` | CEO | demo, read-only |
| `kamran.javed@waterregime.com` | Admin | demo |
| `haroon@`, `qasim@` (admin), `khalid@` (CEO), `manager@`, `sales@waterregime.com` | — | real starting accounts — must set a new password at first sign-in |

Start over with fresh data: delete `.data/db.json` and run `npm run dev` again
(or `npm run db:seed -- --demo`).

Useful commands:

```bash
npm run typecheck     # TypeScript
npm run lint          # ESLint
npm run build         # production build
```

---

## Deploy: Vercel + Hostinger MariaDB

### 1. Create the database on Hostinger
1. **hPanel → Databases → MySQL Databases**: create a database and a user with a strong password.
   Note the database name and user (Hostinger prefixes them, e.g. `u123456789_saleshub`).
2. **hPanel → Databases → Remote MySQL**: allow remote connections for that database from
   **any host (`%`)**. Vercel's servers don't have fixed IP addresses, so a single-IP rule won't work.
   Use a long random password because the database is reachable from the internet.
3. Note the **remote host name** shown there (for example `srv1234.hstgr.io`) and the port (3306).

### 2. Create the tables and load the data (once, from your computer)
Create `.env.local` (copy `.env.example`) with:

```
DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/DATABASE
```

(URL-encode special characters in the password, e.g. `@` → `%40` — or use the separate `DB_HOST`,
`DB_USER`, `DB_PASSWORD`, `DB_NAME` variables instead.) Allow your own IP in Remote MySQL too, then:

```bash
npm run db:check      # connects and reports what it finds
npm run db:migrate    # creates the tables
npm run db:seed       # Excel companies + pipeline + the 5 starting accounts (no demo data)
npm run db:check      # should now list row counts
```

Never run `db:seed -- --demo` against the live database (the script refuses unless forced).
Remove `DATABASE_URL` from `.env.local` afterwards if you want to go back to the local JSON file.

### 3. Deploy on Vercel
1. Import the GitHub repository in Vercel (framework: Next.js — detected automatically).
2. **Settings → Environment Variables** (Production and Preview):
   - `SESSION_SECRET` — 32+ random characters
     (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
   - `DATABASE_URL` — as above (or `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`)
   - optional: `DB_SSL=true` if your host requires TLS, `DATABASE_POOL_MAX` (default 3)
3. Deploy. The `vercel-build` script applies any new database migrations, then builds.
4. **Settings → Functions → Region**: choose the Vercel region closest to your Hostinger server
   (hPanel shows the data-centre location). Every page makes several database queries, so distance matters.
5. Custom domain (e.g. `sales.waterregime.com`): **Settings → Domains**, then add the CNAME record Vercel shows
   in Hostinger's DNS zone. Your main website and email are unaffected.

### 4. First sign-in
Sign in as `haroon@waterregime.com` / `ChangeMe123!` (or your `SEED_DEFAULT_PASSWORD`), set a new password,
then add the team under **Admin → Users** (each person sets their own password at first sign-in).

**Plan note:** Vercel's free Hobby plan is for personal, non-commercial use only. A company tool should run on
**Vercel Pro** (charged per developer seat; people who only *use* the app don't need seats).

---

## How it's built

```
src/
  app/
    (auth)/            sign-in, first-password screens
    (app)/             the signed-in app (layout = sidebar / phone tab bar)
      my-week/ log/ visits/ accounts/ pulse/ deals/ cockpit/ admin/ change-password/
    actions/           Server Actions (auth, visits, accounts, deals, admin)
    export/*/route.ts  Excel downloads of the filtered lists
    api/search/        global search (press "/")
  components/
    shell/             sidebar, header, phone bars, theme, search
    ui/                design-system components (pills, inputs, pickers, overlays, filters, …)
  lib/
    constants.ts       every dropdown / stage / outcome / threshold — one source
    rules.ts           48-hour, stuck, dormant, close-passed logic
    data/              storage layer: store() → MySQL (live) or JSON (local)
    db/schema.ts       table definitions (Drizzle, MySQL)
    auth/              sessions, password hashing, data-access checks
    queries/           data for each screen
scripts/               migrate, seed (Excel import), db check
drizzle/               SQL migrations (generated: npm run db:generate)
```

Changing the schema: edit `src/lib/db/schema.ts`, run `npm run db:generate`, commit the new file in `drizzle/`;
the next Vercel deploy applies it.

All dates and times are shown in Pakistan time (PKT). Timestamps are stored in UTC.
