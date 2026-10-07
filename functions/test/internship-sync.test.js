"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { loadServiceAccount } = require("../index");
const sources = require("../sources.json");
const {
    getDateInTimeZone,
    getPostedDate,
    normalizeAshbyPostings,
    normalizeGreenhouseJobs,
    normalizeLeverPostings,
    reconcileInternships,
    stableInternshipId
} = require("../internship-sync");

const source = { key: "sample-company", company: "Sample Company" };

test("configured internship feeds have unique keys and complete source metadata", () => {
    assert.equal(new Set(sources.map(item => item.key)).size, sources.length);
    assert.ok(sources.every(item => item.key && item.company && item.board && ["greenhouse", "lever", "ashby"].includes(item.provider)));
    assert.equal(sources.length, 26);
});

test("service account validation fails clearly for missing or invalid secrets", () => {
    assert.throws(() => loadServiceAccount({}), /FIREBASE_SERVICE_ACCOUNT is not set/);
    assert.throws(() => loadServiceAccount({ FIREBASE_SERVICE_ACCOUNT: "{" }), /valid service-account JSON/);
    assert.throws(() => loadServiceAccount({
        FIREBASE_SERVICE_ACCOUNT: JSON.stringify({ project_id: "internmatch--07" })
    }), /missing project_id, client_email, or private_key/);
    assert.throws(() => loadServiceAccount({
        FIREBASE_SERVICE_ACCOUNT: JSON.stringify({
            project_id: "another-project",
            client_email: "runner@example.iam.gserviceaccount.com",
            private_key: "not-a-real-key"
        })
    }), /expected internmatch--07/);
});

test("Greenhouse import keeps internship listings and normalizes fields", () => {
    const listings = normalizeGreenhouseJobs(source, [
        {
            id: 14,
            title: "Software Engineering Intern",
            content: "Build services with Python and SQL.",
            updated_at: "2026-09-30T12:00:00Z",
            location: { name: "Remote" },
            absolute_url: "https://boards.greenhouse.io/sample/jobs/14"
        },
        {
            id: 15,
            title: "Senior Software Engineer",
            content: "Full-time role.",
            location: { name: "Remote" },
            absolute_url: "https://boards.greenhouse.io/sample/jobs/15"
        }
    ]);

    assert.equal(listings.length, 1);
    assert.equal(listings[0].company, "Sample Company");
    assert.equal(listings[0].type, "Online");
    assert.equal(listings[0].branch, "Not specified");
    assert.deepEqual(listings[0].skills, ["Python", "SQL"]);
    assert.equal(listings[0]._sourceId, "14");
    assert.equal(listings[0].postedDate, "2026-09-30");
});

test("Lever import ignores insecure application URLs", () => {
    const listings = normalizeLeverPostings(source, [{
        id: "abc",
        text: "Design Intern",
        descriptionPlain: "Work with Figma.",
        categories: { location: "New York" },
        hostedUrl: "http://jobs.example.com/abc"
    }]);

    assert.equal(listings.length, 0);
});

test("imports accept official ATS URLs and reject unrelated HTTPS hosts", () => {
    const greenhouse = normalizeGreenhouseJobs(source, [
        {
            id: 18,
            title: "Engineering Intern",
            location: { name: "Remote" },
            absolute_url: "https://evil.example/apply/18"
        },
        {
            id: 19,
            title: "Engineering Intern",
            location: { name: "Remote" },
            absolute_url: "https://boards.greenhouse.io/sample/jobs/19"
        },
        {
            id: 20,
            title: "Data Intern",
            location: { name: "Remote" },
            absolute_url: "https://stripe.com/jobs/search?gh_jid=20"
        }
    ]);
    const lever = normalizeLeverPostings(source, [
        {
            id: "bad",
            text: "Product Intern",
            categories: { location: "Remote" },
            hostedUrl: "https://jobs.example.com/bad"
        },
        {
            id: "good",
            text: "Product Intern",
            categories: { location: "Remote" },
            hostedUrl: "https://jobs.lever.co/sample/good"
        }
    ]);

    assert.deepEqual(greenhouse.map(listing => listing._sourceId), ["19", "20"]);
    assert.deepEqual(lever.map(listing => listing._sourceId), ["good"]);
});

test("Greenhouse feeds may allow their exact employer-owned application host", () => {
    const listings = normalizeGreenhouseJobs({
        ...source,
        applicationHosts: ["www.coinbase.com"]
    }, [
        {
            id: 22,
            title: "Analytics Intern",
            location: { name: "Remote" },
            absolute_url: "https://www.coinbase.com/careers/positions/22?gh_jid=22"
        },
        {
            id: 23,
            title: "Engineering Intern",
            location: { name: "Remote" },
            absolute_url: "https://evil.example/jobs/23"
        }
    ]);

    assert.deepEqual(listings.map(listing => listing._sourceId), ["22"]);
});

test("Groww source permits its official Greenhouse application host only", () => {
    const groww = sources.find(source => source.key === "groww-greenhouse");
    const listings = normalizeGreenhouseJobs(groww, [
        {
            id: 24,
            title: "Video Editor Intern",
            location: { name: "Bengaluru-VTP, India" },
            absolute_url: "https://job-boards.eu.greenhouse.io/groww/jobs/24"
        },
        {
            id: 25,
            title: "Engineering Intern",
            location: { name: "Bengaluru, India" },
            absolute_url: "https://untrusted.example/jobs/25"
        }
    ]);

    assert.deepEqual(listings.map(listing => listing._sourceId), ["24"]);
    assert.match(listings[0].location, /India/);
});

test("sync preserves manual posts and keeps failed-source posts", () => {
    const manual = { id: 1, title: "Manual listing" };
    const previousImport = { id: 2, title: "Keep this during an outage", _sourceKey: "board-a" };
    const refreshedImport = { id: 3, title: "Latest post", _sourceKey: "board-b" };
    const merged = reconcileInternships([manual, previousImport, { id: 4, title: "Expired", closingDate: "2026-09-30" }], [
        { sourceKey: "board-a", status: "error", internships: [] },
        { sourceKey: "board-b", status: "success", internships: [refreshedImport] }
    ], "2026-10-01");

    assert.deepEqual(merged, [manual, previousImport, refreshedImport]);
});

test("successful source refresh removes listings no longer present", () => {
    const previousImport = { id: 2, title: "Removed upstream", _sourceKey: "board-a" };
    const merged = reconcileInternships([previousImport], [
        { sourceKey: "board-a", status: "success", internships: [] }
    ], "2026-10-01");

    assert.deepEqual(merged, []);
});

test("reconciliation removes stale imports and legacy sample listings", () => {
    const merged = reconcileInternships([
        { id: 1, title: "Machine Learning Intern", company: "TechNova AI" },
        { id: 2, title: "Data Science Intern", company: "DataWorks" },
        { id: 7, title: "Old internship", _sourceKey: "board-a", postedDate: "2026-04-01" },
        { id: 8, title: "Recent internship", _sourceKey: "board-a", postedDate: "2026-09-01" }
    ], [{ sourceKey: "board-a", status: "error", internships: [] }], "2026-10-06");

    assert.deepEqual(merged.map(internship => internship.id), [8]);
});

test("stable IDs are repeatable and date uses the configured timezone", () => {
    assert.equal(stableInternshipId("board", "123"), stableInternshipId("board", "123"));
    assert.equal(getDateInTimeZone(new Date("2026-10-01T00:00:00.000Z")), "2026-10-01");
});

test("title filter excludes non-intern trainee roles", () => {
    const listings = normalizeGreenhouseJobs(source, [{
        id: 16,
        title: "Software Engineering Trainee",
        content: "A training role.",
        location: { name: "Remote" },
        absolute_url: "https://boards.greenhouse.io/sample/jobs/16"
    }]);

    assert.equal(listings.length, 0);
});

test("Lever createdAt becomes the posted date", () => {
    const listings = normalizeLeverPostings(source, [{
        id: "abc",
        text: "Design Intern",
        descriptionPlain: "Work with Figma.",
        createdAt: 1790726400000,
        categories: { location: "New York" },
        hostedUrl: "https://jobs.lever.co/sample/abc"
    }]);

    assert.equal(listings[0].postedDate, "2026-09-30");
});

test("Ashby internships normalize dates, remote status, and official apply links", () => {
    const listings = normalizeAshbyPostings(source, [
        {
            id: "ashby-123",
            title: "Software Engineer Intern",
            employmentType: "Intern",
            location: "San Francisco",
            isRemote: true,
            publishedAt: "2026-09-30T12:00:00Z",
            applyUrl: "https://jobs.ashbyhq.com/sample/ashby-123/application",
            descriptionHtml: "<h1>What You'll Do</h1><p>Build software with TypeScript.</p>"
        },
        {
            id: "ashby-untrusted",
            title: "Design Intern",
            location: "Remote",
            applyUrl: "https://evil.example/apply"
        },
        {
            id: "not-an-internship",
            title: "International Account Manager",
            location: "New York",
            applyUrl: "https://jobs.ashbyhq.com/sample/other/application"
        }
    ]);

    assert.equal(listings.length, 1);
    assert.equal(listings[0].type, "Online");
    assert.equal(listings[0].postedDate, "2026-09-30");
    assert.equal(listings[0].link, "https://jobs.ashbyhq.com/sample/ashby-123/application");
    assert.match(listings[0].description, /Build software/);
});

test("unknown work arrangements are not mislabeled as offline", () => {
    const listings = normalizeGreenhouseJobs(source, [{
        id: 17,
        title: "Product Intern",
        content: "Collaborate with the product team. The interview includes an in-person office visit.",
        location: { name: "New York, NY" },
        absolute_url: "https://boards.greenhouse.io/sample/jobs/17"
    }]);

    assert.equal(listings[0].type, "Not specified");
});

test("escaped job descriptions omit generic company boilerplate and decode HTML", () => {
    const listings = normalizeGreenhouseJobs(source, [{
        id: 21,
        title: "Software Engineer Intern",
        content: "&lt;h2&gt;Who we are&lt;/h2&gt;&lt;p&gt;About Sample Company&lt;/p&gt;&lt;h2&gt;What you’ll do&lt;/h2&gt;&lt;p&gt;Build services for customers.&lt;/p&gt;&lt;h2&gt;Minimum requirements&lt;/h2&gt;&lt;p&gt;Know Python &amp;amp; SQL.&lt;/p&gt;",
        location: { name: "Bengaluru" },
        absolute_url: "https://boards.greenhouse.io/sample/jobs/21"
    }]);

    assert.match(listings[0].description, /Build services for customers/);
    assert.match(listings[0].description, /Python & SQL/);
    assert.doesNotMatch(listings[0].description, /Who we are|About Sample Company|&lt;h2/);
    assert.equal(listings[0].type, "Not specified");
});