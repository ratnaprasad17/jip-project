import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { BotAvatar } from "bot-avatars";
import { Moon, Sun } from "lucide-react";
import "./chatbot.css";

const MAX_CHAT_MESSAGES = 40;
const STARTER_QUESTIONS = [
    "How do I register?",
    "I cannot log in",
    "How do I find internships?",
    "How do I enable email alerts?"
];

function getPreferences() {
    const value = id => document.getElementById(id)?.value.trim() || "";
    return {
        branch: value("branch"),
        specialization: value("specialization"),
        skills: [...new Set(value("skills").split(",").map(skill => skill.trim().toLowerCase()).filter(Boolean))],
        location: value("location").toLowerCase(),
        type: document.getElementById("offlineChoice")?.getAttribute("aria-pressed") === "true" ? "Offline" : "Online"
    };
}

function rankListings(listings) {
    const preferences = getPreferences();
    const normalize = value => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const matches = (left, right) => {
        const a = normalize(left);
        const b = normalize(right);
        if (!a || !b) return false;
        if (a.includes(b) || b.includes(a)) return true;
        const aiMl = /\b(artificial intelligence|ai|machine learning|ml)\b/;
        return aiMl.test(a) && aiMl.test(b);
    };
    const skillWeight = preferences.skills.length ? 20 : 0;
    const maxScore = (preferences.branch ? 25 : 0) +
        (preferences.specialization ? 25 : 0) +
        (preferences.location ? 10 : 0) +
        skillWeight;

    return listings
        .filter(listing => listing.type === preferences.type)
        .map(listing => {
            let score = 0;
            if (preferences.branch && (
                normalize(listing.branch) === "all branches" ||
                matches(listing.branch, preferences.branch) ||
                matches(listing.specialization, preferences.branch)
            )) score += 25;
            if (preferences.specialization && matches(listing.specialization, preferences.specialization)) score += 25;
            if (preferences.location && normalize(listing.location).includes(normalize(preferences.location))) score += 10;
            const listingSkills = (Array.isArray(listing.skills) ? listing.skills : [])
                .filter(skill => typeof skill === "string");
            const matchedSkills = preferences.skills.filter(skill => listingSkills.some(listingSkill => matches(listingSkill, skill)));
            if (preferences.skills.length) score += skillWeight * matchedSkills.length / preferences.skills.length;
            return { ...listing, score: maxScore ? Math.round(score / maxScore * 100) : 100 };
        })
        .filter(listing => listing.score > 0)
        .sort((left, right) => right.score - left.score || Number(right.isIndia) - Number(left.isIndia));
}

function answerQuestion(question, listings, previousAssistantMessage) {
    const query = question.toLowerCase().replace(/[’']/g, "'").trim();
    const has = pattern => pattern.test(query);
    const allSkills = [...new Set(listings.flatMap(listing =>
        (Array.isArray(listing.skills) ? listing.skills : [])
            .filter(skill => typeof skill === "string")
            .map(skill => skill.trim())
            .filter(Boolean)
    ))].sort((left, right) => right.length - left.length);

    if (has(/^\s*(hello|hi|hey|good morning|good afternoon|good evening)[!. ]*$/)) {
        return { text: "Hello! I’m the InternMatch Help Desk. Ask me about current internships, recommendations, your account, applications, email alerts, market insights, or career tools." };
    }
    if (has(/^\s*(thank you|thanks|thx)[!. ]*$/)) {
        return { text: "You’re welcome. I’m here if you need help with internships, your account, applications, or the site’s career tools." };
    }
    if (has(/\b(track|tracker|application status|my applications|application history)\b/)) {
        return { text: "Open Tracker in the top menu. It keeps viewed, saved, applied, interviewing, offer, and other application activity together. Select “Track External Application” to add a role from another website." };
    }
    if (has(/\b(deadline|closing date|application closes|when does it close)\b/)) {
        const company = listings.find(listing =>
            listing.company && query.includes(listing.company.toLowerCase())
        )?.company;
        const datedListings = listings.filter(listing =>
            listing.closingDate && (!company || listing.company === company)
        );
        return datedListings.length
            ? { text: `These closing dates were provided by ${company || "the employer feeds"}. Always confirm the deadline on the original application page.`, listings: datedListings.slice(0, 5) }
            : { text: "The current employer feeds do not provide a closing date for that search. Please check the original application page before applying.", listings: company ? listings.filter(listing => listing.company === company).slice(0, 5) : [] };
    }
    if (has(/\b(apply|application link|how to apply|applying)\b/)) {
        return {
            text: "Open an internship’s Details page to review the information, then choose Apply to visit the employer’s application page. If no application link is shown, the source did not supply a usable link; open the employer’s official careers page and verify the listing before sharing personal information."
        };
    }
    if (has(/\b(saved internships?|saved jobs?|saved roles?|favorites?|favourites?|bookmarks?|save (?:this|an? internship|a job))\b/)) {
        const savedListings = listings.filter(listing => listing.isSaved);
        return savedListings.length
            ? { text: `You have ${savedListings.length} saved internship${savedListings.length === 1 ? "" : "s"}. Open Saved in the top menu to review them.`, listings: savedListings.slice(0, 5) }
            : { text: "You have no saved internships in the current session. Select the heart on an internship card to save it, then open Saved in the top menu." };
    }
    if (has(/\b(profile|edit my details|update my details|my account details|change my information)\b/)) {
        return { text: "Open My Profile and select Edit profile. Update your contact, education, skills, location, work mode, career links, or email-alert settings, then select Save profile. Your account email is shown there." };
    }
    if (has(/\b(email alerts?|email notifications?|digest|smtp)\b/)) {
        return { text: "Open My Profile. Use Enable email alerts to turn alerts on or off; use Edit profile to choose the frequency and branch/all-openings filter. Digests are sent only after a successful internship sync, and the site administrator must configure SMTP for email delivery. Preview My Email Alert shows the digest format." };
    }
    if (has(/\b(register|registration|sign up|account|approval|approve|login|log in|sign in|forgot password|reset password)\b/)) {
        if (has(/\b(forgot|reset|recover)\b/)) {
            return { text: "On the student login form, enter your registered email and select Forgot password. Firebase will send a password-reset email if that address has an account." };
        }
        if (has(/\b(pending|approval|approved|approve|status)\b/)) {
            return { text: "New student accounts must be approved by the site administrator before they can sign in. If your account is pending, return to the student login page and try again after approval; this Help Desk cannot view or change approval status." };
        }
        return { text: "On the student login page, select “New student? Register here,” complete the required fields, and submit. New accounts wait for administrator approval. Approved students sign in with their registered email and password. Use Forgot password if you cannot remember your password." };
    }
    if (has(/\b(resume|ats|applicant tracking|keyword analysis)\b/)) {
        return { text: "Open My Profile and expand ATS Resume Checker. Upload a PDF/TXT resume or paste resume text, then compare it with an internship description. The checker highlights matching and missing keywords and provides formatting tips; its score is guidance, not a hiring guarantee." };
    }
    if (has(/\b(cover letter|coverletter|application letter)\b/)) {
        return { text: "Open My Profile and expand Cover Letter Generator. Add or select a target internship, review the generated draft, personalize it with accurate examples, and then copy or download it. Always review the result before sending it." };
    }
    if (has(/\b(insights|analytics|market trends|hiring trends|top skills|top companies|top locations)\b/)) {
        return { text: "Open Insights to see counts for current listings, India-based and online roles, employers, in-demand skills, India hiring locations, and work arrangements. Select a skill to see matching internships. These summaries reflect the currently loaded feed, and some source listings may omit details." };
    }
    if (has(/\b(review|reviews|rating|ratings|company culture|interview experience)\b/)) {
        return { text: "Open an internship’s Details view and select View Company Reviews & Ratings. You can read available reviews or use Write a Review. Review data may not exist for every employer, and you should treat personal experiences as individual opinions." };
    }
    if (has(/\b(dark mode|light mode|theme|appearance)\b/)) {
        return { text: "Use the moon/sun button in the top-right corner to switch between light and dark appearance. Your choice is saved in this browser." };
    }
    if (has(/\b(featured|latest internships?|home page|homepage)\b/)) {
        return { text: "Home shows featured and latest listings. Use the search and filter controls to narrow openings, and select Details to review a role before applying." };
    }
    if (has(/\b(how do i find|where can i find|browse internships?|discover internships?)\b/)) {
        return { text: "Use Find Internship in the top menu to choose your work mode and add optional matching preferences. For the full catalog, open Home and use search, filters, and sorting. Select Details to review an opening before applying." };
    }
    if (has(/\b(how do i search|how do filters work|filter options|reset filters|clear filters|sort by)\b/)) {
        return { text: "On Home, use the search box to search role titles, employers, locations, branches, skills, stipend, or duration. Filter by work mode, location, and branch, then sort by India first, newest, title, or employer. Select Reset to clear the search and filters." };
    }
    if (has(/\b(match|matching|recommend(?:ation)?s?|score|preferences)\b/)) {
        if (!listings.length) {
            return { text: "I can explain the matching rules, but there are no current listings to rank. Recommendations become available after the internship feed loads." };
        }
        const recommendations = rankListings(listings).slice(0, 3);
        if (!recommendations.length) {
            return { text: `There are no current ${getPreferences().type.toLowerCase()} listings matching your selected preferences. Try changing your skills, location, specialization, or branch.` };
        }
        return {
            text: "Open Find Internship, choose Online or Offline, and add any branch, specialization, location, and comma-separated skills. Work mode is a required filter. Remaining matches are ranked using branch (25 points), specialization (25), location (10), and skills (up to 20); the score is normalized against the preferences you supplied. Listings without any of your optional preference matches are left out. The feeds do not supply graduation-year eligibility consistently, so check the employer posting.",
            listings: recommendations
        };
    }
    if (has(/\b(source|sources|job board|job boards|updated|refresh|sync|new listings)\b/)) {
        const companies = [...new Set(listings.map(listing => listing.company).filter(Boolean))].sort();
        return listings.length
            ? { text: `The site currently has ${listings.length} loaded listings from ${companies.length} employers: ${companies.join(", ")}. The catalog updates through its scheduled feed sync. A listing’s availability and application details can change on the employer’s website.` }
            : { text: "No internship listings are currently loaded. The scheduled feed must publish openings before I can search or recommend them." };
    }
    if (has(/\b(latest|newest|recent|most recent)\b/)) {
        const datedListings = [...listings]
            .filter(listing => listing.postedDate)
            .sort((left, right) => String(right.postedDate).localeCompare(String(left.postedDate)));
        return datedListings.length
            ? { text: "Here are the latest listings with posting dates supplied by their source. Listings without dates cannot be reliably ordered by recency.", listings: datedListings.slice(0, 5) }
            : { text: "The current feeds do not provide posting dates, so I cannot reliably identify the newest openings.", listings: listings.slice(0, 3) };
    }
    if (has(/\b(only one|just one|that's all|any more|more\?)\b/) && previousAssistantMessage?.listings?.length) {
        const previousText = previousAssistantMessage.text.toLowerCase();
        if (previousText.includes("india-based")) {
            const indiaListings = listings.filter(listing => listing.isIndia);
            return {
                text: `Yes, there ${indiaListings.length === 1 ? "is" : "are"} ${indiaListings.length} current listing${indiaListings.length === 1 ? "" : "s"} explicitly located in India. Other locations aren't counted as India unless the source names an Indian city or country.`,
                listings: indiaListings.slice(0, 5)
            };
        }
        return {
            text: `That previous result showed ${previousAssistantMessage.listings.length} matching listing${previousAssistantMessage.listings.length === 1 ? "" : "s"}. Want me to check another company, location, or skill?`,
            listings: previousAssistantMessage.listings
        };
    }

    const companyMatch = listings.filter(listing =>
        listing.company && query.includes(listing.company.toLowerCase())
    );
    if (companyMatch.length) {
        if (/\b(deadline|closing date|application closes|when does it close)\b/.test(query)) {
            const datedListings = companyMatch.filter(listing => listing.closingDate);
            return datedListings.length
                ? { text: `Closing dates supplied for ${companyMatch[0].company} are shown here.`, listings: datedListings.slice(0, 5) }
                : { text: `${companyMatch[0].company}'s feed did not provide an application closing date. Check the original application page before applying.`, listings: companyMatch.slice(0, 5) };
        }
        return { text: `Here are the current listings from ${companyMatch[0].company}.`, listings: companyMatch.slice(0, 5) };
    }

    const titleMatches = listings.filter(listing =>
        listing.title && query.includes(listing.title.toLowerCase())
    );
    if (titleMatches.length) {
        return { text: "Here are the current listings matching that role title.", listings: titleMatches.slice(0, 5) };
    }

    if (/\b(india|indian|in india)\b/.test(query)) {
        const indiaListings = listings.filter(listing => listing.isIndia);
        return indiaListings.length
            ? { text: `I found ${indiaListings.length} current listing${indiaListings.length === 1 ? "" : "s"} with an explicitly India-based location.`, listings: indiaListings.slice(0, 5) }
            : { text: "There are no listings explicitly located in India in the current feed. Generic remote locations aren't assumed to be India-based." };
    }

    const requestedSkill = allSkills.find(skill => query.includes(skill.toLowerCase()));
    if (requestedSkill) {
        const matches = listings.filter(listing =>
            (Array.isArray(listing.skills) ? listing.skills : [])
                .some(skill => typeof skill === "string" && skill.toLowerCase() === requestedSkill.toLowerCase())
        );
        return { text: `These current listings mention ${requestedSkill}.`, listings: matches.slice(0, 5) };
    }
    if (has(/\bskills?\b/)) {
        const listingsWithSkills = listings.filter(listing => Array.isArray(listing.skills) && listing.skills.length);
        return listingsWithSkills.length
            ? { text: "These current listings include skill information.", listings: listingsWithSkills.slice(0, 5) }
            : { text: "The current feed does not include skill details for its listings." };
    }

    const locationTerms = [...new Set(listings.flatMap(listing =>
        (listing.location || "").split(/[,/]/).map(location => location.trim()).filter(location => location.length > 2)
    ))].sort((left, right) => right.length - left.length);
    const requestedLocation = locationTerms.find(location => query.includes(location.toLowerCase()));
    if (requestedLocation) {
        const matches = listings.filter(listing => listing.location?.toLowerCase().includes(requestedLocation.toLowerCase()));
        return { text: `These current listings mention ${requestedLocation}.`, listings: matches.slice(0, 5) };
    }

    const specializations = [...new Set(listings.map(listing => listing.specialization).filter(Boolean))]
        .sort((left, right) => right.length - left.length);
    const requestedSpecialization = specializations.find(specialization => query.includes(specialization.toLowerCase()));
    if (requestedSpecialization) {
        const matches = listings.filter(listing => listing.specialization === requestedSpecialization);
        return { text: `These current listings are categorized as ${requestedSpecialization}.`, listings: matches.slice(0, 5) };
    }

    if (has(/\b(branch|branches|eligible|eligibility)\b/)) {
        const specifiedListings = listings.filter(listing =>
            listing.branch && !["not specified", "all branches"].includes(listing.branch.toLowerCase())
        );
        return specifiedListings.length
            ? { text: "These listings include branch information from their source.", listings: specifiedListings.slice(0, 5) }
            : { text: "The configured job boards don't provide branch eligibility in their feed. Check each employer's original posting before applying.", listings: listings.slice(0, 5) };
    }

    if (has(/\b(online|remote|work from home)\b/)) {
        const online = listings.filter(listing => listing.type === "Online");
        const unspecified = listings.filter(listing => listing.type === "Not specified");
        return online.length
            ? { text: `I found ${online.length} current online/remote listings.`, listings: online.slice(0, 5) }
            : unspecified.length
                ? { text: `No listings are explicitly marked online. ${unspecified.length} do not state a work mode; check their original postings.`, listings: unspecified.slice(0, 5) }
                : { text: "There are no online/remote internships in the current site feed." };
    }
    if (has(/\b(offline|onsite|on-site|in person)\b/)) {
        const offline = listings.filter(listing => listing.type === "Offline");
        const unspecified = listings.filter(listing => listing.type === "Not specified");
        return offline.length
            ? { text: `I found ${offline.length} current on-site listings.`, listings: offline.slice(0, 5) }
            : unspecified.length
                ? { text: `No listings are explicitly marked on-site. ${unspecified.length} do not state a work mode; check their original postings.`, listings: unspecified.slice(0, 5) }
                : { text: "There are no on-site internships in the current site feed." };
    }
    if (has(/\bhybrid\b/)) {
        const hybrid = listings.filter(listing => listing.type === "Hybrid");
        const unspecified = listings.filter(listing => listing.type === "Not specified");
        return hybrid.length
            ? { text: `I found ${hybrid.length} listings explicitly marked hybrid.`, listings: hybrid.slice(0, 5) }
            : unspecified.length
                ? { text: `No listings are explicitly marked hybrid. ${unspecified.length} do not state a work mode; check their original postings.`, listings: unspecified.slice(0, 5) }
                : { text: "There are no hybrid internships in the current site feed." };
    }
    if (has(/\b(stipend|salary|pay|paid)\b/)) {
        return listings.length
            ? { text: "The site only shows stipend information when the original listing provides it.", listings: listings.slice(0, 5) }
            : { text: "No current internship listings are loaded, so I can't confirm stipend information." };
    }
    if (has(/\b(internship|internships|opening|openings|listing|listings|jobs|roles|company|companies|available)\b/)) {
        return listings.length
            ? { text: `There are ${listings.length} current internships loaded from the configured job boards.`, listings: listings.slice(0, 5) }
            : { text: "There are no current internships loaded on the site right now. The scheduled feed needs to run and publish its results before I can recommend roles." };
    }

    return {
        text: "I don’t have enough information to answer that accurately. I can help with current internships, employers, skills, locations, work modes, search filters, applications, account access, email alerts, Insights, and career tools. I do not guess details that employers have not provided."
    };
}

function ThemeToggle() {
    const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || "light");
    const nextTheme = theme === "dark" ? "light" : "dark";

    function toggleTheme() {
        document.documentElement.dataset.theme = nextTheme;
        setTheme(nextTheme);
        try {
            localStorage.setItem("siteTheme", nextTheme);
        } catch (error) {
            console.warn("Theme preference could not be saved.", error);
        }
        window.dispatchEvent(new CustomEvent("site-theme-change", { detail: nextTheme }));
    }

    return (
        <button
            className="theme-toggle"
            type="button"
            aria-label={`Switch to ${nextTheme} theme`}
            aria-pressed={theme === "dark"}
            title={`Switch to ${nextTheme} theme`}
            onClick={toggleTheme}
        >
            {theme === "dark" ? <Sun size={19} strokeWidth={1.8} aria-hidden="true" /> : <Moon size={19} strokeWidth={1.8} aria-hidden="true" />}
        </button>
    );
}

function ListingLinks({ listings }) {
    if (!listings?.length) return null;
    return (
        <div className="chat-listings">
            {listings.map((listing, index) => (
                <div className="chat-listing" key={`${listing.company}-${listing.title}-${index}`}>
                    <div>
                        <strong>{listing.title}</strong>
                        <span>{listing.company}{hasValue(listing.location) ? ` · ${listing.location}` : ""}</span>
                        {listing.isIndia && <span className="chat-india-flag">India</span>}
                        {hasValue(listing.specialization) && listing.specialization !== "General" && <span>{listing.specialization}</span>}
                        {hasValue(listing.type) && <span>{listing.type}</span>}
                        {[listing.stipend, listing.duration].filter(hasValue).length > 0 && <span>{[listing.stipend, listing.duration].filter(hasValue).join(" · ")}</span>}
                        {listing.skills?.filter(hasValue).length > 0 && <span>Skills: {listing.skills.filter(hasValue).join(", ")}</span>}
                        {listing.postedDate && <span>Posted: {listing.postedDate}</span>}
                        {listing.closingDate && <span>Closes: {listing.closingDate}</span>}
                    </div>
                    {listing.link && (
                        <a href={listing.link} target="_blank" rel="noreferrer" aria-label={`Open ${listing.title} at ${listing.company}`}>
                            View
                        </a>
                    )}
                </div>
            ))}
        </div>
    );
}

function hasValue(value) {
    return Boolean(value && !["not specified", "unknown", "n/a"].includes(String(value).trim().toLowerCase()));
}

function Chatbot() {
    const [isOpen, setIsOpen] = useState(false);
    const [isBusy, setIsBusy] = useState(false);
    const [question, setQuestion] = useState("");
    const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || "light");
    const [listings, setListings] = useState(() => window.getInternshipChatData?.() || []);
    const [messages, setMessages] = useState([{
        role: "assistant",
        text: "Welcome to the InternMatch Help Desk. I can help you find internships, use your account, save roles, and apply. For listings, I only use the opportunities currently available on this site."
    }]);
    const transcriptRef = useRef(null);
    const inputRef = useRef(null);
    const launcherRef = useRef(null);
    const responseTimerRef = useRef(null);

    function closeHelpDesk() {
        setIsOpen(false);
        launcherRef.current?.focus();
    }

    useEffect(() => {
        const updateListings = event => setListings(event.detail || window.getInternshipChatData?.() || []);
        window.addEventListener("internships:updated", updateListings);
        setListings(window.getInternshipChatData?.() || []);
        return () => window.removeEventListener("internships:updated", updateListings);
    }, []);

    useEffect(() => {
        const updateTheme = event => setTheme(event.detail || document.documentElement.dataset.theme || "light");
        window.addEventListener("site-theme-change", updateTheme);
        return () => window.removeEventListener("site-theme-change", updateTheme);
    }, []);

    useEffect(() => {
        if (transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }, [messages, isBusy]);

    useEffect(() => {
        if (isOpen) inputRef.current?.focus();
    }, [isOpen]);

    useEffect(() => {
        const openHelpDesk = () => setIsOpen(true);
        window.addEventListener("internmatch:open-helpdesk", openHelpDesk);
        return () => window.removeEventListener("internmatch:open-helpdesk", openHelpDesk);
    }, []);

    useEffect(() => {
        if (!isOpen) return undefined;
        const closeOnEscape = event => {
            if (event.key === "Escape") closeHelpDesk();
        };
        window.addEventListener("keydown", closeOnEscape);
        return () => window.removeEventListener("keydown", closeOnEscape);
    }, [isOpen]);

    useEffect(() => () => window.clearTimeout(responseTimerRef.current), []);

    function sendQuestion(value = question) {
        const submitted = value.trim();
        if (!submitted || isBusy) return;
        const previousAssistantMessage = [...messages].reverse().find(message => message.role === "assistant");
        setMessages(current => [...current, { role: "user", text: submitted }].slice(-MAX_CHAT_MESSAGES));
        setQuestion("");
        setIsBusy(true);
        responseTimerRef.current = window.setTimeout(() => {
            const response = answerQuestion(submitted, listings, previousAssistantMessage);
            setMessages(current => [...current, { role: "assistant", ...response }].slice(-MAX_CHAT_MESSAGES));
            setIsBusy(false);
        }, 320);
    }

    function handleQuestionKeyDown(event) {
        if (event.key === "Enter") {
            event.preventDefault();
            sendQuestion();
        }
    }

    function openHelpPage(pageId) {
        if (document.body.classList.contains("auth-locked") ||
            document.documentElement.classList.contains("is-guest")) {
            sendQuestion("How do I register or sign in?");
            return;
        }
        window.showPage?.(pageId);
        closeHelpDesk();
    }

    return (
        <div className="internmatch-chatbot" data-theme={theme}>
            {isOpen && (
                <section className="chat-panel" role="dialog" aria-modal="false" aria-labelledby="chat-title">
                    <header className="chat-header">
                        <BotAvatar type="clover" face="mouth" size={46} state={isBusy ? "working" : "default"} shading="crisp" interactive={false} seed={0.37} theme={theme} />
                        <div className="chat-heading">
                            <span className="chat-eyebrow">STUDENT SUPPORT</span>
                            <h2 id="chat-title">InternMatch Help Desk</h2>
                            <span>{listings.length ? `${listings.length} current listings · Site guide` : "Site guide · Listing feed unavailable"}</span>
                        </div>
                        <button className="chat-close" type="button" aria-label="Close help desk" onClick={closeHelpDesk}>×</button>
                    </header>

                    <div className="chat-transcript" ref={transcriptRef} aria-live="polite" aria-relevant="additions text">
                        {messages.map((message, index) => (
                            <div className={`chat-message ${message.role}`} key={`${message.role}-${index}`}>
                                <p>{message.text}</p>
                                <ListingLinks listings={message.listings} />
                            </div>
                        ))}
                        {messages.length === 1 && (
                            <div className="chat-suggestions" aria-label="Frequently asked questions">
                                {STARTER_QUESTIONS.map(prompt => (
                                    <button key={prompt} type="button" onClick={() => sendQuestion(prompt)}>{prompt}</button>
                                ))}
                            </div>
                        )}
                        {isBusy && <p className="chat-thinking">Checking the current site data…</p>}
                    </div>

                    <nav className="chat-shortcuts" aria-label="Help desk shortcuts">
                        <button type="button" onClick={() => openHelpPage("preferences")}>Find internships <span aria-hidden="true">↗</span></button>
                        <button type="button" onClick={() => openHelpPage("tracker")}>Application tracker <span aria-hidden="true">↗</span></button>
                        <button type="button" onClick={() => openHelpPage("profile")}>My profile <span aria-hidden="true">↗</span></button>
                    </nav>

                    <form className="chat-compose" onSubmit={event => { event.preventDefault(); sendQuestion(); }}>
                        <label className="sr-only" htmlFor="chat-question">Ask the InternMatch Help Desk</label>
                        <input
                            id="chat-question"
                            ref={inputRef}
                            type="text"
                            value={question}
                            onChange={event => setQuestion(event.target.value)}
                            onKeyDown={handleQuestionKeyDown}
                            placeholder="How can we help?"
                            maxLength={400}
                        />
                        <button type="button" aria-label="Send message" onClick={() => sendQuestion()} disabled={!question.trim() || isBusy}>↑</button>
                    </form>
                </section>
            )}
            <button
                className="chat-launcher"
                ref={launcherRef}
                type="button"
                aria-label={isOpen ? "Close InternMatch Help Desk" : "Open InternMatch Help Desk"}
                aria-expanded={isOpen}
                title={isOpen ? "Close InternMatch assistant" : "Open InternMatch assistant"}
                onClick={() => isOpen ? closeHelpDesk() : setIsOpen(true)}
            >
                <BotAvatar type="clover" size={48} state={isBusy ? "working" : "default"} shading="crisp" interactive={false} seed={0.37} theme={theme} />
            </button>
        </div>
    );
}

createRoot(document.getElementById("theme-toggle-root")).render(<ThemeToggle />);
createRoot(document.getElementById("chatbot-root")).render(<Chatbot />);