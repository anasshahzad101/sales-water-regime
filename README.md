# WR Sales Hub

Internal sales operations portal for **Water Regime (Pvt.) Ltd.** —
a consolidated system that replaces the three legacy Excel files
(Weekly Sales Dashboard, Industries List, Visit Plan) with one web app
the whole BD team uses.

**Live at:** `sales.waterregime.com`

---

## What it does

Five screens, one database:

| Screen            | For whom         | What it answers                               |
| ----------------- | ---------------- | --------------------------------------------- |
| **My Week**       | Sales            | What do I need to do today?                   |
| **Log a Visit**   | Sales            | Record a visit — with outcome enforcement     |
| **My Accounts**   | Sales / Manager  | My client list and their status               |
| **Team Pulse**    | Manager          | Where every deal is right now, by stage       |
| **CEO Cockpit**   | CEO (read-only)  | Pipeline, team activity, self-correction flags |

Opportunity stages: **Lead → Qualified → Proposal Submitted → Negotiation → Won (PO) → Lost**.

Outcome enforcement: every visit must get an outcome within **48 hours**.
After the grace window closes, a reason code becomes mandatory —
sales people cannot silently skip visits.

Roles: **Sales / Manager / CEO (read-only) / Admin.**

---

## Tech stack (zero-payment)

- Python 3.12 · Flask 3 · SQLAlchemy 2
- SQLite in dev, PostgreSQL in production (both free)
- Tailwind CSS (CDN) + Alpine.js
- Gunicorn WSGI server
- Deploys as-is on **Render.com** free tier,
  **PythonAnywhere**, **Railway**, or any VPS with Python

No paid SaaS, licence or API.

---

## Local setup

```bash
git clone <this-repo-url>
cd wr-sales-hub

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env            # edit SECRET_KEY
export FLASK_APP=run.py

flask full-seed                 # creates tables, demo users, loads the 299 target accounts
flask run                       # http://127.0.0.1:5000
```

Default accounts (change passwords on first login):

| Email                        | Role    | Password        |
| ---------------------------- | ------- | --------------- |
| haroon@waterregime.com       | admin   | ChangeMe123!    |
| qasim@waterregime.com        | admin   | ChangeMe123!    |
| khalid@waterregime.com       | ceo     | ChangeMe123!    |
| manager@waterregime.com      | manager | ChangeMe123!    |
| sales@waterregime.com        | sales   | ChangeMe123!    |

---

## Deploy — Render.com (recommended free path)

1. Push this repo to GitHub (any name, private is fine).
2. Go to **render.com → New → Web Service**, connect your GitHub, pick this repo.
3. Settings:
   - **Environment:** Python 3
   - **Build command:** `pip install -r requirements.txt`
   - **Start command:** `gunicorn wsgi:app`
4. Add a free **PostgreSQL** database on Render → copy its *Internal Database URL* into the web service's `DATABASE_URL` env variable.
5. Add env vars: `SECRET_KEY` (any long random string), `FLASK_ENV=production`.
6. First deploy done → open the Render shell on the web service and run:
   ```bash
   flask --app wsgi:app full-seed
   ```
7. **Custom domain `sales.waterregime.com`:**
   - In Render → Web Service → Settings → Custom Domain → add `sales.waterregime.com`.
   - Render shows a CNAME target (something like `wr-sales-hub.onrender.com`).
   - Ask the domain/hosting admin to add **one CNAME record** in `waterregime.com`'s DNS:
     - **Name:** `sales`
     - **Type:** `CNAME`
     - **Value:** the Render target
   - **Do NOT change nameservers.** The main website and email keep working untouched.
   - HTTPS is automatic (Let's Encrypt via Render).

---

## Deploy — PythonAnywhere alternative

1. Upload the repo (or git clone) into your PythonAnywhere account.
2. Create a Python 3.12 Web App, point WSGI to `wsgi.py`.
3. Create a free MySQL DB in PythonAnywhere, set `DATABASE_URL` in the Web tab's env vars.
4. In a Bash console: `pip install --user -r requirements.txt` then `flask full-seed`.
5. For `sales.waterregime.com`, PythonAnywhere needs a paid plan ($5/mo).

---

## Data seed

The `/seed_data/WR_Pakistan_Industry_Master_FINAL.xlsx` workbook is the verified
starting set:

- **299** new target accounts across 19 core industrial sectors
- **922** master companies (full industry database)
- **33** existing WR pipeline rows (loaded as initial Opportunities)

Only verified companies are included. The seed loader is idempotent — safe to re-run.

---

## File layout

```
wr-sales-hub/
├── app/
│   ├── __init__.py          # Flask factory
│   ├── models.py            # SQLAlchemy — all tables
│   ├── decorators.py        # role_required, write_required
│   ├── filters.py           # money, date_only, humanize_hours
│   ├── cli.py               # flask init-db / seed-users / seed-data / full-seed
│   ├── seed.py              # Excel → DB loader
│   ├── routes/
│   │   ├── auth.py          # login / logout / change password
│   │   ├── main.py          # My Week
│   │   ├── visits.py        # Log a Visit  (soft-block + reason codes)
│   │   ├── accounts.py      # Accounts list + detail
│   │   ├── pipeline.py      # Team Pulse + opportunity CRUD
│   │   ├── cockpit.py       # CEO Cockpit
│   │   └── admin.py         # User management
│   └── templates/           # Jinja + Tailwind + Alpine
├── seed_data/
│   └── WR_Pakistan_Industry_Master_FINAL.xlsx
├── config.py
├── requirements.txt
├── Procfile                 # web: gunicorn wsgi:app
├── runtime.txt
├── wsgi.py
├── run.py                   # local dev
├── .env.example
└── README.md
```

---

## Pending (open items)

1. Confirm Python app support on the main hosting (or go with Render).
2. Named decision-makers for the 299 new targets (Step 4 research) — to be added via the UI.
3. 11 knitwear exporters + 8 sugar mills carry *to confirm* flags.

---

**Water Regime (Pvt.) Ltd. — Internal.** All project material is confidential.
