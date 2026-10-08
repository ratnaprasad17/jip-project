"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
    createMailTransporter,
    findNewInternships,
    findMatchingInternshipsForStudent,
    generateInternshipDigestHtml,
    dispatchInternshipEmailAlerts
} = require("../email-alerts");

test("findNewInternships excludes existing IDs and handles an empty previous catalog", () => {
    const previous = [{ id: "existing" }];
    const current = [{ id: "existing" }, { id: "new" }];

    assert.deepEqual(findNewInternships(previous, current), [{ id: "new" }]);
    assert.deepEqual(findNewInternships([], current), current);
    assert.deepEqual(findNewInternships(null, null), []);
});

test("findMatchingInternshipsForStudent accurately ranks branch and keyword matches", () => {
    const student = {
        name: "Ravi Kumar",
        email: "ravi@example.com",
        branch: "Computer Science",
        skills: "React, Node.js",
        preferredWorkMode: "Online"
    };

    const internships = [
        { id: 1, title: "Mechanical CAD Trainee", branch: "Mechanical Engineering", workType: "Offline" },
        { id: 2, title: "Full Stack Web Developer Intern", branch: "Computer Science", workType: "Online" },
        { id: 3, title: "Frontend React Intern", branch: "Computer Science", workType: "Online" },
        { id: 4, title: "Civil Site Engineer", branch: "Civil Engineering", workType: "Offline" }
    ];

    const matches = findMatchingInternshipsForStudent(student, internships, 2);
    assert.equal(matches.length, 2);
    assert.equal(matches[0].branch, "Computer Science");
    assert.equal(matches[1].branch, "Computer Science");
});

test("findMatchingInternshipsForStudent does not match missing branch and location tags", () => {
    const matches = findMatchingInternshipsForStudent(
        { branch: "Computer Science", preferredLocation: "Hyderabad" },
        [{ id: "unrelated", title: "Operations Assistant" }]
    );

    assert.deepEqual(matches, []);
});

test("generateInternshipDigestHtml produces a rich HTML template with links and branding", () => {
    const student = {
        name: "Pooja Reddy",
        rollNumber: "21A81A05B2",
        branch: "Artificial Intelligence"
    };

    const matches = [
        {
            title: "Machine Learning Research Intern",
            company: "Tech Mahindra",
            location: "Hyderabad",
            workType: "Online",
            stipend: "₹25,000 / month",
            link: "https://example.com/apply-1"
        }
    ];

    const html = generateInternshipDigestHtml({ student, matches });
    assert.ok(html.includes("Pooja Reddy"));
    assert.ok(html.includes("21A81A05B2"));
    assert.ok(html.includes("Machine Learning Research Intern"));
    assert.ok(html.includes("Tech Mahindra"));
    assert.ok(html.includes("https://example.com/apply-1"));
    assert.ok(html.includes("ATS Checker"));
    assert.ok(html.includes("Cover Letter"));
});

test("email digest escapes untrusted content and rejects unsafe application URLs", () => {
    const html = generateInternshipDigestHtml({
        student: { name: "<img src=x>", branch: "C&E" },
        matches: [{
            title: "<script>alert(1)</script>",
            company: "Example & Co",
            link: "javascript:alert(1)"
        }]
    });

    assert.ok(html.includes("&lt;img src=x&gt;"));
    assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
    assert.ok(html.includes("Example &amp; Co"));
    assert.ok(!html.includes('href="javascript:'));
});

test("email alerts require real SMTP configuration instead of reporting simulated sends", async () => {
    await assert.rejects(createMailTransporter({}), /SMTP_HOST, SMTP_USER, and SMTP_PASS/);
});

test("dispatchInternshipEmailAlerts sends only to opted-in students and logs delivery counts", async () => {
    let pushedLog = null;
    const deliveries = [];
    const fakeDatabase = {
        ref: (path) => {
            if (path === "students") {
                return {
                    once: async () => ({
                        val: () => ({
                            stu1: {
                                name: "Anil",
                                email: "anil@example.com",
                                branch: "Computer Science",
                                status: "approved",
                                emailAlertsEnabled: true
                            },
                            stu2: {
                                name: "Inactive Student",
                                email: "inactive@example.com",
                                status: "pending"
                            },
                            stu3: {
                                name: "Opted-out Student",
                                email: "opted-out@example.com",
                                branch: "Computer Science",
                                status: "approved",
                                emailAlertsEnabled: false
                            }
                        })
                    })
                };
            }
            if (path === "email_alerts_log") {
                return {
                    push: async (data) => {
                        pushedLog = data;
                        return { key: "log-1" };
                    }
                };
            }
            return {};
        }
    };

    const dummyJobs = [
        { title: "Software Intern", branch: "Computer Science", company: "Infosys", link: "https://infosys.com" }
    ];

    const report = await dispatchInternshipEmailAlerts(fakeDatabase, dummyJobs, {
        env: { SMTP_USER: "alerts@example.com" },
        transporter: {
            sendMail: async (mail) => {
                deliveries.push(mail);
                return { messageId: "test-message" };
            }
        }
    });

    assert.equal(report.status, "completed");
    assert.equal(report.totalStudents, 1);
    assert.equal(report.sentCount, 1);
    assert.equal(report.errorCount, 0);
    assert.equal(deliveries.length, 1);
    assert.ok(pushedLog);
    assert.equal(pushedLog.sentCount, 1);
});
