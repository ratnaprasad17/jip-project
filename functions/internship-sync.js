"use strict";

const INTERNSHIP_TITLE_PATTERN = /\bintern(?:ship)?\b/i;
const SKILL_NAMES = [
    "Python", "Java", "JavaScript", "TypeScript", "React", "Node.js", "SQL",
    "C++", "C#", "AWS", "Azure", "Docker", "Kubernetes", "TensorFlow",
    "PyTorch", "Machine Learning", "Data Analysis", "Excel", "Figma"
];

function cleanText(value, maxLength = 1200) {
    return String(value || "")
        .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;|&#160;/gi, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maxLength);
}

function safeHttpsUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === "https:" ? url.toString() : "";
    } catch (error) {
        return "";
    }
}

function getSpecialization(text) {
    const normalized = text.toLowerCase();
    const categories = [
        ["Artificial Intelligence", /artificial intelligence|\bai\b|machine learning|\bml\b/],
        ["Data Science", /data science|analytics|data analyst/],
        ["Web Development", /web developer|frontend|front-end|backend|back-end|full.?stack/],
        ["Cyber Security", /cyber ?security|information security/],
        ["Cloud Computing", /cloud|devops/],
        ["Electronics", /electronics|embedded|hardware/],
        ["Finance", /finance|accounting/],
        ["Marketing", /marketing|social media/]
    ];
    const match = categories.find(([, pattern]) => pattern.test(normalized));
    return match ? match[0] : "General";
}

function getSkills(text) {
    return SKILL_NAMES.filter(skill =>
        new RegExp(`(^|[^a-z0-9])${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^a-z0-9])`, "i").test(text)
    );
}

function getStipend(text) {
    const match = text.match(/(?:₹|INR\s?|USD\s?|\$)\s?\d[\d,]*(?:\s*[-–]\s*(?:₹|INR\s?|USD\s?|\$)?\s?\d[\d,]*)?(?:\s*(?:\/|per\s+)(?:month|hour|year|annum))?/i);
    return match ? cleanText(match[0], 80) : "Not specified";
}

function getClosingDate(posting) {
    const candidate = posting.validThrough || posting.expiresAt || posting.closeDate;
    if (!candidate) return "";
    const parsedDate = new Date(candidate);
    if (Number.isNaN(parsedDate.getTime())) return "";
    return parsedDate.toISOString().slice(0, 10);
}

function getPostedDate(posting) {
    const candidate = posting.updated_at || posting.createdAt || posting.created_at || posting.postedAt;
    if (!candidate) return "";
    const parsedDate = new Date(candidate);
    if (Number.isNaN(parsedDate.getTime())) return "";
    return parsedDate.toISOString().slice(0, 10);
}

function stableInternshipId(sourceKey, postingId) {
    const value = `${sourceKey}:${postingId}`;
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) + 1_000_000;
}

function normalizePosting(source, posting, fields) {
    const title = cleanText(fields.title, 180);
    const description = cleanText(fields.description, 1200);
    if (!title || !INTERNSHIP_TITLE_PATTERN.test(title)) return null;

    const applicationLink = safeHttpsUrl(fields.applicationLink);
    if (!applicationLink) return null;

    const location = cleanText(fields.location, 120) || "Not specified";
    const searchableText = `${title} ${description} ${fields.department || ""}`;
    const postingId = String(fields.id || "");
    if (!postingId) return null;

    const internship = {
        id: stableInternshipId(source.key, postingId),
        title,
        company: cleanText(source.company, 120) || "Company",
        type: /remote|work from home|anywhere/i.test(location) ? "Online" : "Offline",
        branch: "All branches",
        specialization: getSpecialization(searchableText),
        location,
        stipend: getStipend(searchableText),
        duration: "Not specified",
        skills: getSkills(searchableText),
        description: description || "View the original posting for full internship details.",
        link: applicationLink,
        _sourceKey: source.key,
        _sourceId: postingId
    };

    // Keep the original posting date so the website can show students how recent the listing is.
    const postedDate = getPostedDate(posting);
    if (postedDate) internship.postedDate = postedDate;

    const closingDate = getClosingDate(posting);
    if (closingDate) internship.closingDate = closingDate;
    return internship;
}

function normalizeGreenhouseJobs(source, jobs) {
    return jobs.map(job => normalizePosting(source, job, {
        id: job.id,
        title: job.title,
        description: job.content,
        location: job.location && job.location.name,
        applicationLink: job.absolute_url,
        department: (job.departments || []).map(department => department.name).join(" ")
    })).filter(Boolean);
}

function normalizeLeverPostings(source, postings) {
    return postings.map(posting => normalizePosting(source, posting, {
        id: posting.id,
        title: posting.text,
        description: posting.descriptionPlain || posting.description,
        location: posting.categories && posting.categories.location,
        applicationLink: posting.applyUrl || posting.hostedUrl,
        department: [posting.categories && posting.categories.team, posting.categories && posting.categories.department]
            .filter(Boolean).join(" ")
    })).filter(Boolean);
}

async function fetchSource(source, fetchImpl = fetch) {
    if (!source || !source.key || !source.company || !source.board) {
        throw new Error("Each source must include key, company, and board fields.");
    }

    let endpoint;
    if (source.provider === "greenhouse") {
        endpoint = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(source.board)}/jobs?content=true`;
    } else if (source.provider === "lever") {
        endpoint = `https://api.lever.co/v0/postings/${encodeURIComponent(source.board)}?mode=json`;
    } else {
        throw new Error(`Unsupported provider for source ${source.key}.`);
    }

    const response = await fetchImpl(endpoint, {
        headers: { "User-Agent": "InternMatch internship feed importer" },
        signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error(`${source.provider} returned HTTP ${response.status}.`);

    const data = await response.json();
    const records = source.provider === "greenhouse" ? data.jobs : data;
    if (!Array.isArray(records)) throw new Error(`${source.provider} returned an unexpected response.`);

    return source.provider === "greenhouse"
        ? normalizeGreenhouseJobs(source, records)
        : normalizeLeverPostings(source, records);
}

function reconcileInternships(existing, sourceResults, today) {
    const current = Array.isArray(existing) ? existing : [];
    const successfulSources = new Map();
    const failedSources = new Set();

    sourceResults.forEach(result => {
        if (result.status === "success") successfulSources.set(result.sourceKey, result.internships);
        else failedSources.add(result.sourceKey);
    });

    const merged = current.filter(internship => {
        if (internship.closingDate && internship.closingDate < today) return false;
        if (!internship._sourceKey) return true;
        if (failedSources.has(internship._sourceKey)) return true;
        return !successfulSources.has(internship._sourceKey);
    });

    successfulSources.forEach(imported => {
        imported.forEach(internship => {
            if (!internship.closingDate || internship.closingDate >= today) merged.push(internship);
        });
    });

    return merged;
}

function getDateInTimeZone(date = new Date(), timeZone = "Asia/Kolkata") {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
}

module.exports = {
    fetchSource,
    getDateInTimeZone,
    getPostedDate,
    normalizeGreenhouseJobs,
    normalizeLeverPostings,
    reconcileInternships,
    stableInternshipId
};