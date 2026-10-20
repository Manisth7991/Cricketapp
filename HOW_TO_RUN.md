# How to run PlayLocal

PlayLocal has **two parts that run separately**, each in its own folder and its own terminal:

| Part                         | Folder                | Runs on               |
| ---------------------------- | --------------------- | --------------------- |
| **Backend** (API + database) | `Cricketapp/backend`  | http://localhost:5000 |
| **Frontend** (website)       | `Cricketapp/frontend` | http://localhost:5173 |

**Start the backend first, then the frontend.** Keep both terminals open while you use the app.

---

## Step 1 — Install packages (first time only)

Run this **once**, from the main `Cricketapp` folder. It installs packages for the backend,
the frontend and the shared code together:

```bash
cd ~/Desktop/Cricketapp
npm install
```

---

## Step 2 — Check the `.env` files (first time only)

| Folder     | File            |
| ---------- | --------------- |
| `backend`  | `backend/.env`  |
| `frontend` | `frontend/.env` |

On this machine **both files already exist and are filled in** (MongoDB Atlas + Cloudinary) —
nothing to do.

On a new machine, create them from the examples and fill in `backend/.env`
(`MONGO_URI`, `JWT_SECRET`, `CLOUDINARY_*`, `ADMIN_PHONES`):

```bash
cd ~/Desktop/Cricketapp/backend
cp .env.example .env

cd ~/Desktop/Cricketapp/frontend
cp .env.example .env
```

---

## Step 3 — Seed the database (first time only)

Run inside the **backend** folder. Creates the sports list and syncs the admin accounts
(the numbers in `ADMIN_PHONES` — the server also does this on every start).
(Already done for the current Atlas database.)

```bash
cd ~/Desktop/Cricketapp/backend
npm run seed
```

Optional demo data (sample users, teams, tournaments):

```bash
npm run seed -- --demo
```

---

## Step 4 — Run the backend (Terminal 1)

```bash
cd ~/Desktop/Cricketapp/backend
npm run dev
```

Wait for:

```
🏏 PlayLocal API listening on http://localhost:5000
```

Check it: open http://localhost:5000/api/health → should show `"db":"up"`.

---

## Step 5 — Run the frontend (Terminal 2)

Open a **new terminal window/tab**, then:

```bash
cd ~/Desktop/Cricketapp/frontend
npm run dev
```

Wait for:

```
➜  Local:   http://localhost:5173/
```

---

## Step 6 — Open the app and log in

| What          | URL                         |
| ------------- | --------------------------- |
| Website       | http://localhost:5173       |
| Admin console | http://localhost:5173/admin |

**Users log in with their mobile number + OTP** (the same screen is used for sign-up):

1. Click **Log in** → enter a 10-digit mobile number → **Get OTP**.
2. Enter the 6-digit code.
3. New number? You'll be asked for your name once — then you're in.

In development **no real SMS is sent**. The code is shown:

- on the login screen (blue "Development mode" box), and
- in the **backend terminal (Terminal 1)**:

```
WARN: 📱 [DEV SMS] OTP for 9876543210: 482913
```

**Admin console** uses the very same login. The numbers listed in `ADMIN_PHONES` in `backend/.env`
(currently `6393136745` and `7887061739`) land on http://localhost:5173/admin after the OTP; any
other number is a normal user. There is no admin password. To add or remove an admin, edit
`ADMIN_PHONES` and restart the backend (or run `npm run sync-admins`).

---

## Step 7 — Stop

Press **Ctrl + C** in **both** terminals.

---

## Every day after the first time

Only steps 4 and 5:

```bash
# Terminal 1
cd ~/Desktop/Cricketapp/backend
npm run dev

# Terminal 2
cd ~/Desktop/Cricketapp/frontend
npm run dev
```

---

## Other commands

| Do this                         | Folder     | Command                                     |
| ------------------------------- | ---------- | ------------------------------------------- |
| Sync admins with `ADMIN_PHONES` | `backend`  | `npm run sync-admins`                       |
| Build backend for production    | `backend`  | `npm run build` then `npm start`            |
| Build frontend for production   | `frontend` | `npm run build` (output in `frontend/dist`) |

---

## Sending real OTP SMS (when going live)

Development uses `SMS_PROVIDER=console`. For real SMS, pick a provider and set it in `backend/.env`:

**MSG91 (recommended for India)**

```env
SMS_PROVIDER=msg91
MSG91_AUTH_KEY=<your auth key>
MSG91_TEMPLATE_ID=<DLT-approved OTP template id, containing ##OTP##>
```

**Twilio**

```env
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=<ACxxxxxxxx>
TWILIO_AUTH_TOKEN=<token>
TWILIO_FROM=<sender number>        # or TWILIO_MESSAGING_SERVICE_SID=<MGxxxxxxxx>
```

> India requires DLT registration (sender ID + OTP template) before operators deliver OTP SMS — done in
> the provider's dashboard and can take a few days. Restart the backend after changing `.env`.

---

## Problems?

| Problem                                                                | Fix                                                                                                                                |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Website loads but shows "Couldn't load" / "Unable to reach the server" | The **backend is not running** — do Step 4.                                                                                        |
| Backend says `❌ Invalid environment configuration`                    | Fill in the values it lists in `backend/.env`.                                                                                     |
| Backend can't connect to MongoDB                                       | MongoDB Atlas → **Network Access** → add your current IP.                                                                          |
| `EADDRINUSE` (port already in use)                                     | Something is already running there. Close the other terminal, or run `lsof -ti :5000 \| xargs kill` (use `5173` for the frontend). |
| `command not found: npm`                                               | Install Node.js 20+ from https://nodejs.org                                                                                        |
| `Cannot find module …`                                                 | Run `npm install` again from the main `Cricketapp` folder (Step 1).                                                                |
| Image upload fails                                                     | Look at the **backend terminal** — it prints the exact Cloudinary error.                                                           |
| Didn't get the OTP (development)                                       | No SMS is sent in development — read the code on the login screen or in Terminal 1 (`[DEV SMS] OTP for …`).                        |
| "Please wait 25s before requesting another code"                       | Resend is allowed every 30 seconds.                                                                                                |
| "Too many codes requested for this number"                             | Max 5 OTPs per number per hour — wait, or use another number while testing.                                                        |
| "Too many wrong attempts"                                              | Request a new code (each code allows 5 tries).                                                                                     |
| OTP not printed in Terminal 1                                          | Another backend is already running on port 5000 — close it (`lsof -ti :5000 \| xargs kill`) and start again.                       |
| Real SMS not arriving (live)                                           | Check Terminal 1 for `OTP SMS failed` with the provider's reason (credentials, DLT template, balance).                             |

For architecture, API endpoints and all settings, see [README.md](README.md).
