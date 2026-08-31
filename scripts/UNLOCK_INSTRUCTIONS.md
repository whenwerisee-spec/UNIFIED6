Step-by-step: make wallets spendable in SQLite DB and verify

1) Apply the SQL patch to your local SQLite DB

If you have the `sqlite3` CLI installed, run (from the project root):

```powershell
sqlite3 sovereigns_interbank_vault.db < scripts/unlock_wallets.sql
```

If you don't have `sqlite3` installed, you can install the SQLite command-line tools for Windows from https://www.sqlite.org/download.html or run the SQL via a small Python snippet (requires Python + sqlite3 module):

```powershell
python - <<'PY'
import sqlite3
db = 'sovereigns_interbank_vault.db'
conn = sqlite3.connect(db)
cur = conn.cursor()
cur.executescript(open('scripts/unlock_wallets.sql').read())
conn.commit()
conn.close()
print('Applied unlock SQL')
PY
```

2) Verify balances using the existing Node script

Install dependencies (if needed) and run the script that queries the DB:

```powershell
npm install
node scripts/get-user-assets.cjs
```

If `npm install` fails due to dependency errors, you can run a Python check instead. Create and run `scripts/list_assets.py` (already present) with Python:

```powershell
python scripts/list_assets.py
```

3) If you want me to run these steps here, I need either `sqlite3` CLI or Python available in the environment, or permission to install Node dependencies. I couldn't run them earlier because those tools were missing or `npm install` failed.
