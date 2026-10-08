"use strict";

const nodemailer = require("nodemailer");

/**
 * Creates and configures the Nodemailer transporter.
 * Uses the configured SMTP account for real email delivery.
 */
async function createMailTransporter(env = process.env) {
    if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
        throw new Error("Email alerts require SMTP_HOST, SMTP_USER, and SMTP_PASS.");
    }

    const port = Number(env.SMTP_PORT) || 587;
    return nodemailer.createTransport({
        host: env.SMTP_HOST,
        port,
        secure: port === 465,
        auth: {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS
        }
    });
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function getSafeHttpsUrl(value, fallback) {
    try {
        const url = new URL(value);
        return url.protocol === "https:" ? url.href : fallback;
    } catch {
        return fallback;
    }
}

function findNewInternships(previousInternships, currentInternships) {
    const existingIds = new Set((Array.isArray(previousInternships) ? previousInternships : [])
        .map(item => String(item.id || `${item._sourceKey || ""}:${item._sourceId || ""}`)));
    return (Array.isArray(currentInternships) ? currentInternships : [])
        .filter(item => !existingIds.has(String(item.id || `${item._sourceKey || ""}:${item._sourceId || ""}`)));
}

/**
 * Normalizes string for fuzzy keyword comparison.
 */
function normalizeText(text) {
    return String(text || "").toLowerCase().trim();
}

/**
 * Scores and filters internships based on student's branch, skills, and preferences.
 */
function findMatchingInternshipsForStudent(student, internships, limit = 5) {
    if (!Array.isArray(internships) || internships.length === 0) return [];

    const studentBranch = normalizeText(student.branch || "");
    const studentLocation = normalizeText(student.preferredLocation || student.location || "");
    const studentMode = normalizeText(student.preferredWorkMode || student.workMode || student.type || "");
    const rawSkills = student.skills || "";
    const studentSkills = (Array.isArray(rawSkills) ? rawSkills : rawSkills.split(","))
        .map(s => normalizeText(s))
        .filter(Boolean);

    // Branch keywords map
    const branchKeywords = {
        "computer science": ["software", "developer", "frontend", "backend", "full stack", "web", "python", "java", "react", "c++", "engineering"],
        "artificial intelligence": ["ai", "machine learning", "deep learning", "nlp", "computer vision", "data science", "python", "pytorch"],
        "information technology": ["it", "cloud", "devops", "software", "network", "system", "database", "security"],
        "electronics": ["embedded", "vlsi", "iot", "hardware", "circuit", "signal", "electronics", "robotics"],
        "electrical": ["electrical", "power", "grid", "circuits", "control", "solar", "drives"],
        "mechanical": ["mechanical", "cad", "solidworks", "design", "manufacturing", "automotive", "thermal"],
        "civil": ["civil", "structural", "autocad", "construction", "surveying", "geotechnical"],
        "business": ["business", "marketing", "analyst", "product", "finance", "hr", "operations", "sales"]
    };

    // Find relevant keywords for student's branch
    let relevantKeywords = [];
    for (const [branchKey, keywords] of Object.entries(branchKeywords)) {
        if (studentBranch && (studentBranch.includes(branchKey) || branchKey.includes(studentBranch))) {
            relevantKeywords = relevantKeywords.concat(keywords);
        }
    }
    relevantKeywords = relevantKeywords.concat(studentSkills);

    const scored = internships.map(item => {
        let score = 0;
        const title = normalizeText(item.title || item.role || "");
        const description = normalizeText(item.description || item.about || "");
        const branchTag = normalizeText(item.branch || item.category || "");
        const mode = normalizeText(item.workType || item.type || item.mode || "");
        const location = normalizeText(item.location || "");

        // Branch match
        if (studentBranch && branchTag && (branchTag.includes(studentBranch) || studentBranch.includes(branchTag))) {
            score += 40;
        }

        // Mode match
        if (studentMode && studentMode !== "any" && mode.includes(studentMode)) {
            score += 20;
        }

        // Location match
        if (studentLocation && location && (location.includes(studentLocation) || studentLocation.includes(location))) {
            score += 15;
        }

        // Keyword matches in title
        for (const kw of relevantKeywords) {
            if (title.includes(kw)) score += 15;
            else if (description.includes(kw)) score += 5;
        }

        // Recency boost (newly posted items)
        const postedDateValue = item.date || item.postedDate;
        if (postedDateValue) {
            const age = Date.now() - new Date(postedDateValue).getTime();
            if (Number.isFinite(age) && age >= 0 && age < 7 * 24 * 60 * 60 * 1000) {
                score += 10;
            }
        }

        return { item, score };
    });

    // Sort descending by match score
    scored.sort((a, b) => b.score - a.score);

    // Do not send unrelated opportunities when no positive match exists.
    return scored.filter(s => s.score > 0).slice(0, limit).map(s => s.item);
}

/**
 * Builds a modern, responsive HTML email digest template.
 */
function generateInternshipDigestHtml({ student, matches, portalUrl = "https://internmatch--07.web.app" }) {
    const safePortalUrl = escapeHtml(getSafeHttpsUrl(portalUrl, "https://ratnaprasad17.github.io/jip-project/"));
    const studentName = escapeHtml(student.name || "Student");
    const studentRoll = student.rollNumber ? ` (${escapeHtml(student.rollNumber)})` : "";
    const studentBranch = escapeHtml(student.branch || "Engineering & Technology");

    const jobCardsHtml = matches.map((job, index) => {
        const title = escapeHtml(job.title || job.role || "Internship Role");
        const company = escapeHtml(job.company || "Leading Employer");
        const workTypeValue = String(job.workType || job.type || job.mode || "Online");
        const location = escapeHtml(job.location || (workTypeValue === "Online" ? "Remote / Virtual" : "India"));
        const stipend = escapeHtml(job.stipend || "Competitive Stipend");
        const workType = escapeHtml(workTypeValue);
        const link = escapeHtml(getSafeHttpsUrl(job.link || job.applyUrl, safePortalUrl));

        const modeBadgeColor = workTypeValue.toLowerCase().includes("online") ? "#0d9488" : "#2563eb";
        const modeBadgeBg = workTypeValue.toLowerCase().includes("online") ? "#ccfbf1" : "#dbeafe";

        return `
        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:14px; padding:20px; margin-bottom:16px; box-shadow:0 2px 8px rgba(15,23,42,0.04);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                <div>
                    <span style="display:inline-block; font-size:11px; font-weight:700; color:${modeBadgeColor}; background:${modeBadgeBg}; padding:3px 10px; border-radius:20px; text-transform:uppercase; letter-spacing:0.5px;">
                        ${workType}
                    </span>
                    <h3 style="margin:8px 0 4px; font-size:18px; color:#0f172a; font-weight:700;">${title}</h3>
                    <p style="margin:0; font-size:14px; color:#0f766e; font-weight:600;">🏢 ${company}</p>
                </div>
            </div>

            <div style="display:flex; flex-wrap:wrap; gap:16px; margin:12px 0; font-size:13px; color:#64748b;">
                <span>📍 <strong>Location:</strong> ${location}</span>
                <span>💰 <strong>Stipend:</strong> ${stipend}</span>
            </div>

            <div style="margin-top:14px; padding-top:12px; border-top:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:12px; color:#94a3b8;">Opportunity #${index + 1}</span>
                <a href="${link}" target="_blank" style="display:inline-block; background:#0f766e; color:#ffffff; text-decoration:none; font-size:13px; font-weight:700; padding:9px 18px; border-radius:8px; box-shadow:0 2px 6px rgba(15,118,110,0.2);">
                    View & Apply →
                </a>
            </div>
        </div>
        `;
    }).join("");

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Internship Alerts - InternMatch</title>
    </head>
    <body style="margin:0; padding:0; background-color:#f8fafc; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#334155;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc; padding:24px 12px;">
            <tr>
                <td align="center">
                    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:620px; background-color:#ffffff; border-radius:20px; overflow:hidden; border:1px solid #e2e8f0; box-shadow:0 8px 30px rgba(15,23,42,0.06);">

                        <!-- Header Banner -->
                        <tr>
                            <td style="background:linear-gradient(135deg, #0f766e 0%, #0d9488 50%, #115e59 100%); padding:32px 28px; text-align:center; color:#ffffff;">
                                <div style="display:inline-block; background:rgba(255,255,255,0.2); backdrop-filter:blur(6px); border-radius:30px; padding:6px 14px; font-size:12px; font-weight:700; letter-spacing:1px; text-transform:uppercase; margin-bottom:12px;">
                                    🎓 InternMatch • Official Alerts
                                </div>
                                <h1 style="margin:0; font-size:24px; font-weight:800; letter-spacing:-0.5px; line-height:1.3;">
                                    New Internship Matches For You 🚀
                                </h1>
                                <p style="margin:10px 0 0; font-size:14px; opacity:0.9; line-height:1.5;">
                                    Handpicked opportunities matching your academic branch and career interests.
                                </p>
                            </td>
                        </tr>

                        <!-- Body Greeting -->
                        <tr>
                            <td style="padding:28px 28px 12px;">
                                <h2 style="margin:0 0 8px; font-size:18px; color:#0f172a;">Dear ${studentName}${studentRoll},</h2>
                                <p style="margin:0 0 16px; font-size:14.5px; line-height:1.6; color:#475569;">
                                    Great news! We found <strong>${matches.length} fresh internship openings</strong> tailored to your field of study (<span style="color:#0f766e; font-weight:600;">${studentBranch}</span>). Early applicants have a much higher interview shortlisting rate!
                                </p>
                            </td>
                        </tr>

                        <!-- Job Listings -->
                        <tr>
                            <td style="padding:0 28px;">
                                ${jobCardsHtml}
                            </td>
                        </tr>

                        <!-- Quick Action Tools Promotion -->
                        <tr>
                            <td style="padding:16px 28px 24px;">
                                <div style="background:#f0fdfa; border:1px solid #99f6e4; border-radius:14px; padding:20px; text-align:center;">
                                    <h4 style="margin:0 0 6px; font-size:15px; color:#0f766e; font-weight:700;">
                                        ⚡ Boost Your Application Success
                                    </h4>
                                    <p style="margin:0 0 14px; font-size:13px; color:#475569; line-height:1.5;">
                                        Before applying, test your resume with our ATS Checker and generate a personalized cover letter in seconds.
                                    </p>
                                    <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
                                        <a href="${safePortalUrl}#ats" target="_blank" rel="noopener noreferrer" style="display:inline-block; background:#ffffff; border:1px solid #0d9488; color:#0d9488; font-size:12px; font-weight:700; padding:8px 14px; border-radius:6px; text-decoration:none;">
                                            📄 Test ATS Score
                                        </a>
                                        <a href="${safePortalUrl}#coverletter" target="_blank" rel="noopener noreferrer" style="display:inline-block; background:#0f766e; color:#ffffff; font-size:12px; font-weight:700; padding:8px 14px; border-radius:6px; text-decoration:none;">
                                            ✍️ Generate Cover Letter
                                        </a>
                                    </div>
                                </div>
                            </td>
                        </tr>

                        <!-- Footer -->
                        <tr>
                            <td style="background-color:#f8fafc; border-top:1px solid #e2e8f0; padding:24px 28px; text-align:center; font-size:12px; color:#94a3b8; line-height:1.6;">
                                <p style="margin:0 0 6px; font-weight:600; color:#64748b;">
                                    Sri Vasavi Engineering College • InternMatch Career Portal
                                </p>
                                <p style="margin:0 0 10px;">
                                    You received this verified email alert because you are an approved student on InternMatch.
                                </p>
                                <p style="margin:0;">
                                    <a href="${safePortalUrl}" style="color:#0f766e; text-decoration:none; font-weight:600;">Open Portal</a> &nbsp;|&nbsp;
                                    <a href="${safePortalUrl}#profile" style="color:#0f766e; text-decoration:none; font-weight:600;">Manage Notification Preferences</a>
                                </p>
                            </td>
                        </tr>

                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;
}

/**
 * Dispatches email alerts to all approved and subscribed students.
 * Logs execution in Firebase Realtime Database metadata.
 */
async function dispatchInternshipEmailAlerts(database, newInternships, options = {}) {
    if (!Array.isArray(newInternships) || newInternships.length === 0) {
        console.log("[EmailAlerts] No active internships available to dispatch.");
        return { totalStudents: 0, sentCount: 0, errorCount: 0, status: "no_internships" };
    }

    const environment = options.env || process.env;
    const transporter = options.transporter || await createMailTransporter(environment);
    const studentsRef = database.ref("students");
    const snapshot = await studentsRef.once("value");
    const studentsData = snapshot.val() || {};

    // Filter approved students who have a valid email and haven't disabled alerts
    const recipients = Object.entries(studentsData)
        .map(([uid, data]) => ({ uid, ...data }))
        .filter(student => {
            if (student.status !== "approved") return false;
            if (!student.email || !student.email.includes("@")) return false;
            if (student.emailAlertsEnabled !== true) return false;
            return true;
        });

    if (recipients.length === 0) {
        console.log("[EmailAlerts] No approved, subscribed students found for email dispatch.");
        return { totalStudents: 0, sentCount: 0, errorCount: 0, status: "no_recipients" };
    }

    console.log(`[EmailAlerts] Preparing email alerts for ${recipients.length} subscribed students...`);

    const fromAddress = environment.SMTP_FROM || environment.SMTP_USER;
    const portalUrl = options.portalUrl || environment.PORTAL_URL || "https://ratnaprasad17.github.io/jip-project/";

    let sentCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const student of recipients) {
        try {
            if (student.emailAlertFrequency === "weekly" &&
                new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", weekday: "long" }).format(new Date()) !== "Monday") {
                continue;
            }

            const matches = student.emailAlertFilter === "all"
                ? newInternships.slice(0, 5)
                : findMatchingInternshipsForStudent(student, newInternships, 5);
            if (matches.length === 0) continue;

            const html = generateInternshipDigestHtml({ student, matches, portalUrl });
            const subject = `🎯 ${matches.length} New Internship Opportunities Matched For You - InternMatch`;

            await transporter.sendMail({
                from: fromAddress,
                to: student.email,
                subject,
                html
            });

            sentCount++;
        } catch (err) {
            errorCount++;
            errors.push({ uid: student.uid, error: err.message });
            console.error(`[EmailAlerts] Error sending alert for student ${student.uid}:`, err.message);
        }
    }

    // Update dispatch log in Firebase
    const logRef = database.ref("email_alerts_log");
    await logRef.push({
        timestamp: new Date().toISOString(),
        totalSubscribers: recipients.length,
        sentCount,
        errorCount,
        internshipCount: newInternships.length
    });

    console.log(`[EmailAlerts] Completed email dispatch: ${sentCount} sent, ${errorCount} errors.`);
    return {
        totalStudents: recipients.length,
        sentCount,
        errorCount,
        errors,
        status: "completed"
    };
}

module.exports = {
    createMailTransporter,
    findNewInternships,
    findMatchingInternshipsForStudent,
    generateInternshipDigestHtml,
    dispatchInternshipEmailAlerts
};
