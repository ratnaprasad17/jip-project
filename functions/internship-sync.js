"use strict";

const { parse } = require("node-html-parser");
const he = require("he");

const INTERNSHIP_TITLE_PATTERN = /\bintern(?:ship)?\b/i;
const MAX_IMPORTED_AGE_DAYS = 90;
const MAX_PUBLISHED_INTERNSHIPS = 500;
const INDIA_CITY_PATTERN = /\b(?:bengaluru|bangalore|hyderabad|mumbai|pune|chennai|gurugram|gurgaon|noida|new delhi|delhi|kolkata|ahmedabad|jaipur|kochi|cochin|thiruvananthapuram|visakhapatnam|vizag|lucknow|indore|bhubaneswar|mysuru|mysore|mangaluru|mangalore|coimbatore|nagpur|chandigarh|surat|vadodara|bhopal|patna|kanpur|ghaziabad|dehradun|goa)\b/i;

function isIndiaBasedInternship(internship) {
    const location = String(internship.location || "");
    return /\bindia\b/i.test(location) || INDIA_CITY_PATTERN.test(location);
}

function sortIndiaFirstInternships(listings) {
    return [...listings].sort((left, right) => {
        const indiaOrder = Number(isIndiaBasedInternship(right)) - Number(isIndiaBasedInternship(left));
        if (indiaOrder) return indiaOrder;
        return String(right.postedDate || "").localeCompare(String(left.postedDate || ""));
    });
}

const LEGACY_SAMPLE_LISTINGS = [
    { id: 1, title: "Machine Learning Intern", company: "TechNova AI" },
    { id: 2, title: "Data Science Intern", company: "DataWorks" },
    { id: 3, title: "Web Development Intern", company: "WebCraft Solutions" },
    { id: 4, title: "AI Research Intern", company: "FutureAI Labs" },
    { id: 5, title: "Cyber Security Intern", company: "SecureNet" },
    { id: 6, title: "Cloud Computing Intern", company: "CloudSphere" }
];
const SKILL_NAMES = [
    "Python", "Java", "JavaScript", "TypeScript", "React", "Node.js", "SQL",
    "C++", "C#", "AWS", "Azure", "Docker", "Kubernetes", "TensorFlow",
    "PyTorch", "Machine Learning", "Data Analysis", "Excel", "Figma"
];

function cleanText(value, maxLength = 1200) {
    const root = parse(he.decode(String(value || "")));
    root.querySelectorAll("script, style, noscript").forEach(node => node.remove());
    return getParsedText(root).slice(0, maxLength);
}

function getParsedText(root) {
    const blocks = root.querySelectorAll("h1, h2, h3, h4, p, li")
        .filter(node => node.tagName !== "LI" || !node.querySelector("p"))
        .map(node => node.text.trim())
        .filter(Boolean);
    return (blocks.length ? blocks.join(" ") : root.text).replace(/\s+/g, " ").trim();
}

function getRoleDescription(value) {
    const root = parse(he.decode(String(value || "")));
    root.querySelectorAll("script, style, noscript").forEach(node => node.remove());

    const roleHeading = root.querySelectorAll("h1, h2, h3").find(node =>
        /^(what you['’]ll do|responsibilities|the role|role overview|about (this )?(role|position|internship))$/i
            .test(node.text.trim())
    );
    if (roleHeading) {
        let firstRoleNode = roleHeading;
        while (firstRoleNode.parentNode && firstRoleNode.parentNode !== root) {
            firstRoleNode = firstRoleNode.parentNode;
        }
        const startIndex = root.childNodes.indexOf(firstRoleNode);
        if (startIndex > 0) root.childNodes.slice(0, startIndex).forEach(node => node.remove());
    }

    return getParsedText(root).slice(0, 4000);
}

function safeHttpsUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === "https:" ? url.toString() : "";
    } catch (error) {
        return "";
    }
}

function safeLogoDomain(value) {
    const domain = String(value || "").toLowerCase();
    return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)
        ? domain
        : "";
}

function safeOfficialApplicationUrl(provider, value, sourceHosts = []) {
    const safeUrl = safeHttpsUrl(value);
    if (!safeUrl) return "";

    const host = new URL(safeUrl).hostname.toLowerCase();
    const approvedHosts = provider === "greenhouse"
        ? ["boards.greenhouse.io", "job-boards.greenhouse.io", "job-boards.eu.greenhouse.io", "stripe.com"]
        : provider === "lever"
            ? ["jobs.lever.co", "jobs.eu.lever.co"]
            : provider === "ashby"
                ? ["jobs.ashbyhq.com"]
                : [];

    return approvedHosts.includes(host) || sourceHosts.includes(host) ? safeUrl : "";
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

function getWorkType(location) {
    const text = String(location || "").toLowerCase();
    if (/remote|work from home|anywhere|virtual/.test(text)) return "Online";
    if (/hybrid/.test(text)) return "Hybrid";
    if (/on[- ]site|onsite|in[- ]person|office[- ]based/.test(text)) return "Offline";
    return "Not specified";
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
    const candidate = posting.updated_at || posting.createdAt || posting.created_at || posting.postedAt || posting.publishedAt;
    if (!candidate) return "";
    const parsedDate = new Date(candidate);
    if (Number.isNaN(parsedDate.getTime())) return "";
    return parsedDate.toISOString().slice(0, 10);
}

function isStaleImportedInternship(internship, today) {
    if (internship.closingDate && internship.closingDate < today) return true;
    if (!internship._sourceKey && LEGACY_SAMPLE_LISTINGS.some(sample =>
        internship.id === sample.id && internship.title === sample.title && internship.company === sample.company
    )) return true;
    if (!internship._sourceKey || !internship.postedDate) return false;

    const cutoff = new Date(`${today}T00:00:00.000Z`);
    cutoff.setUTCDate(cutoff.getUTCDate() - MAX_IMPORTED_AGE_DAYS);
    return internship.postedDate < cutoff.toISOString().slice(0, 10);
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
    const description = getRoleDescription(fields.description);
    if (!title || !INTERNSHIP_TITLE_PATTERN.test(title)) return null;

    const applicationLink = safeOfficialApplicationUrl(fields.provider, fields.applicationLink, source.applicationHosts);
    if (!applicationLink) return null;

    const location = cleanText(fields.location, 120) || "Not specified";
    const searchableText = `${title} ${description} ${fields.department || ""}`;
    const postingId = String(fields.id || "");
    if (!postingId) return null;
    const logoDomain = safeLogoDomain(source.logoDomain);

    const internship = {
        id: stableInternshipId(source.key, postingId),
        title,
        company: cleanText(source.company, 120) || "Company",
        type: fields.type || getWorkType(location),
        branch: "Not specified",
        specialization: getSpecialization(searchableText),
        location,
        stipend: getStipend(searchableText),
        duration: "Not specified",
        skills: getSkills(searchableText),
        description: description || "View the original posting for full internship details.",
        link: applicationLink,
        _sourceKey: source.key,
        _sourceId: postingId,
        ...(logoDomain ? { logoDomain } : {})
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
        provider: "greenhouse",
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
        provider: "lever",
        id: posting.id,
        title: posting.text,
        description: posting.descriptionPlain || posting.description,
        location: posting.categories && posting.categories.location,
        applicationLink: posting.applyUrl || posting.hostedUrl,
        department: [posting.categories && posting.categories.team, posting.categories && posting.categories.department]
            .filter(Boolean).join(" ")
    })).filter(Boolean);
}

function normalizeAshbyPostings(source, postings) {
    return postings.map(posting => normalizePosting(source, posting, {
        provider: "ashby",
        id: posting.id,
        title: posting.title,
        description: posting.descriptionHtml,
        location: posting.location,
        type: posting.isRemote ? "Online" : undefined,
        applicationLink: posting.applyUrl || posting.jobUrl,
        department: [posting.department, posting.team].filter(Boolean).join(" ")
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
    } else if (source.provider === "ashby") {
        endpoint = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(source.board)}`;
    } else {
        throw new Error(`Unsupported provider for source ${source.key}.`);
    }

    const response = await fetchImpl(endpoint, {
        headers: { "User-Agent": "InternMatch internship feed importer" },
        signal: AbortSignal.timeout(45000)
    });
    if (!response.ok) throw new Error(`${source.provider} returned HTTP ${response.status}.`);

    const data = await response.json();
    const records = source.provider === "greenhouse" || source.provider === "ashby" ? data.jobs : data;
    if (!Array.isArray(records)) throw new Error(`${source.provider} returned an unexpected response.`);

    if (source.provider === "greenhouse") return normalizeGreenhouseJobs(source, records);
    if (source.provider === "ashby") return normalizeAshbyPostings(source, records);
    return normalizeLeverPostings(source, records);
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
        if (isStaleImportedInternship(internship, today)) return false;
        if (!internship._sourceKey) return true;
        if (failedSources.has(internship._sourceKey)) return true;
        return !successfulSources.has(internship._sourceKey);
    });

    successfulSources.forEach(imported => {
        imported.forEach(internship => {
            if (!isStaleImportedInternship(internship, today)) merged.push(internship);
        });
    });

    const deduplicated = [];
    const seenIds = new Set();
    for (const item of merged) {
        const idKey = String(item.id || `${item._sourceKey}:${item._sourceId}`);
        if (!seenIds.has(idKey)) {
            seenIds.add(idKey);
            deduplicated.push(item);
        }
    }

    const sorted = sortIndiaFirstInternships(deduplicated);
    return sorted.slice(0, MAX_PUBLISHED_INTERNSHIPS);
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
    MAX_PUBLISHED_INTERNSHIPS,
    fetchSource,
    getDateInTimeZone,
    getPostedDate,
    isIndiaBasedInternship,
    normalizeAshbyPostings,
    normalizeGreenhouseJobs,
    normalizeLeverPostings,
    reconcileInternships,
    sortIndiaFirstInternships,
    stableInternshipId
};