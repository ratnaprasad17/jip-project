# Internship automation

InternMatch imports internship listings once a day from public Greenhouse and Lever job boards. The scheduled Firebase Function uses each company's public ATS job-board endpoint; it does not scrape LinkedIn, Indeed, or other portals that restrict automated collection. Firebase Realtime Database is used because the existing website already reads its internship list from Realtime Database, making it the simplest option for this project.

## Add official sources

The three sources you provided are already configured in `functions/sources.json`:

```json
[
  {
    "key": "stripe-greenhouse",
    "provider": "greenhouse",
    "board": "stripe",
    "company": "Stripe"
  },
  {
    "key": "spotify-lever",
    "provider": "lever",
    "board": "spotify",
    "company": "Spotify"
  },
  {
    "key": "palantir-lever",
    "provider": "lever",
    "board": "palantir",
    "company": "Palantir"
  }
]
```

For another source, copy the company board name from its official Greenhouse or Lever jobs URL and add another object. `key` must be unique and contain only letters, numbers, hyphens, or underscores. The importer includes titles containing "intern" or "internship" and saves the posted date, company, location, and original application link. It keeps each source's listings separate from manual posts.

An imported post is removed when the source stops returning it or when the source provides a closing date that has passed. A failed source request does not remove that source's previous posts. Many boards do not publish closing dates, so removal from the official board is the expiry signal for those listings. If a provider does not return a posted date for a job, that field is omitted.

## Install and deploy

Install Node.js 22 or newer and the Firebase CLI, then sign in to the Firebase account that owns project `internmatch--07`. From the project root run:

```powershell
cd functions
npm install
npm test
cd ..
firebase deploy --only functions
```

Firebase scheduled functions require the Blaze billing plan so Firebase can provision Cloud Scheduler. The importer runs daily at 03:15 India time. After deploying, check the `syncInternshipsDaily` function logs in Firebase Console. If the project is not on Blaze, the existing app's client-side closing-date cleanup still works when the site is opened, but background imports will not run.

## Providers and limitations

- Supported: official Greenhouse job boards and official Lever job boards.
- Not supported: general-purpose AI crawling, LinkedIn/Indeed scraping, or arbitrary pages without a permitted feed/API.
- Imported listings without a closing date are removed when they disappear from a successful source refresh; manual listings still use the closing date entered by the admin.
- Sources are opt-in. Add only boards whose terms permit use and that are relevant to your students.