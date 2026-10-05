# Mind Matters Quiz 🧠

An interactive quiz web application created for **World Mental Health Day** at **Perpustakaan Negeri Sabah, Cawangan Tanjung Aru**. Hosted on Netlify with serverless Netlify Functions and Netlify Blobs key/value storage.

---

## 🌟 Key Features

- **Responsive & Accessible UI**: Mobile-first design that scales seamlessly for desktop kiosk displays. Includes high contrast, visible focus outlines, minimum 44px tap targets, and gentle CSS background animations (leaf drift & soft glow) with `prefers-reduced-motion` support.
- **Privacy & Security First**:
  - Full IC numbers and complete email addresses are stored securely on the server and **never returned to public API endpoints**.
  - Duplicate checks use SHA-256 hashes salted with `HASH_SALT`.
  - Secret answer keys reside exclusively in server-side functions and are never downloaded by the browser.
- **Server-Authoritative Timers**: Each question enforces a 15-second timer (+2s network grace). Refreshing during a quiz resumes the attempt at the current question with the server's clock.
- **Live Leaderboard**: Displays top-ranked participants by score (highest first, earlier finish time wins ties). Auto-polls every 5 seconds with masked emails (e.g., `ch****@gmail.com`).
- **Protected CSV Export**: Endpoint `/api/export` protected by `ADMIN_KEY` header for event organizers to export complete results.

---

## 🛠 Tech Stack

- **Frontend**: Plain HTML5, CSS3, Vanilla JavaScript (No build step).
- **Backend**: Netlify Functions (Node.js ES Modules).
- **Storage**: Netlify Blobs (`@netlify/blobs`).
- **Configuration**: `netlify.toml` and `package.json`.

---

## 🚀 Local Development Setup

### 1. Prerequisites
- Node.js (v18 or higher recommended)
- Netlify CLI (`npm install -g netlify-cli`) or bundled `dev-server.mjs`.

### 2. Environment Variables
Create a `.env` file in the project root or set environment variables in your shell:

```env
HASH_SALT=your_secure_hash_salt_here
ADMIN_KEY=your_secret_admin_export_key_here
```

### 3. Running Locally with Netlify CLI
Run the standard Netlify development command:

```bash
npm install
netlify dev
```

The application will launch locally at `http://localhost:8888`.

### 4. Alternative Direct Dev Server
If Netlify CLI is not installed globally, launch using Node.js:

```bash
node dev-server.mjs
```

Then visit `http://localhost:8888`.

---

## 🧪 Testing

To run the automated integration test suite:

```bash
npm test
```

This tests:
1. Registration format validation (Email & 12-digit IC format).
2. Duplicate attempt blocking and forfeiture message.
3. Fetching questions without answer key leakage.
4. Server-side answer grading and completion handling.
5. Leaderboard masking (`ch****@gmail.com`).
6. Admin export authorization (`x-admin-key`).

---

## 🌐 Netlify Deployment Steps

### Method 1: Netlify CLI (Recommended)

1. Log in to your Netlify account:
   ```bash
   netlify login
   ```
2. Initialize and link the site:
   ```bash
   netlify init
   ```
3. Set environment variables on Netlify:
   ```bash
   netlify env:set HASH_SALT "your_production_hash_salt"
   netlify env:set ADMIN_KEY "your_production_admin_key"
   ```
4. Deploy to production:
   ```bash
   netlify deploy --build --prod
   ```

### Method 2: Netlify Web Interface (Git Integration)

1. Push your repository to GitHub, GitLab, or Bitbucket.
2. In Netlify Dashboard, click **Add new site** > **Import an existing project**.
3. Select your repository. Netlify will automatically detect settings from `netlify.toml`:
   - **Publish directory**: `public`
   - **Functions directory**: `netlify/functions`
4. Go to **Site settings** > **Environment variables** and add:
   - `HASH_SALT`: Set to a strong secret string.
   - `ADMIN_KEY`: Set to a strong secret password for data export.
5. Click **Deploy site**.

---

## 📊 How to Download CSV Export

To download the CSV report containing participant emails, IC numbers, answers, scores, and timestamps:

### Using cURL:
```bash
curl -H "x-admin-key: YOUR_ADMIN_KEY" https://your-site-name.netlify.app/api/export -o mind_matters_export.csv
```

### Using PowerShell:
```powershell
Invoke-RestMethod -Uri "https://your-site-name.netlify.app/api/export" -Headers @{"x-admin-key"="YOUR_ADMIN_KEY"} -OutFile "mind_matters_export.csv"
```

### Via Web Browser / REST Client:
Send a `GET` request to `https://your-site-name.netlify.app/api/export` with request header:
```http
x-admin-key: YOUR_ADMIN_KEY
```
The browser will automatically download `mind_matters_quiz_export.csv`.

---

## 🌿 Mental Health Support Helplines

- **Befrienders KL**: [befrienders.org.my](https://www.befrienders.org.my) • 03-7627 2929 (24/7)
- **MIASA**: [miasa.org.my](https://miasa.org.my) • 1-800-820-066 / 03-7932 2504
