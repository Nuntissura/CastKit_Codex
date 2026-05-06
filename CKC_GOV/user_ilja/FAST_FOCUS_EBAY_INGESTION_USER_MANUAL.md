# Fast Focus — eBay Ingestion User Manual (No Coding Needed)

Last updated: 2026-02-15

This guide explains how to:
- Get eBay API access (the “keys” you need)
- Run the Fast Focus eBay ingestion job
- Confirm listings show up on model pages
- Confirm click-outs are tracked

If you can copy/paste commands and follow steps carefully, you can run this.

---

## 1) What you’re doing (in plain English)

Fast Focus can pull (ingest) listings from eBay using eBay’s official API. Those listings are:
1) saved into the Fast Focus database
2) matched to the correct camera/lens model (automatic + admin review later)
3) shown on the model pages (so the website has real listings)
4) tracked when you click out to eBay (for analytics + affiliate tracking)

---

## 2) What you need installed

You only need these basics:
- **Docker Desktop** (to run the local database)
- **Node.js** (already in this project setup)
- **This Fast Focus workspace** (folders like `FF - gov/` and `FF - worktrees/`)

If you already ran the demo ingestion earlier, you’re almost set.

---

## 3) One-time: create eBay API credentials (keys)

Think of eBay API keys like a username/password for software. Keep them private.

### 3.1 Create an eBay developer account
1) Create / sign in to an eBay account
2) Go to eBay Developers Program and create a developer account

### 3.2 Create an application (get Client ID + Client Secret)
Inside the developer portal, create an “app” and find:
- **Client ID** (sometimes called App ID)
- **Client Secret** (sometimes called Cert ID)

You will copy/paste these into PowerShell as environment variables later.

### 3.3 Choose Sandbox vs Production
- **Sandbox**: safe test environment (may have limited/fake data)
- **Production**: real eBay listings (what you want for the real site)

Start with **Sandbox** if you’re unsure, then switch to **Production**.

---

## 4) Open the right PowerShell window

You need to run commands from the product repo:
- `FF - worktrees/fastfocus_platform`

Easy way:
1) Open File Explorer
2) Navigate to `FF - worktrees/fastfocus_platform`
3) Click the address bar, type `powershell`, press Enter

---

## 5) Start the database (Docker)

In that PowerShell window:
```powershell
docker compose up -d db
```

---

## 6) Set your configuration (copy/paste)

### 6.1 Set the database connection
```powershell
$env:DATABASE_URL = "postgres://fastfocus:fastfocus@127.0.0.1:55432/fastfocus"
```

### 6.2 Set eBay API credentials (REQUIRED)
Replace the values with your real keys:
```powershell
$env:EBAY_CLIENT_ID = "PASTE_YOUR_CLIENT_ID_HERE"
$env:EBAY_CLIENT_SECRET = "PASTE_YOUR_CLIENT_SECRET_HERE"
```

### 6.3 Choose eBay environment (Sandbox or Production)
Sandbox:
```powershell
$env:EBAY_ENV = "sandbox"
```
Production:
```powershell
$env:EBAY_ENV = "production"
```

### 6.4 Choose which eBay marketplace to query
Examples:
- US: `EBAY_US`
- UK: `EBAY_GB`
- Germany: `EBAY_DE`

Set one:
```powershell
$env:EBAY_MARKETPLACE_ID = "EBAY_US"
```

### 6.5 Choose which models to ingest (RECOMMENDED)
These are **Fast Focus slugs** (from the seeded catalog).

Example cameras:
```powershell
$env:FF_EBAY_CAMERA_SLUGS = "sony-a7-iv,nikon-z6-ii,fujifilm-x-t30"
```

Example lenses:
```powershell
$env:FF_EBAY_LENS_SLUGS = "olympus-m-zuiko-12-40mm-f2-8-pro,canon-rf-24-70mm-f2-8l-is-usm"
```

Optional: add extra custom searches (advanced)
```powershell
$env:FF_EBAY_EXTRA_QUERIES = ""
```

### 6.6 How many listings to fetch per model
Start small:
```powershell
$env:FF_EBAY_LIMIT_PER_QUERY = "25"
$env:FF_EBAY_PAGES_PER_QUERY = "1"
```

---

## 7) Prepare the database schema + catalog (one-time or when updated)

```powershell
npm.cmd install
npm.cmd run db:migrate
npm.cmd run db:seed:catalog
```

---

## 8) Run the real eBay ingestion job

```powershell
npm.cmd run ingest:ebay
```

This will:
- call eBay’s Browse API
- insert/update listings in Postgres
- append listing snapshots (history)
- record an ingestion run (so you can see freshness)

---

## 9) Run model matching (so listings appear under the right model page)

```powershell
npm.cmd run db:match:listings
```

Some listings will be “needs_review” at first — that’s normal.

---

## 10) Start the API and check pages

Start the server:
```powershell
npm.cmd run dev:api
```

Open these in a browser:
- `http://127.0.0.1:8787/api/v1/marketplaces` (freshness + counts)
- `http://127.0.0.1:8787/cameras/sony-a7-iv` (HTML model page + listings)
- `http://127.0.0.1:8787/lenses/olympus-m-zuiko-12-40mm-f2-8-pro` (HTML model page + listings)

---

## 11) Affiliate parameters (optional)

Fast Focus can add affiliate parameters to eBay outbound URLs.

You can test this by setting:
```powershell
$env:FF_AFFILIATE_EBAY_PARAMS = "campid=YOUR_CAMPID&customid=ff_{listing_id}"
```

Notes:
- `campid` comes from the eBay Partner Network (EPN)
- `{listing_id}` is automatically replaced (for tracking)

---

## 12) Click-out tracking (proof it worked)

1) Open a model page
2) In the Listings table, click “View” on any listing
3) You should be redirected to eBay
4) Fast Focus will log an event in the database

To check events:
```powershell
docker exec fastfocus-db-1 psql -U fastfocus -d fastfocus -c "SELECT occurred_at, event_name, listing_id, properties FROM events ORDER BY occurred_at DESC LIMIT 10;"
```

Look for `event_name = listing_clickout`.

---

## 13) Scheduling (so it runs automatically later)

Fast Focus ingestion is a command you can schedule with Windows Task Scheduler.

High-level steps:
1) Create a scheduled task
2) Action: run PowerShell
3) Command runs:
   - sets environment variables
   - runs `npm.cmd run ingest:ebay`
   - runs `npm.cmd run db:match:listings`

If you want, I can generate a ready-to-run Task Scheduler script template for your machine.

---

## 14) Troubleshooting

### “Missing EBAY_CLIENT_ID / EBAY_CLIENT_SECRET”
You didn’t set the variables in the current PowerShell session. Re-run section 6.2.

### eBay returns 401/403
- Wrong keys, or app not enabled for the API
- Using Production keys on Sandbox (or the other way around)
- Your app access might need approval depending on eBay settings

### No listings show on model pages
Usually means matching didn’t attach camera_id/lens_id yet:
1) Run: `npm.cmd run db:match:listings`
2) Check: `http://127.0.0.1:8787/api/v1/listings?marketplace=ebay`

### Docker / database errors
Make sure:
- Docker Desktop is running
- DB container is healthy:
  ```powershell
  docker ps
  ```

---

## 15) Safety rules (important)

- Treat `EBAY_CLIENT_SECRET` like a password.
- Don’t paste secrets into chat, email, or screenshots.
- If you suspect a leak, rotate the secret in the eBay developer portal.

