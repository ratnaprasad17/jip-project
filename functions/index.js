"use strict";

const { initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const {
    fetchSource,
    getDateInTimeZone,
    reconcileInternships
} = require("./internship-sync");
const sources = require("./sources.json");

initializeApp({
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
}

exports.syncInternshipsDaily = onSchedule({
    schedule: "15 3 * * *",
    timeZone: "Asia/Kolkata",
    region: "asia-south1",
    timeoutSeconds: 300,
    memory: "256MiB"
}, syncInternships);