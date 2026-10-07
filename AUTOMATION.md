# Internship automation

InternMatch imports internships from public Greenhouse and Lever job boards. A GitHub Actions workflow runs the standalone Node.js importer and writes `/internships` to Firebase Realtime Database using the Firebase Admin SDK. No Firebase Cloud Function, Cloud Scheduler, Cloud Build, or Artifact Registry deployment is needed. The importer uses official public ATS endpoints and does not scrape LinkedIn, Indeed, or other portals that restrict automated collection.

## Add official sources

These official boards are configured in `functions/sources.json`:

```json
[
  {
    "key": "klaviyo-greenhouse",
    "provider": "greenhouse",
    "board": "klaviyocampus",
    "company": "Klaviyo"
  },
  {
    "key": "idme-greenhouse",
    "provider": "greenhouse",
    "board": "idmeuniversityrecruiting",
    "company": "ID.me"
  },
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

Only internship-titled posts with HTTPS application links on the provider's official ATS host or an explicitly approved company-owned jobs domain are imported. Posts older than 90 days or past their closing date are excluded. Newer posts disappear when a successful source refresh no longer returns them. A failed source request preserves recent posts from that source, but does not keep stale posts alive. If a feed does not explicitly state branch eligibility or work arrangement, the website shows "Not specified" rather than guessing. The current Spotify board returns no internship-titled postings, so it adds no listings until that changes. Jobs with unknown posted dates are included only while the official board continues to return them.

## Install and deploy

### Deploy only Realtime Database rules on Spark

Install/sign in to the Firebase CLI account for project `internmatch--07`. From the repository root, deploy only the rules:

```powershell
firebase use internmatch--07
firebase deploy --only database --project internmatch--07
```

This command targets only `database.rules.json`; it does not ask Firebase to deploy Functions and therefore avoids the Blaze-gated Cloud Build/Artifact Registry path. Realtime Database rules deployment itself is available on Spark. Check the CLI output to confirm the database rules release succeeds.

The browser rules remain important for student/admin access. The GitHub importer authenticates with the Admin SDK, which bypasses Realtime Database rules, so only the GitHub Actions secret controls who can run this privileged writer.

### Create the GitHub Actions credential

1. In Firebase Console, open project `internmatch--07`.
2. Open **Project settings** (gear icon) → **Service accounts** → **Firebase Admin SDK**.
3. Choose **Node.js**, then click **Generate new private key** and confirm. Store the downloaded JSON securely; do not commit it, paste it into chat, or add it to the website.
4. In GitHub, open this repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
5. Set the name to exactly `FIREBASE_SERVICE_ACCOUNT`; paste the full contents of the downloaded JSON into the secret value and save.
6. Restrict repository access to trusted maintainers. Anyone who can change this workflow or read/use this secret can write arbitrary data through the Admin SDK. Rotate/delete the key if it is exposed.

The workflow is `.github/workflows/sync.yml`. It uses Node 22 because that is the Functions package's existing supported engine, `npm ci` against the lockfile, and runs importer tests before syncing. The UTC cron `45 21 * * *` is **03:15 IST the following day**. GitHub scheduled runs can be delayed and run from the repository's default branch; use **Actions** → **Sync Internships** → **Run workflow** for an immediate test.

### Verify a run

1. Open GitHub repository → **Actions** → **Sync Internships**.
2. Start **Run workflow** for the first manual run and open its job log.
3. Confirm tests pass and each feed prints its import result; then confirm `Internship sync completed` appears.
4. In Firebase Console → **Realtime Database** → **Data**, inspect `/internships`.
5. Check the website with an approved student account. The catalog listener reads Firebase updates live.

If this project ever had a Firebase scheduled function deployed previously, disable/delete that old scheduled writer after verifying Actions sync works, so two jobs do not race to publish. The current repo no longer configures or deploys Firebase Functions.

## Providers and limitations

- Supported: official Greenhouse job boards and official Lever job boards.
- Not supported: general-purpose AI crawling, LinkedIn/Indeed scraping, or arbitrary pages without a permitted feed/API.
- Imported listing links are normalized HTTPS links from the official ATS; this confirms link format, not that an employer is still accepting applications.
- The chatbot answers from the listings and site guidance available in the page. It has no external LLM connection and declines questions that require unsupported information.
- Imported listings without a closing date are removed when they disappear from a successful source refresh or become older than 90 days; manual listings use the closing date entered by the admin.
- Sources are opt-in. Add only boards whose terms permit use and that are relevant to your students.