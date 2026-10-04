"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    getDateInTimeZone,
    getPostedDate,
    normalizeGreenhouseJobs,
    normalizeLeverPostings,
    reconcileInternships,
    stableInternshipId
} = require("../internship-sync");

const source = { key: "sample-company", company: "Sample Company" };

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