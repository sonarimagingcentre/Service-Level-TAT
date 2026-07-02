# Sonar Imaging Centre — Operator TAT Dashboard

Interactive dashboard of operator turnaround-time (TAT) performance across
Ultrasound, X-Ray, CT and MRI, for January–June 2026.

## Files

```
index.html        # page shell, layout, and styling (uses Sonar brand colors)
app.js            # dashboard logic (filtering, charts, table, sorting)
data.js           # pre-aggregated data (operator x modality x month), read-only
assets/
  sonar_logo.png  # company logo
```

## Run it locally in VS Code

1. Open this folder in VS Code (`File → Open Folder...`).
2. Install the **Live Server** extension (if you don't have it): Extensions
   panel → search "Live Server" → Install.
3. Right-click `index.html` → **Open with Live Server**.

That's it — no build step, no npm install. It's plain HTML/CSS/JS plus
Chart.js loaded from a CDN.

You can also just double-click `index.html` to open it straight in a browser,
but some browsers block local `fetch`/module loading — Live Server avoids
that entirely, so it's the safer option while editing.

## Publish it (GitHub Pages)

1. Push this folder to a GitHub repo (keep the `assets/` folder and all three
   code files together, same structure as above).
2. Repo → **Settings → Pages** → Source → select your branch and `/ (root)` →
   **Save**.
3. GitHub gives you a live URL like
   `https://<your-username>.github.io/<repo-name>/` — share that with
   management. It updates automatically whenever you push changes.

If the data is sensitive, use a private repo with GitHub Pages (requires
GitHub Team/Enterprise for private Pages) rather than a public repo.

## Updating the data

`data.js` is generated from the two TAT export spreadsheets. To refresh it
with a new export, the data needs to be re-aggregated the same way (grouped
by operator, modality, and month, with completed-token TAT stats and
all-tokens status counts) — send me the new files and I'll regenerate
`data.js` for you; the rest of the dashboard doesn't need to change.

## Notes on the numbers

- TAT figures are the **imaging service leg only** (wait + service time
  within that modality) — not the full patient journey through billing and
  dispatch.
- **Pending** = Noshow + Pending + Standby + Serving + E.Complete (every
  assigned token that isn't a full Complete).
- Operators with fewer than 5 completed tokens in the selected period are
  left out of the bar chart so their averages don't skew the read.
- Median TAT across a multi-month selection is a volume-weighted
  approximation of monthly medians; the TAT distribution chart uses exact
  per-token counts.
