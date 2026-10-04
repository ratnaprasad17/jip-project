"use strict";

const { initializeApp } = require("firebase-admin/app");
const { cert } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");
const {
    fetchSource,
    getDateInTimeZone,
    reconcileInternships
} = require("./internship-sync");
const sources = require("./sources.json");

// Load the service account key from an environment variable
// (GitHub Actions will provide this securely — see workflow file)
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

initializeApp({
    credential: cert(serviceAccount),
    databaseURL: "https://internmatch--07-default-rtdb.firebaseio.com"
});

async function syncInternships() {
    const results = await Promise.all(sources.map(async source => {
        try {
            const internships = await fetchSource(source);
            console.log(`Imported ${internships.length} internships from ${source.key}.`);
            return { sourceKey: source.key, status: "success", internships };
        } catch (error) {
            console.error(`Could not sync source ${source.key}.`, error);
            return { sourceKey: source.key, status: "error", internships: [] };
        }
    }));

    const today = getDateInTimeZone();
    const internshipsRef = getDatabase().ref("internships");
    const transaction = await internshipsRef.transaction(current => {
        if (current === null && !results.some(result =>
            result.status === "success" && result.internships.length > 0
        )) return undefined;
        return reconcileInternships(current, results, today);
    });

    console.log(`Internship sync complete. Database updated: ${transaction.committed}.`);
    process.exit(0); // important: tells GitHub Actions the script finished
}

syncInternships().catch(error => {
    console.error("Sync failed:", error);
    process.exit(1);
});