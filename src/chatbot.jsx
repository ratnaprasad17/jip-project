import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { BotAvatar } from "bot-avatars";
import { Moon, Sun } from "lucide-react";
import "./chatbot.css";

const MAX_CHAT_MESSAGES = 40;
const STARTER_QUESTIONS = [
    "Show online internships",
    "How do I apply?",
    "How are matches scored?"
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
    return listings.map(listing => {
        let score = listing.type === preferences.type ? 35 : 0;
        if (preferences.branch && listing.branch?.toLowerCase() === preferences.branch.toLowerCase()) score += 25;
        if (preferences.specialization && listing.specialization?.toLowerCase() === preferences.specialization.toLowerCase()) score += 30;
        if (preferences.location && listing.location?.toLowerCase().includes(preferences.location)) score += 10;
        const listingSkills = (listing.skills || []).map(skill => skill.toLowerCase());
        score += preferences.skills.filter(skill => listingSkills.includes(skill)).length * 5;
        return { ...listing, score: Math.min(score, 100) };
    }).sort((left, right) => right.score - left.score || Number(right.isIndia) - Number(left.isIndia));
}

function answerQuestion(question, listings, previousAssistantMessage) {
    const query = question.toLowerCase().replace(/[’']/g, "'").trim();
    if (/\b(only one|just one|that's all|any more|more\?)\b/.test(query) && previousAssistantMessage?.listings?.length) {
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
    if (/\b(apply|application|apply link)\b/.test(query)) {
        return {
            text: "Simple ga: internship card lo Details or Apply click cheyyi. Apply employer page open chestundi. Link lekapothe, listing lo available ani chupistundi."
        };
    }
    if (/\b(saved internships?|saved jobs?|saved roles?|favorites?|favourites?|bookmarks?|save (?:this|an? internship|a job))\b/.test(query)) {
        const savedListings = listings.filter(listing => listing.isSaved);
        return savedListings.length
            ? { text: `You have ${savedListings.length} saved internship${savedListings.length === 1 ? "" : "s"}.`, listings: savedListings.slice(0, 5) }
            : { text: "Inka internships save cheyyaledu. Card meeda heart click cheyyi; avi menu lo Saved kindha kanipistayi." };
    }
    if (/\b(profile|edit my details|update my details|my account details)\b/.test(query)) {
        return { text: "My Profile open chesi Edit profile click cheyyi. Name, phone, college, roll number, skills, location marchi Save profile nokku." };
    }
    if (/\b(register|registration|sign up|account|approval|approve|login|log in|password)\b/.test(query)) {
        return {
            text: "New student ayithe Register here click chesi details fill cheyyi. Admin approve chesaka login avvachu. Password marchipothe Forgot password click cheyyi." 
        };
    }
    if (/\b(match|matching|recommend|recommendation|score|preferences)\b/.test(query)) {
        if (!listings.length) {
            return { text: "I can't calculate recommendations yet because no current internships are loaded. Try again after the listings sync to this site." };
        }
        return {
            text: "Find Internship page lo branch, skills, location, work mode select cheyyi. Avi match ayye roles ki ekkuva score vastundi. Graduation-year info feeds lo ledu.",
            listings: rankListings(listings).slice(0, 3)
        };
    }

    if (/\b(source|sources|job board|job boards|updated|refresh|sync|new listings)\b/.test(query)) {
        const companies = [...new Set(listings.map(listing => listing.company).filter(Boolean))].sort();
        return listings.length
            ? { text: `The site currently has ${listings.length} synced listings from ${companies.length} employers: ${companies.join(", ")}. Feeds refresh through the scheduled sync; availability depends on each employer's live board.` }
            : { text: "No internship listings are currently loaded. The scheduled feed must run successfully before I can list employers or openings." };
    }

    if (/\b(latest|newest|recent|most recent)\b/.test(query)) {
        const recentListings = [...listings].sort((left, right) =>
            String(right.postedDate || "").localeCompare(String(left.postedDate || ""))
        );
        const withDates = recentListings.filter(listing => listing.postedDate);
        return withDates.length
            ? { text: "Here are the most recently dated listings. Dates are shown only when the employer feed supplies them.", listings: withDates.slice(0, 5) }
            : { text: "The current feeds don't provide posting dates, so I can't reliably rank these by recency.", listings: listings.slice(0, 3) };
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

    const skills = [...new Set(listings.flatMap(listing => listing.skills || []))]
        .sort((left, right) => right.length - left.length);
    const requestedSkill = skills.find(skill => query.includes(skill.toLowerCase()));
    if (requestedSkill) {
        const matches = listings.filter(listing =>
            (listing.skills || []).some(skill => skill.toLowerCase() === requestedSkill.toLowerCase())
        );
        return { text: `These current listings mention ${requestedSkill}.`, listings: matches.slice(0, 5) };
    }
    if (/\bskills?\b/.test(query)) {
        const listingsWithSkills = listings.filter(listing => listing.skills?.length);
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

    if (/\b(branch|branches|eligible|eligibility)\b/.test(query)) {
        const specifiedListings = listings.filter(listing =>
            listing.branch && !["not specified", "all branches"].includes(listing.branch.toLowerCase())
        );
        return specifiedListings.length
            ? { text: "These listings include branch information from their source.", listings: specifiedListings.slice(0, 5) }
            : { text: "The configured job boards don't provide branch eligibility in their feed. Check each employer's original posting before applying.", listings: listings.slice(0, 5) };
    }

    if (/\b(deadline|closing date|application closes|when does it close)\b/.test(query)) {
        const datedListings = listings.filter(listing => listing.closingDate);
        return datedListings.length
            ? { text: "Closing dates supplied by the source are shown here.", listings: datedListings.slice(0, 5) }
            : { text: "The current source feeds do not provide application closing dates for these listings. Check the original application page before applying.", listings: listings.slice(0, 3) };
    }

    if (/\b(online|remote|work from home)\b/.test(query)) {
        const online = listings.filter(listing => listing.type === "Online");
        const unspecified = listings.filter(listing => ["Not specified", "Hybrid"].includes(listing.type));
        return online.length
            ? { text: `I found ${online.length} current online/remote listings.`, listings: online.slice(0, 5) }
            : unspecified.length
                ? { text: `No listings are explicitly marked online. ${unspecified.length} don't state a work mode; check their original postings.`, listings: unspecified.slice(0, 5) }
                : { text: "There are no online/remote internships in the current site feed." };
    }
    if (/\b(offline|onsite|on-site|in person)\b/.test(query)) {
        const offline = listings.filter(listing => listing.type === "Offline");
        const unspecified = listings.filter(listing => ["Not specified", "Hybrid"].includes(listing.type));
        return offline.length
            ? { text: `I found ${offline.length} current on-site listings.`, listings: offline.slice(0, 5) }
            : unspecified.length
                ? { text: `No listings are explicitly marked on-site. ${unspecified.length} don't state a work mode; check their original postings.`, listings: unspecified.slice(0, 5) }
                : { text: "There are no on-site internships in the current site feed." };
    }
    if (/\bhybrid\b/.test(query)) {
        const hybrid = listings.filter(listing => listing.type === "Hybrid");
        const unspecified = listings.filter(listing => listing.type === "Not specified");
        return hybrid.length
            ? { text: `I found ${hybrid.length} listings explicitly marked hybrid.`, listings: hybrid.slice(0, 5) }
            : unspecified.length
                ? { text: `No listings are explicitly marked hybrid. ${unspecified.length} don't state a work mode; check their original postings.`, listings: unspecified.slice(0, 5) }
                : { text: "There are no hybrid internships in the current site feed." };
    }
    if (/\b(stipend|salary|pay|paid)\b/.test(query)) {
        return listings.length
            ? { text: "The site only shows stipend information when the original listing provides it.", listings: listings.slice(0, 5) }
            : { text: "No current internship listings are loaded, so I can't confirm stipend information." };
    }
    if (/\b(internship|internships|opening|openings|listing|listings|jobs|roles|company|companies|available)\b/.test(query)) {
        return listings.length
            ? { text: `There are ${listings.length} current internships loaded from the configured job boards.`, listings: listings.slice(0, 5) }
            : { text: "There are no current internships loaded on the site right now. The scheduled feed needs to run and publish its results before I can recommend roles." };
    }
    if (/\b(hello|hi|hey|help)\b/.test(query)) {
        return { text: "Hi, I can search live listings by company, title, skill, location, or work mode; show saved internships; explain matching; and guide you through your profile, registration, and applying." };
    }

    return {
        text: "Ee question ki site data lo answer dorakaledu. Company, role, skill, India, online, saved internships, profile, apply gurinchi adugu. Employer feed lo leni details ni guess cheyyanu."
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
        text: "Hi, I'm the InternMatch assistant. I answer from this site's current internship listings and published site information."
    }]);
    const transcriptRef = useRef(null);
    const inputRef = useRef(null);

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

    function sendQuestion(value = question) {
        const submitted = value.trim();
        if (!submitted || isBusy) return;
        const previousAssistantMessage = [...messages].reverse().find(message => message.role === "assistant");
        setMessages(current => [...current, { role: "user", text: submitted }].slice(-MAX_CHAT_MESSAGES));
        setQuestion("");
        setIsBusy(true);
        window.setTimeout(() => {
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

    return (
        <div className="internmatch-chatbot" data-theme={theme}>
            {isOpen && (
                <section className="chat-panel" role="dialog" aria-modal="false" aria-labelledby="chat-title">
                    <header className="chat-header">
                        <BotAvatar type="clover" face="mouth" size={44} state={isBusy ? "working" : "default"} shading="crisp" interactive={false} seed={0.37} theme={theme} />
                        <div className="chat-heading">
                            <h2 id="chat-title">InternMatch Assistant</h2>
                            <span>{listings.length ? `${listings.length} current listings` : "Site guide"}</span>
                        </div>
                        <button className="chat-close" type="button" aria-label="Close chat" onClick={() => setIsOpen(false)}>×</button>
                    </header>

                    <div className="chat-transcript" ref={transcriptRef} aria-live="polite" aria-relevant="additions text">
                        {messages.map((message, index) => (
                            <div className={`chat-message ${message.role}`} key={`${message.role}-${index}`}>
                                <p>{message.text}</p>
                                <ListingLinks listings={message.listings} />
                            </div>
                        ))}
                        {messages.length === 1 && (
                            <div className="chat-suggestions" aria-label="Suggested questions">
                                {STARTER_QUESTIONS.map(prompt => (
                                    <button key={prompt} type="button" onClick={() => sendQuestion(prompt)}>{prompt}</button>
                                ))}
                            </div>
                        )}
                        {isBusy && <p className="chat-thinking">Checking the current site data…</p>}
                    </div>

                    <form className="chat-compose" onSubmit={event => { event.preventDefault(); sendQuestion(); }}>
                        <label className="sr-only" htmlFor="chat-question">Ask about internships</label>
                        <input
                            id="chat-question"
                            ref={inputRef}
                            type="text"
                            value={question}
                            onChange={event => setQuestion(event.target.value)}
                            onKeyDown={handleQuestionKeyDown}
                            placeholder="Ask about internships…"
                            maxLength={400}
                        />
                        <button type="button" aria-label="Send message" onClick={() => sendQuestion()} disabled={!question.trim() || isBusy}>↑</button>
                    </form>
                </section>
            )}
            <button
                className="chat-launcher"
                type="button"
                aria-label={isOpen ? "Close InternMatch assistant" : "Open InternMatch assistant"}
                aria-expanded={isOpen}
                title={isOpen ? "Close assistant" : "Chat with InternMatch"}
                onClick={() => setIsOpen(open => !open)}
            >
                <BotAvatar type="clover" size={48} state={isBusy ? "working" : "default"} shading="crisp" interactive={false} seed={0.37} theme={theme} />
            </button>
        </div>
    );
}

createRoot(document.getElementById("theme-toggle-root")).render(<ThemeToggle />);
createRoot(document.getElementById("chatbot-root")).render(<Chatbot />);