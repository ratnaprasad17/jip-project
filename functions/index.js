"use strict";

const { cert, deleteApp, initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");
const {
    fetchSource,
    getDateInTimeZone,
    reconcileInternships
} = require("./internship-sync");
const {
    dispatchStudentEventAlerts,
    findApplicationStageChanges,
    findChangedInternships,
    findNewInternships,
    getApplicationStageSnapshot,
    getEmailAlertPreferences
} = require("./email-alerts");
const sources = require("./sources.json");

const DATABASE_URL = "https://internmatch--07-default-rtdb.firebaseio.com";

function loadServiceAccount(environment = process.env) {
    const serialized = environment.FIREBASE_SERVICE_ACCOUNT;
    if (!serialized) throw new Error("FIREBASE_SERVICE_ACCOUNT is not set.");

    let serviceAccount;
    try {
        serviceAccount = JSON.parse(serialized);
    } catch (error) {
        throw new Error("FIREBASE_SERVICE_ACCOUNT must contain valid service-account JSON.");
    }

    if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
        throw new Error("FIREBASE_SERVICE_ACCOUNT is missing project_id, client_email, or private_key.");
    }
    if (serviceAccount.project_id !== "internmatch--07") {
        throw new Error(`Service account belongs to ${serviceAccount.project_id}, expected internmatch--07.`);
    }
    return serviceAccount;
}

async function syncInternships(database = getDatabase()) {
    const results = await Promise.all(sources.map(async source => {
        try {
            const internships = await fetchSource(source);
            console.log(`Imported ${internships.length} internships from ${source.key}.`);
            return { sourceKey: source.key, status: "success", internships };
        } catch (error) {
            console.error(`Could not sync source ${source.key}: ${error.message}`);
            return { sourceKey: source.key, status: "error", internships: [] };
        }
    }));

    const today = getDateInTimeZone();
    const internshipsRef = database.ref("internships");
    let previousInternships = [];
    const transaction = await internshipsRef.transaction(current => {
        previousInternships = Array.isArray(current) ? current : [];
        if (current === null && !results.some(result =>
            result.status === "success" && result.internships.length > 0
        )) return undefined;
        return reconcileInternships(current, results, today);
    });

    if (!transaction.committed && transaction.snapshot.val() === null) {
        console.log("No catalog was available and no feed could publish listings; email alerts were not processed.");
        return;
    }
    if (!transaction.committed) console.log("The published internship catalog did not change in this run.");

    const currentInternships = Array.isArray(transaction.snapshot.val())
        ? transaction.snapshot.val()
        : previousInternships;
    const publishedCount = Array.isArray(currentInternships)
        ? currentInternships.length
        : 0;

    const metadataRef = database.ref("metadata");
    await metadataRef.update({
        configuredJobBoards: sources.length,
        lastSync: new Date().toISOString()
    });

    console.log(`Internship sync completed. Published catalog contains ${publishedCount} listings.`);

    const newInternships = findNewInternships(previousInternships, currentInternships);
    const changedInternships = findChangedInternships(previousInternships, currentInternships);
    const studentsData = (await database.ref("students").once("value")).val() || {};
    const applicationStagesRef = database.ref("metadata/emailAlertApplicationStages");
    const previousStagesSnapshot = await applicationStagesRef.once("value");
    const currentStages = getApplicationStageSnapshot(studentsData);
    const stageChanges = previousStagesSnapshot.exists()
        ? findApplicationStageChanges(previousStagesSnapshot.val(), currentStages, studentsData)
        : {};
    let dispatchReport = { stageAlertSentUids: [] };

    if (process.env.DISABLE_EMAIL_ALERTS !== "true") {
        try {
            dispatchReport = await dispatchStudentEventAlerts(database, {
                newInternships,
                changedInternships,
                applicationStageChanges: stageChanges
            }, { studentsData });
        } catch (emailError) {
            console.error(`Email alerts dispatch encountered an error: ${emailError.message}`);
        }
    }

    if (!previousStagesSnapshot.exists()) {
        await applicationStagesRef.set(currentStages);
    } else {
        const nextStages = JSON.parse(JSON.stringify(currentStages));
        const stageAlertSentUids = new Set(dispatchReport.stageAlertSentUids || []);
        for (const [uid, changes] of Object.entries(stageChanges)) {
            if (getEmailAlertPreferences(studentsData[uid]).applicationStageUpdates && !stageAlertSentUids.has(uid)) {
                nextStages[uid] = nextStages[uid] || {};
                for (const change of changes) {
                    if (change.previousStatus === "New application tracked") {
                        delete nextStages[uid][change.applicationId];
                    } else {
                        nextStages[uid][change.applicationId] = change.previousStatus;
                    }
                }
            }
        }
        await applicationStagesRef.set(nextStages);
    }
}

async function main() {
    const serviceAccount = loadServiceAccount();
    const app = initializeApp({
        credential: cert(serviceAccount),
        databaseURL: DATABASE_URL
    });
    try {
        await syncInternships();
    } finally {
        await deleteApp(app);
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error(`Internship sync failed: ${error.message}`);
        process.exitCode = 1;
    });
}

module.exports = { loadServiceAccount, syncInternships };