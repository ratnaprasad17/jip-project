"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
    createMailTransporter,
    findNewInternships,
    findChangedInternships,
    getApplicationStageSnapshot,
    findApplicationStageChanges,
    findMatchingInternshipsForStudent,
    generateInternshipDigestHtml,
    dispatchInternshipEmailAlerts,
    dispatchStudentEventAlerts
} = require("../email-alerts");

test("findNewInternships excludes existing IDs and handles an empty previous catalog", () => {
    const previous = [{ id: "existing" }];
    const current = [{ id: "existing" }, { id: "new" }];

    assert.deepEqual(findNewInternships(previous, current), [{ id: "new" }]);
    assert.deepEqual(findNewInternships([], current), current);
    assert.deepEqual(findNewInternships(null, null), []);
});

test("findChangedInternships detects saved-role field changes and removals", () => {
    const previous = [
        { id: "saved", title: "Software Intern", company: "Acme", stipend: "$1,000" },
        { id: "closed", title: "Design Intern", company: "Studio" }
    ];
    const current = [
        { id: "saved", title: "Software Intern", company: "Acme", stipend: "$1,500" }
    ];

    assert.deepEqual(findChangedInternships(previous, current), [
        {
            id: "saved",
            title: "Software Intern",
            company: "Acme",
            stipend: "$1,500",
            changedFields: ["stipend"],
            updateType: "updated"
        },
        {
            id: "closed",
            title: "Design Intern",
            company: "Studio",
            changedFields: ["no longer listed in the latest employer feed"],
            updateType: "removed"
        }
    ]);
});

test("application stage snapshots identify only changed tracker stages", () => {
    const previous = { student: { app1: "Applied" } };
    const students = {
        student: {
            applications: [
                { id: "app1", title: "Engineer Intern", company: "Acme", status: "Interviewing" },
                { id: "app2", title: "Product Intern", company: "Beta", status: "In Progress" },
                { id: "app3", title: "Design Intern", company: "Studio", status: "Saved" }
            ]
        }
    };
    const current = getApplicationStageSnapshot(students);
    const changes = findApplicationStageChanges(previous, current, students);

    assert.deepEqual(changes.student, [{
        applicationId: "app1",
        title: "Engineer Intern",
        company: "Acme",
        previousStatus: "Applied",
        newStatus: "Interviewing",
        link: ""
    }]);
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

test("dispatchInternshipEmailAlerts sends only to opted-in students and logs delivery counts", async (t) => {
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

    await t.test("event alerts include only opted-in new, saved, and application-stage updates", async () => {
        const deliveries = [];
        const student = {
            name: "Anil",
            email: "anil@example.com",
            status: "approved",
            savedInternshipIds: ["saved-role"],
            emailAlertPreferences: {
                newInternships: true,
                savedInternshipUpdates: true,
                applicationStageUpdates: true
            }
        };
        const database = {
            ref: path => path === "email_alerts_log"
                ? { push: async () => ({ key: "log" }) }
                : {}
        };
        const result = await dispatchStudentEventAlerts(database, {
            newInternships: [{ id: "new-role", title: "Data Intern", company: "NewCo", link: "https://example.com/jobs/new" }],
            changedInternships: [{ id: "saved-role", title: "Software Intern", company: "Acme", changedFields: ["stipend"], updateType: "updated" }],
            applicationStageChanges: {
                student: [{ applicationId: "app-1", title: "Design Intern", company: "Studio", previousStatus: "Applied", newStatus: "Interviewing" }]
            }
        }, {
            env: { SMTP_USER: "alerts@example.com" },
            studentsData: { student },
            transporter: { sendMail: async mail => { deliveries.push(mail); return { messageId: "sent" }; } }
        });

        assert.equal(result.sentCount, 1);
        assert.deepEqual(result.stageAlertSentUids, ["student"]);
        assert.match(deliveries[0].html, /New internships added/);
        assert.match(deliveries[0].html, /Updates to internships you saved/);
        assert.match(deliveries[0].html, /Application tracker stage changes/);
        assert.match(deliveries[0].html, /Interviewing/);
    });

    await t.test("event alerts do not send categories the student did not select", async () => {
        let sends = 0;
        const result = await dispatchStudentEventAlerts({}, {
            newInternships: [{ id: "new-role", title: "Data Intern" }],
            changedInternships: [{ id: "saved-role", title: "Software Intern" }],
            applicationStageChanges: {
                student: [{ applicationId: "app-1", title: "Design Intern", previousStatus: "Applied", newStatus: "Offer" }]
            }
        }, {
            studentsData: {
                student: {
                    email: "anil@example.com",
                    status: "approved",
                    emailAlertsEnabled: true,
                    emailAlertPreferences: {
                        newInternships: false,
                        savedInternshipUpdates: false,
                        applicationStageUpdates: false
                    }
                }
            },
            transporter: { sendMail: async () => { sends++; } }
        });

        assert.equal(sends, 0);
        assert.equal(result.sentCount, 0);
        assert.equal(result.errorCount, 0);
    });

    assert.equal(report.status, "completed");
    assert.equal(report.totalStudents, 1);
    assert.equal(report.sentCount, 1);
    assert.equal(report.errorCount, 0);
    assert.equal(deliveries.length, 1);
    assert.ok(pushedLog);
    assert.equal(pushedLog.sentCount, 1);
});
