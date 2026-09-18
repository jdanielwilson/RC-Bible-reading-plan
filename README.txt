RESTORATION CHURCH 360-DAY BIBLE READING PLAN APP

WHAT THIS DOES
- Lists all 360 reading days.
- Shows each day's KJV Scripture inside the app.
- Saves each person's completed-day checkmarks on that phone/browser.
- Shows progress and the next unread day.
- Can be added to an iPhone or Android home screen like an app.
- There is intentionally NO "clear all progress" button.

SCRIPTURE SOURCE
The app requests KJV chapter text from the free Midvash Bible API:
https://api.midvash.com/
The KJV is a public-domain translation in the United States.
An internet connection is needed the first time a chapter is opened.
The service worker caches successfully loaded chapters for later reuse.

HOW TO TEST LOCALLY
A PWA/service worker should be served from a web server, not opened by double-clicking index.html.
If you have Python installed:
1. Put these files in one folder.
2. Open Terminal/Command Prompt in that folder.
3. Run: python -m http.server 8000
4. Visit: http://localhost:8000

HOW TO PUT IT ONLINE FREE
Option A — GitHub Pages
1. Create a free GitHub account.
2. Create a new PUBLIC repository, for example: restoration-bible-plan
3. Upload every file from this folder to the repository root.
4. In the repository, open Settings > Pages.
5. Under Build and deployment, choose "Deploy from a branch."
6. Choose branch "main" and folder "/ (root)", then Save.
7. GitHub will give you a public https://...github.io/... address.
8. Put that address in your ChurchTrac Connect card.

Option B — Netlify
1. Create a free Netlify account.
2. Create a new site and deploy this folder.
3. Netlify will give you an HTTPS web address.
4. Put that address in ChurchTrac.

HOW MEMBERS ADD IT TO THEIR PHONE
iPhone:
- Open the public HTTPS link in Safari.
- Tap Share.
- Tap Add to Home Screen.
- Tap Add.

Android:
- Open the public HTTPS link in Chrome.
- Open the Chrome menu.
- Choose Install app or Add to Home screen.

IMPORTANT ABOUT PROGRESS
Progress is stored locally in that browser/device. It does not currently sync between devices.
If a person clears their browser/site data, their completed checkmarks can be lost.

FILES
index.html             Main app page
styles.css             Visual styling
app.js                 App behavior, saved progress, Bible API loading
plan.js                The 360-day reading schedule
manifest.webmanifest   Makes the site installable as a PWA
sw.js                  Offline/cache support
icon-192.png           App icon
icon-512.png           App icon


VERSION 2 FIX
- Fixed Scripture rendering so the actual KJV verse text appears, not just verse numbers.
- Uses the documented jsubroto KJV chapter JSON source with verses[].text.
- Keeps the same browser storage key, so existing checkmarks/progress are preserved.
- Service-worker cache bumped to v2.

IF YOU ALREADY DEPLOYED VERSION 1
Replace the files in your hosted site with this version.
Then refresh the site twice (or fully close and reopen it) so the updated service worker takes control.
Your existing checkmarks should remain because the saved-progress key did not change.


VERSION 3 DISPLAY UPDATE
- Scripture verse text is now 18 pt.
- Every verse appears on its own separate line instead of paragraph form.
- Cache version bumped to v3 so the visual update replaces older cached files.
