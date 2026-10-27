# GRE Vocab 3000

A static website for learning 3,000 GRE words: ten words a day, listening and pronunciation tools, unit quizzes, a weekly quiz, spaced review. No server, no build step. Your progress is saved in your own browser (localStorage) and never leaves it.

## Publish on GitHub Pages
1. On github.com, click **New repository**. Name it (for example `gre-vocab`). Public is required for free Pages.
2. Click **uploading an existing file**, drag in **everything inside this folder** (including the `data`, `js`, `css`, `fonts`, `icons` folders and the file `.nojekyll`), then **Commit changes**.
3. Open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, branch **main**, folder **/ (root)**, then **Save**.
4. After a minute your site is at `https://YOUR-NAME.github.io/gre-vocab/`.

Note: the repository is public, so the word list text is public too. Your progress is not.

## Using it
- **Today**: the next day to study, reviews that are due, quizzes waiting.
- **Days**: all 300 days. Go forwards or back any time. Tap "I finished day N" when done.
- **Unit quiz**: after every second day (20 words), same three parts as the book: 8 text completion, 6 sentence equivalence, 6 synonym match.
- **Weekly quiz**: every Friday (changeable in Settings), covering the days you finished from last Friday to Thursday. It stays open until the next Thursday.
- **Listen**: hands-free player, pronunciation lab (record yourself and compare), listening quizzes.
- **Review**: finished words return after 1, 3, 7, 14 and 30 days; missed words come back sooner.
- **Settings**: accent and voice, speeds, dark mode, text size, calendar reminders (.ics), backup and restore.

## Things to know
- Voices come from your device. Chrome, Edge and Safari have them; Natural/Enhanced voices sound best. Install them in your system speech settings.
- "Check what the computer hears" in the lab works in Chrome/Edge and sends audio to the browser vendor's speech service.
- Progress is per browser and per device. Use **Settings → Save a backup** now and then, and to move to another device.
- Install it (Add to Home Screen) to use it offline.
- When you change any file, bump `VERSION` in `sw.js` so visitors get the update.
- To preview a different date for testing, open the site with `?today=2026-10-30` on the end of the address.
