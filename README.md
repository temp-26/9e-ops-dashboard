# HR Workforce Intelligence — 9E Global

A web dashboard for the monthly Operations Board HR update, in the 9E brand. Every number, chart and
table is calculated from the Excel file **9E_Workforce_data.xlsx**. Nothing is typed in by hand.

The Excel is converted into `public/data.enc.json`, **encrypted with your password**
(the password lock itself is in `public/key.json`). The dashboard asks for the password,
unlocks the data in the browser and shows the numbers, so everyone with the password sees the
same figures in any browser. There's no upload button.

## Refresh data and Show salary

- **↻ Refresh data** (top right) loads the latest published data and redraws every figure,
  chart and table without reloading the page. Your tab, date and filters stay as they were.
  "Last refreshed" shows when it last loaded.
- **Salaries and costs are hidden as `******`** on every tab, in pop-up lists, chart labels and
  print-outs. Money charts are replaced by a grey "hidden" box.
- Switch on **Show salary** to see them. It switches itself off again whenever the page is
  opened or reloaded.

## Password

- Anyone opening the dashboard sees a 9E password screen first. Without the password the data
  can't be read, even by someone who downloads the website files or the GitHub repository.
- The first time you run `npm run update-data` it asks you to choose the password (twice).
  After that it asks for the same password each time. Use at least 10 characters; a short
  sentence works well, e.g. `Board-Review-Oct-2026!`.
- **To change the password (or if you forgot it):** run the update, type any other password,
  answer **Y** to "Do you want to CHANGE the password", then type the new one twice. Publish as
  usual. The old password stops working as soon as the site updates. Nothing is lost,
  because the data comes from your Excel.
- Once unlocked, the dashboard stays open in that browser tab until the tab is closed or
  **Lock** (top right) is clicked.
- Share the password only by a separate channel (e.g. Teams message), never in the same email
  as the link.

---

## One-time setup

You need two free programs on your computer:

1. **Node.js** (the "LTS" version) — https://nodejs.org → download → install with the default options.
2. **GitHub Desktop** — https://desktop.github.com → install → sign in with your GitHub account.

Then:

1. Unzip this project folder somewhere easy to find, e.g. `Documents\9e-ops-dashboard`.
2. Open the folder, click the address bar, type `cmd` and press **Enter**. A black window opens in that folder.
3. Type `npm install` and press **Enter**. Wait until it finishes (1–2 minutes). You only do this once.

## Put it on GitHub (first time only)

1. Open **GitHub Desktop** → **File → Add local repository** → choose the project folder → **Add repository**.
2. Click **Publish repository**.
   - The website itself is public to anyone who has the link on every GitHub plan except
     **GitHub Enterprise Cloud** (the only plan that can restrict a Pages site to signed-in staff).
     It contains names, departments and salaries, so agree this with your manager first.
   - Free plan: the repository must be **public** for Pages to work.
     Pro / Team: the repository can be private, but the website is still public.
3. On github.com, open the repository → **Settings → Pages** → under **Source** choose **GitHub Actions**.
4. Go to the **Actions** tab. Wait for "Deploy dashboard" to show a green tick (about 1 minute).
5. Your link is shown under **Settings → Pages**. It looks like `https://<your-username>.github.io/9e-ops-dashboard/`.

## Easiest way to update: double-click "Update Dashboard.bat"

1. Make sure your SharePoint Excel is synced to this PC (OneDrive), and **Save** it after editing.
2. Double-click **Update Dashboard.bat** in this folder.
3. First time only: drag the synced Excel file into the window and press Enter.
4. Type the dashboard password. It reads the Excel, encrypts it and publishes it.
5. About 2 minutes later the live dashboard has the new numbers. Anyone who already has it
   open just clicks **↻ Refresh data**.

(If "Git for Windows" isn't installed, it tells you to finish in GitHub Desktop: Commit to main, then Push origin.)

## Updating the numbers each month (manual way)

1. Save the new Excel file into the project's **`data`** folder.
   (Any file name ending in `.xlsx` works. If there are several, the newest one is used.)
2. Open the black command window in the project folder (address bar → `cmd` → Enter) and type:

   ```
   npm run update-data
   ```

   It lists each sheet it read, then asks for the **dashboard password** (the characters show
   as `*`). It ends with **Done**.
   If it shows a WARNING about formula cells, open the Excel, press **Save**, and run it again.
3. Optional — check it before publishing: type `npm run dev`, then open the link it shows
   (usually http://localhost:5173). Press **Ctrl + C** in the black window to stop.
4. Open **GitHub Desktop**. You'll see `public/data.enc.json` changed.
   Type a short summary (e.g. "October data") → **Commit to main** → **Push origin**.
5. In about a minute the live dashboard shows the new numbers.

The Excel file itself is never uploaded (it's excluded in `.gitignore`). Only the encrypted
`data.enc.json` goes to GitHub.

## What's in the data file

- Every sheet, every row and every column of the Excel, with values exactly as saved.
  Formulas are copied as their last calculated value.
- **Left out on purpose (privacy):** Passport No./Expiry, Visa No./Expiry, Emirates ID,
  Labour Card No./Expiry, phone number and Date of Birth. Age and Visa Type are kept.
  To change this, edit the `EXCLUDE_COLUMNS` list at the top of `scripts/update-data.mjs`.

## Rules the dashboard follows

- **The date is always today** (the date on the viewer's computer). It moves on by itself each
  day, even if the page is left open overnight. Pick an earlier date in the **As of date** box
  to look back; **Today** brings it back. The footer shows when the data was last updated.
- **INR rate and hours for hourly temps** come from a **Checks** sheet if the Excel has one
  ("INR per 1 AED", "Hours / month (hourly temps)"). Without it, the INR rate is worked out
  from India Details (offer-letter INR a year ÷ 12 ÷ monthly AED, currently 25.75), and hourly
  temps are costed at **160 hours a month**.
- **Temp staff cost** is read from "Monthly Cost (AED)" as typed: plain numbers are AED,
  "INR" (in the cost or the Comments column) is converted, "/hr" or "per hour" is × hours.
  An India temp with 50,000 or more and no currency written is treated as INR.
  Only rows with Status **Active** are counted. If a note says "Replacement of <name>",
  that person is not counted as well.
- **Active staff** = start date on or before the as-of date. "TBC" start dates are not counted.
- **Monthly charts** (headcount, salaries) are rebuilt from start dates and last working days.
  They run from January to the as-of date.
- **Salaries:** Dubai uses Total Current Salary before the reduction date, then "Effective Salary Jun-26".
  India uses "Total Monthly Salary in AED" (incl. 35% Access), with a switch to salary only.
- Nothing after the chosen date is shown. On today's date, the Excel lists are taken as they
  are; for an earlier date, leavers count as staff until their last working day.
- **Average new joiners a month** = permanent staff who started between 1 January and the as-of date,
  divided by the number of months covered.

Keep the sheet names and column headings the same (capitals don't matter) when you prepare a new Excel.
Adding rows is fine. If a heading is renamed, the matching figure will show 0 or "—".

## Project layout

| Path | What it is |
|---|---|
| `data/` | Drop the Excel here (not uploaded to GitHub) |
| `scripts/update-data.mjs` | Excel → encrypted `public/data.enc.json` converter |
| `public/data.enc.json` | The encrypted data the dashboard unlocks |
| `public/key.json` | The password lock for that data |
| `src/Gate.jsx` | The password screen, Refresh and Show salary |
| `src/lib/auth.jsx` | Salary masking (`******`) |
| `src/lib/model.js` | All calculations |
| `src/sections/` | One file per dashboard tab |
| `.github/workflows/deploy.yml` | Publishes to GitHub Pages on every push |
