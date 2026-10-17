# Expense Ledger

A browser-only cash ledger prototype with sample accounting categories, income and expense totals, a calculated cash-on-hand balance, and optional receipt attachments.

## Run locally

Serve the files over HTTP so the page can fetch `events.json`. For example, from this directory run:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Sample data and storage

Edit `events.json` to change the currency, opening cash balance, account categories, or initial sample transactions. The sample records are loaded into this browser's IndexedDB the first time the page opens. New entries and attached images or PDFs (up to 5 MB) are saved in the same browser profile.

This is not a private or production ledger: it has no authentication, access controls, shared storage, or backup. Staff names are labels only. Do not enter real financial, receipt, or personal data.
