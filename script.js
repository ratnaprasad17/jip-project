/* =========================================================
   INTERNSHIP DATA
========================================================= */
let internships = [];
const LEGACY_DEMO_LISTINGS = [
    { id: 1, title: "Machine Learning Intern", company: "TechNova AI" },
    { id: 2, title: "Data Science Intern", company: "DataWorks" },
    { id: 3, title: "Web Development Intern", company: "WebCraft Solutions" },
    { id: 4, title: "AI Research Intern", company: "FutureAI Labs" },
    { id: 5, title: "Cyber Security Intern", company: "SecureNet" },
    { id: 6, title: "Cloud Computing Intern", company: "CloudSphere" }
];
const INDIA_CITY_PATTERN = /\b(?:bengaluru|bangalore|hyderabad|mumbai|pune|chennai|gurugram|gurgaon|noida|new delhi|delhi|kolkata|ahmedabad|jaipur|kochi|cochin|thiruvananthapuram|visakhapatnam|vizag|lucknow|indore|bhubaneswar|mysuru|mysore|mangaluru|mangalore|coimbatore|nagpur|chandigarh|surat|vadodara|bhopal|patna|kanpur|ghaziabad|dehradun|goa)\b/i;

function isIndiaBasedListing(internship) {
    const location = String(internship.location || "");
    return /\bindia\b/i.test(location) || INDIA_CITY_PATTERN.test(location);
}

function sortIndiaFirst(listings) {
    return [...listings].sort((left, right) => {
        const indiaOrder = Number(isIndiaBasedListing(right)) - Number(isIndiaBasedListing(left));
        if (indiaOrder) return indiaOrder;
        return String(right.postedDate || "").localeCompare(String(left.postedDate || ""));
    });
}

function isLegacyDemoListing(internship) {
    return !internship._sourceKey && LEGACY_DEMO_LISTINGS.some(sample =>
        internship.id === sample.id && internship.title === sample.title && internship.company === sample.company
    );
}

function isCurrentListing(internship) {
    const today = getLocalDateString();
    if (internship.closingDate && internship.closingDate < today) return false;
    if (internship._sourceKey && internship.postedDate) {
        const cutoff = new Date(`${today}T00:00:00.000Z`);
        cutoff.setUTCDate(cutoff.getUTCDate() - 90);
        if (internship.postedDate < cutoff.toISOString().slice(0, 10)) return false;
    }
    return !isLegacyDemoListing(internship);
}

function getWorkTypeFromLocation(location) {
    const normalized = String(location || "").toLowerCase();
    if (/remote|work from home|anywhere|virtual/.test(normalized)) return "Online";
    if (/hybrid/.test(normalized)) return "Hybrid";
    if (/on[- ]site|onsite|in[- ]person|office[- ]based/.test(normalized)) return "Offline";
    return "Not specified";
}

function getCachedRoleDescription(description) {
    const original = String(description || "");
    let text = original;
    for (let pass = 0; pass < 2; pass += 1) {
        const parsed = new DOMParser().parseFromString(text, "text/html");
        const decoded = parsed.body.textContent || "";
        if (decoded === text) break;
        text = decoded;
    }

    const roleStart = text.match(/what you[’']ll do\s*/i);
    if (roleStart) text = text.slice(roleStart.index + roleStart[0].length);
    if (/&lt;|<\/?(?:h[1-6]|p|ul|li)\b/i.test(original)) {
        if (!roleStart) return "Open the original posting for role responsibilities and requirements.";
    }
    return text
        .replace(/(Responsibilities|Who you are|Minimum requirements|Preferred qualifications)/gi, " $1 ")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeImportedListing(internship) {
    if (!internship._sourceKey) return internship;
    return {
        ...internship,
        type: ["Online", "Offline", "Hybrid"].includes(internship.type)
            ? internship.type
            : getWorkTypeFromLocation(internship.location),
        branch: internship.branch === "All branches" ? "Not specified" : internship.branch,
        description: getCachedRoleDescription(internship.description)
    };
}

function getInternshipChatData() {
    return sortIndiaFirst(internships).map(internship => ({
        id: internship.id,
        title: internship.title,
        company: internship.company,
        isSaved: bookmarks.some(bookmarkId => String(bookmarkId) === String(internship.id)),
        isIndia: isIndiaBasedListing(internship),
        type: internship.type,
        branch: internship.branch === "All branches" ? "Not specified" : internship.branch,
        specialization: internship.specialization,
        location: internship.location,
        stipend: internship.stipend,
        duration: internship.duration,
        skills: Array.isArray(internship.skills) ? [...internship.skills] : [],
        postedDate: internship.postedDate || "",
        closingDate: internship.closingDate || "",
        description: internship.description || "",
        link: getSafeApplicationUrl(internship.link)
    }));
}

window.getInternshipChatData = getInternshipChatData;

function publishInternshipUpdates() {
    window.dispatchEvent(new CustomEvent("internships:updated", {
        detail: getInternshipChatData()
    }));
}

/* =========================================================
   FIREBASE CONFIG
========================================================= */
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCFrKocy8aBo5JFU5IuKtD7wcRvzzZnqAQ",
    authDomain: "internmatch--07.firebaseapp.com",
    databaseURL: "https://internmatch--07-default-rtdb.firebaseio.com",
    projectId: "internmatch--07",
    storageBucket: "internmatch--07.firebasestorage.app",
    messagingSenderId: "949407159984",
    appId: "1:949407159984:web:bed66833d63aca1d410d75",
    measurementId: "G-XXMRD3NLJL"
};

let firebaseInternshipRef = null;
let currentStudent = null;
try {
    const cachedStudent = window.__PRELOADED_STUDENT__ || JSON.parse(localStorage.getItem("studentSession"));
    if (cachedStudent && cachedStudent.status === "approved") {
        currentStudent = cachedStudent;
        document.body?.classList.remove("auth-locked");
    }
} catch (error) {
    currentStudent = null;
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function escapeInlineString(value) {
    return escapeHTML(JSON.stringify(String(value)));
}

function hasPublishedValue(value) {
    const normalized = String(value || "").trim().toLowerCase();
    return normalized !== "" && !["not specified", "unknown", "n/a"].includes(normalized);
}

function getSafeApplicationUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === "https:" ? url.href : "";
    } catch (error) {
        return "";
    }
}

function findInternshipById(id) {
    const targetId = String(id);
    return internships.find(internship => String(internship.id) === targetId);
}

function saveStudentSession(student) {
    currentStudent = student;
    try {
        localStorage.setItem("studentSession", JSON.stringify(student));
        document.documentElement.classList.remove("is-guest");
        document.documentElement.classList.add("is-authenticated");
    } catch (error) {
        console.warn("Could not save student session locally.", error);
    }
}

function clearStudentSession() {
    currentStudent = null;
    try {
        localStorage.removeItem("studentSession");
        document.documentElement.classList.remove("is-authenticated");
        document.documentElement.classList.add("is-guest");
    } catch (error) {}
}

function updateStudentProfile() {
    const student = currentStudent;
    if (!student) return;
    currentStudent = student;
    document.getElementById("profileName").innerText = student.name || "Student";
    document.getElementById("profileEmail").innerText = student.email || "";
    document.getElementById("profileAvatar").innerText = (student.name || "S").charAt(0).toUpperCase();

    const skillsText = Array.isArray(student.skills) ? student.skills.join(", ") : (student.skills || "");
    const skillsChips = skillsText
        ? skillsText.split(",").map(s => `<span class="tag" style="margin-right:4px;margin-bottom:4px;display:inline-block;">${escapeHTML(s.trim())}</span>`).join("")
        : "<span style='color:#94a3b8;'>No skills added yet</span>";

    const linksList = [];
    if (student.linkedin) {
        linksList.push(`<a href="${escapeHTML(student.linkedin)}" target="_blank" rel="noopener noreferrer" class="profile-social-link">🔗 LinkedIn</a>`);
    }
    if (student.github) {
        linksList.push(`<a href="${escapeHTML(student.github)}" target="_blank" rel="noopener noreferrer" class="profile-social-link">🐙 GitHub</a>`);
    }
    if (student.portfolio) {
        linksList.push(`<a href="${escapeHTML(student.portfolio)}" target="_blank" rel="noopener noreferrer" class="profile-social-link">📄 Portfolio / Resume</a>`);
    }

    const profileFields = [
        ["College / Institution", student.college || "Sri Vasavi Engineering College"],
        ["Degree & Branch", `${student.degree || "B.Tech"} • ${student.branch || "Engineering"}`],
        ["Roll Number", student.rollNumber || "Not added"],
        ["Graduation Year", student.gradYear || "Not added"],
        ["CGPA / Score", student.cgpa || "Not added"],
        ["Phone Number", student.phone || "Not added"],
        ["Preferred Location", `${student.preferredLocation || "Flexible"} (${student.workMode || "Any mode"})`],
        ["Account Status", student.status === "approved" ? "✅ Approved Student" : "⏳ Pending Approval"]
    ];

    let html = profileFields.map(([label, value]) =>
        `<div><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong></div>`
    ).join("");

    html += `<div style="grid-column: 1 / -1;"><span>Technical Skills</span><div style="margin-top:6px;">${skillsChips}</div></div>`;

    if (linksList.length) {
        html += `<div style="grid-column: 1 / -1;"><span>Professional Profiles & Links</span><div style="display:flex;gap:10px;margin-top:8px;flex-wrap:wrap;">${linksList.join("")}</div></div>`;
    }

    if (student.bio) {
        html += `<div style="grid-column: 1 / -1;"><span>About Me / Objective</span><p style="margin-top:4px;font-size:13.5px;color:#334155;line-height:1.5;">${escapeHTML(student.bio)}</p></div>`;
    }

    document.getElementById("profileDetails").innerHTML = html;

    // Update Email Alerts Card status
    const alertsCard = document.getElementById("profileAlertsCard");
    const alertBadge = document.getElementById("profileAlertStatusBadge");
    const alertText = document.getElementById("profileAlertStatusText");
    if (alertsCard && alertBadge && alertText) {
        const isAlertEnabled = student.emailAlertsEnabled === true;
        const freq = student.emailAlertFrequency || "daily";
        const filterType = student.emailAlertFilter || "branch";
        const freqText = freq === "instant" ? "Instant" : freq === "weekly" ? "Weekly Summary" : "Daily Digest";
        const filterText = filterType === "all" ? "all verified openings" : `opportunities matching ${student.branch || "your branch"}`;

        if (isAlertEnabled) {
            alertBadge.innerText = `Active (${freqText})`;
            alertBadge.style.background = "#dcfce7";
            alertBadge.style.color = "#15803d";
            alertText.innerHTML = `Delivering digests of ${escapeHTML(filterText)} directly to <strong>${escapeHTML(student.email || "")}</strong>.`;
        } else {
            alertBadge.innerText = "Paused";
            alertBadge.style.background = "#fee2e2";
            alertBadge.style.color = "#991b1b";
            alertText.innerText = "Email alerts are currently paused. You can enable them anytime by editing your profile.";
        }
    }
}

function beginProfileEdit() {
    if (!currentStudent) return;
    document.getElementById("profileMessage").innerText = "";
    document.getElementById("profileNameInput").value = currentStudent.name || "";
    document.getElementById("profilePhoneInput").value = currentStudent.phone || "";
    document.getElementById("profileRollNumberInput").value = currentStudent.rollNumber || "";
    document.getElementById("profileCollegeInput").value = currentStudent.college || "";
    document.getElementById("profileDegreeInput").value = currentStudent.degree || "";
    document.getElementById("profileBranchInput").value = currentStudent.branch || "";
    document.getElementById("profileGradYearInput").value = currentStudent.gradYear || "";
    document.getElementById("profileCgpaInput").value = currentStudent.cgpa || "";
    document.getElementById("profileSkillsInput").value = Array.isArray(currentStudent.skills)
        ? currentStudent.skills.join(", ")
        : currentStudent.skills || "";
    document.getElementById("profileLocationInput").value = currentStudent.preferredLocation || "";
    if (document.getElementById("profileWorkModeInput")) {
        document.getElementById("profileWorkModeInput").value = currentStudent.workMode || "Any";
    }
    document.getElementById("profileLinkedinInput").value = currentStudent.linkedin || "";
    document.getElementById("profileGithubInput").value = currentStudent.github || "";
    document.getElementById("profilePortfolioInput").value = currentStudent.portfolio || "";
    document.getElementById("profileBioInput").value = currentStudent.bio || "";

    if (document.getElementById("profileEmailAlertsInput")) {
        document.getElementById("profileEmailAlertsInput").checked = currentStudent.emailAlertsEnabled === true;
    }
    if (document.getElementById("profileEmailFreqInput")) {
        document.getElementById("profileEmailFreqInput").value = currentStudent.emailAlertFrequency || "daily";
    }
    if (document.getElementById("profileEmailFilterInput")) {
        document.getElementById("profileEmailFilterInput").value = currentStudent.emailAlertFilter || "branch";
    }

    document.getElementById("profileDetails").hidden = true;
    document.getElementById("profileEditToggle").hidden = true;
    document.getElementById("profileEditForm").hidden = false;
    document.getElementById("profileNameInput").focus();
}

function cancelProfileEdit() {
    document.getElementById("profileEditForm").hidden = true;
    document.getElementById("profileDetails").hidden = false;
    document.getElementById("profileEditToggle").hidden = false;
    document.getElementById("profileMessage").innerText = "";
}

async function saveStudentProfile(event) {
    const form = event.currentTarget;
    const saveButton = form.querySelector("button[type='submit']");
    const message = document.getElementById("profileMessage");
    const user = firebase.apps.length ? firebase.auth().currentUser : null;
    if (!user || !currentStudent) {
        message.innerText = "Sign in again before updating your profile.";
        return;
    }

    const updates = {
        name: document.getElementById("profileNameInput").value.trim(),
        phone: document.getElementById("profilePhoneInput").value.trim(),
        rollNumber: document.getElementById("profileRollNumberInput").value.trim().toUpperCase(),
        college: document.getElementById("profileCollegeInput").value.trim(),
        degree: document.getElementById("profileDegreeInput").value.trim(),
        branch: document.getElementById("profileBranchInput").value.trim(),
        gradYear: document.getElementById("profileGradYearInput").value.trim(),
        cgpa: document.getElementById("profileCgpaInput").value.trim(),
        skills: document.getElementById("profileSkillsInput").value.trim(),
        preferredLocation: document.getElementById("profileLocationInput").value.trim(),
        workMode: document.getElementById("profileWorkModeInput")?.value || "Any",
        linkedin: document.getElementById("profileLinkedinInput").value.trim(),
        github: document.getElementById("profileGithubInput").value.trim(),
        portfolio: document.getElementById("profilePortfolioInput").value.trim(),
        bio: document.getElementById("profileBioInput").value.trim(),
        emailAlertsEnabled: document.getElementById("profileEmailAlertsInput") ? document.getElementById("profileEmailAlertsInput").checked : false,
        emailAlertFrequency: document.getElementById("profileEmailFreqInput")?.value || "daily",
        emailAlertFilter: document.getElementById("profileEmailFilterInput")?.value || "branch"
    };
    if (!updates.name) return;

    saveButton.disabled = true;
    saveButton.innerText = "Saving...";
    message.innerText = "";
    const database = firebase.database();
    const reservedIndices = [];
    let profileSaved = false;
    try {
        const oldPhone = String(currentStudent.phone || "").replace(/\D/g, "").slice(-10);
        const newPhone = updates.phone.replace(/\D/g, "").slice(-10);
        const oldRollKey = String(currentStudent.rollNumber || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
        const newRollKey = updates.rollNumber.replace(/[^A-Z0-9]/g, "");
        const changedIndices = [];

        if (newPhone !== oldPhone) {
            if (newPhone.length !== 10) {
                message.innerText = "Please enter a valid 10-digit mobile number.";
                return;
            }
            changedIndices.push({
                ref: database.ref(`unique_indices/phones/${newPhone}`),
                oldKey: oldPhone ? database.ref(`unique_indices/phones/${oldPhone}`) : null
            });
            updates.phone = newPhone;
        }
        if (newRollKey !== oldRollKey) {
            if (newRollKey.length < 4) {
                message.innerText = "Please enter a valid Roll Number.";
                return;
            }
            changedIndices.push({
                ref: database.ref(`unique_indices/rolls/${newRollKey}`),
                oldKey: oldRollKey ? database.ref(`unique_indices/rolls/${oldRollKey}`) : null
            });
        }

        for (const index of changedIndices) {
            const existing = await index.ref.once("value");
            if (existing.exists() && existing.val() !== user.uid) {
                throw new Error("This phone number or Roll Number is already registered.");
            }
            if (!existing.exists()) {
                reservedIndices.push(index.ref);
                const reservation = await index.ref.transaction(current => current === null ? user.uid : undefined);
                if (!reservation.committed) {
                    throw new Error("This phone number or Roll Number is already registered.");
                }
            }
        }

        await database.ref(`students/${user.uid}`).update(updates);
        profileSaved = true;
        currentStudent = { ...currentStudent, ...updates };
        saveStudentSession(currentStudent);
        updateStudentProfile();
        cancelProfileEdit();
        for (const index of changedIndices) {
            if (index.oldKey) {
                await index.oldKey.transaction(current => current === user.uid ? null : undefined);
            }
        }
        message.innerText = "Profile updated successfully! ✅";
    } catch (error) {
        if (!profileSaved) {
            for (const indexRef of reservedIndices) {
                try {
                    await indexRef.transaction(current => current === user.uid ? null : undefined);
                } catch (cleanupError) {
                    console.error("Failed to release a profile uniqueness reservation:", cleanupError);
                }
            }
        }
        message.innerText = profileSaved
            ? `Profile updated, but a previous uniqueness index could not be released: ${getFirebaseErrorMessage(error)}`
            : getFirebaseErrorMessage(error);
    } finally {
        saveButton.disabled = false;
        saveButton.innerText = "Save profile";
    }
}

function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function removeExpiredInternships() {
    const today = getLocalDateString();
    const activeInternships = internships.filter(isCurrentListing);
    if (activeInternships.length === internships.length) return false;

    const activeIds = new Set(activeInternships.map(internship => String(internship.id)));
    internships = activeInternships;
    bookmarks = bookmarks.filter(id => activeIds.has(String(id)));
    localStorage.setItem("bookmarks", JSON.stringify(bookmarks));
    return true;
}

/* Load saved internships */
try {
    const savedInternships = JSON.parse(localStorage.getItem("internships"));
    if (Array.isArray(savedInternships)) internships = savedInternships
        .map(normalizeImportedListing)
        .filter(isCurrentListing);
} catch (error) {
    console.warn("Saved internships could not be loaded.", error);
}

function isFirebaseConfigured() {
    return FIREBASE_CONFIG.apiKey !== "PASTE_API_KEY_HERE" &&
        FIREBASE_CONFIG.projectId !== "PASTE_PROJECT_ID_HERE" &&
        FIREBASE_CONFIG.databaseURL !== "PASTE_DATABASE_URL_HERE";
}

/* =========================================================
   LOADING SCREEN HELPERS
========================================================= */
function showLoader(text = "Logging you in...") {
    document.documentElement.classList.add("showing-loader");
    const overlay = document.getElementById("loadingOverlay");
    if (!overlay) return;
    const loaderText = document.getElementById("loaderText");
    const content = overlay.querySelector(".loader-content");

    content.classList.remove("success");
    loaderText.innerText = text;
    overlay.classList.add("show");
}

function updateLoaderText(text) {
    const loaderText = document.getElementById("loaderText");
    if (loaderText) loaderText.innerText = text;
}

function showLoaderSuccess(text = "Welcome!", callback) {
    const overlay = document.getElementById("loadingOverlay");
    if (!overlay) { if (callback) callback(); return; }
    const loaderText = document.getElementById("loaderText");
    const content = overlay.querySelector(".loader-content");

    content.classList.add("success");
    loaderText.innerText = text;
    overlay.classList.add("show");

    setTimeout(() => {
        hideLoader();
        if (typeof callback === "function") callback();
    }, 900);
}

function hideLoader() {
    const overlay = document.getElementById("loadingOverlay");
    if (overlay) overlay.classList.remove("show");
    document.documentElement.classList.remove("showing-loader");
}

/* =========================================================
   AUTH GATE HANDLERS
========================================================= */
function showRegistration() {
    document.body.classList.add("auth-locked");
    document.body.classList.remove("founder-login");
    document.getElementById("authGate").hidden = false;
    document.getElementById("studentLoginForm").hidden = true;
    document.getElementById("studentRegistrationForm").hidden = false;
    document.getElementById("studentLoginMessage").innerText = "";
    document.getElementById("authSubtitle").innerText = "Register first. The founder must approve your account.";
}

function showStudentLogin() {
    document.body.classList.add("auth-locked");
    document.body.classList.remove("founder-login");
    document.getElementById("authGate").hidden = false;
    document.getElementById("studentLoginForm").hidden = false;
    document.getElementById("studentRegistrationForm").hidden = true;
    document.getElementById("authSubtitle").innerText = "Login with an approved student account.";
    const submitButton = document.querySelector("#studentLoginForm button[type='submit']");
    if (submitButton) {
        submitButton.disabled = false;
        submitButton.innerText = "Student Login";
    }
}

function togglePassword(inputId, toggleButton) {
    const input = document.getElementById(inputId);
    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    toggleButton.setAttribute("aria-label", showing ? "Show password" : "Hide password");
    toggleButton.setAttribute("title", showing ? "Show password" : "Hide password");
}

function openFounderLogin() {
    document.documentElement.classList.remove("is-guest");
    document.body.classList.remove("auth-locked");
    document.body.classList.add("founder-login");
    const gate = document.getElementById("authGate");
    if (gate) gate.hidden = true;
    document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));
    document.getElementById("admin").classList.add("active");
    showPage("admin");
}

function returnToStudentLogin() {
    setAdminAuthenticated(false);
    sessionStorage.removeItem("adminAuth");
    document.documentElement.classList.remove("is-authenticated");
    document.documentElement.classList.add("is-guest");
    document.body.classList.remove("founder-login");
    document.body.classList.add("auth-locked");
    const gate = document.getElementById("authGate");
    if (gate) gate.hidden = false;
    showStudentLogin();
}

/* =========================================================
   FIREBASE HELPERS
========================================================= */
function ensureFirebase() {
    if (!isFirebaseConfigured()) throw new Error("Firebase is not configured yet.");
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    return firebase.database();
}

function getFirebaseErrorMessage(error) {
    if (error && error.code === "auth/invalid-email") {
        return "Enter a valid student email address.";
    }
    if (error && error.code === "auth/user-disabled") {
        return "This student account has been disabled. Contact the founder.";
    }
    if (error && error.code === "auth/operation-not-allowed") {
        return "Email/password login is disabled. Enable it in Firebase Authentication settings.";
    }
    if (error && error.code === "auth/network-request-failed") {
        return "Firebase could not connect. Check your internet connection and try again.";
    }
    if (error && error.code === "auth/too-many-requests") {
        return "Too many login attempts. Wait a moment and try again.";
    }
    if (error && error.code === "auth/configuration-not-found") {
        return "Firebase Authentication is not enabled. Enable Email/Password in Firebase Console.";
    }
    if (error && error.code === "auth/invalid-credential") {
        return "The Firebase admin email or password is incorrect.";
    }
    if (error && error.code === "auth/admin-restricted-operation") {
        return "Firebase Anonymous sign-in is disabled. Enable it in Firebase Console.";
    }
    if (error && error.code === "auth/email-already-in-use") {
        return "This email address is already registered. Please go back and sign in.";
    }
    if (error && (error.code === "PERMISSION_DENIED" || error.code === "database/permission-denied")) {
        return "Firebase denied access. Update the Realtime Database rules.";
    }
    return error.message;
}

async function ensureAdminFirebaseSession() {
    if (!isFirebaseConfigured()) throw new Error("Firebase is not configured yet.");
    ensureFirebase();
    const user = firebase.auth().currentUser;
    if (!user) throw new Error("Sign in with an administrator account first.");
    const snapshot = await firebase.database().ref(`admins/${user.uid}`).once("value");
    if (snapshot.val() !== true) throw new Error("This account is not approved for administrator access.");
    return user;
}

/* =========================================================
   STUDENT REGISTRATION & LOGIN
========================================================= */
async function registerStudent() {
    const message = document.getElementById("registrationMessage");
    const submitBtn = document.querySelector("#studentRegistrationForm button[type='submit']");
    if (!isFirebaseConfigured()) {
        message.innerText = "Student registration requires the configured Firebase project.";
        return;
    }

    const name = (document.getElementById("registerName")?.value || "").trim();
    const email = (document.getElementById("registerEmail")?.value || "").trim().toLowerCase();
    const phone = (document.getElementById("registerPhone")?.value || "").trim();
    const branch = (document.getElementById("registerBranch")?.value || "").trim();
    const rollNumber = (document.getElementById("registerRoll")?.value || "").trim().toUpperCase();
    const password = document.getElementById("registerPassword")?.value || "";

    if (!name || !email || !phone || !rollNumber || !password) {
        message.innerText = "Please fill in all registration fields.";
        return;
    }

    // Format validation
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 10) {
        message.innerText = "Please enter a valid 10-digit mobile number.";
        return;
    }
    const cleanPhone = phoneDigits.slice(-10);

    const rollKey = rollNumber.replace(/[^A-Z0-9]/g, "");
    if (rollKey.length < 4) {
        message.innerText = "Please enter a valid Roll Number.";
        return;
    }

    let registrationUser = null;
    let registrationUid = "";
    let profileSaved = false;
    const reservedIndices = [];
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = "Creating student account...";
    }
    message.innerText = "";

    try {
        ensureFirebase();
        const credential = await firebase.auth().createUserWithEmailAndPassword(email, password);
        registrationUser = credential.user;
        registrationUid = registrationUser.uid;

        const database = firebase.database();
        const rollRef = database.ref(`unique_indices/rolls/${rollKey}`);
        const phoneRef = database.ref(`unique_indices/phones/${cleanPhone}`);
        const [rollSnapshot, phoneSnapshot] = await Promise.all([
            rollRef.once("value"),
            phoneRef.once("value")
        ]);
        if (rollSnapshot.exists() || phoneSnapshot.exists()) {
            const duplicateError = new Error(rollSnapshot.exists()
                ? `Roll number "${rollNumber}" is already registered.`
                : `Mobile number "${phone}" is already associated with another student account.`);
            duplicateError.code = rollSnapshot.exists()
                ? "registration/duplicate-roll"
                : "registration/duplicate-phone";
            throw duplicateError;
        }

        reservedIndices.push(rollRef, phoneRef);
        const reservations = await Promise.all([
            rollRef.transaction(current => current === null ? registrationUid : undefined),
            phoneRef.transaction(current => current === null ? registrationUid : undefined)
        ]);
        if (reservations.some(result => !result.committed)) {
            const duplicateError = new Error("The roll number or phone number is already registered.");
            duplicateError.code = "registration/duplicate-index";
            throw duplicateError;
        }

        await database.ref(`students/${registrationUid}`).set({
            name,
            email,
            phone: cleanPhone,
            branch,
            rollNumber,
            status: "pending",
            registeredAt: Date.now()
        });
        profileSaved = true;

        await firebase.auth().signOut();
        registrationUser = null;
        showStudentLogin();
        document.getElementById("studentLoginMessage").innerText =
            "Registration submitted successfully! Wait for founder approval before logging in.";
    } catch (error) {
        if (registrationUser && !profileSaved) {
            for (const indexRef of reservedIndices) {
                try {
                    await indexRef.transaction(current => current === registrationUid ? null : undefined);
                } catch (cleanupError) {
                    console.error("Could not release a student registration index.", cleanupError);
                }
            }
            try {
                await registrationUser.delete();
                await firebase.auth().signOut();
            } catch (cleanupError) {
                console.error("Could not clean up an incomplete student registration.", cleanupError);
            }
        }

        if (error.code === "registration/duplicate-roll") {
            message.innerText = `❌ Roll number "${rollNumber}" is already registered! Multiple accounts for the same roll number are not permitted.`;
        } else if (error.code === "registration/duplicate-phone") {
            message.innerText = `❌ Mobile number "${phone}" is already associated with another student account.`;
        } else if (error.code === "registration/duplicate-index") {
            message.innerText = "❌ The roll number or phone number was just registered by another account. Please verify your details.";
        } else {
            message.innerText = error.code === "auth/email-already-in-use"
                ? `❌ The email "${email}" is already registered! Please sign in or use 'Forgot password'.`
                : getFirebaseErrorMessage(error);
        }
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = "Submit Registration";
        }
    }
}

async function studentLogin() {
    const message = document.getElementById("studentLoginMessage");
    const submitButton = document.querySelector("#studentLoginForm button[type='submit']");
    const email = document.getElementById("studentLoginEmail").value.trim().toLowerCase();
    const password = document.getElementById("studentLoginPassword").value;

    if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerText = "Signing in...";
    }

    try {
        if (!isFirebaseConfigured()) throw new Error("Firebase is not configured yet.");

        showLoader("Checking your account...");

        ensureFirebase();
        if (firebase.auth().currentUser) await firebase.auth().signOut();

        updateLoaderText("Signing you in...");
        const credential = await firebase.auth().signInWithEmailAndPassword(email, password);

        updateLoaderText("Verifying approval...");
        const snapshot = await firebase.database().ref(`students/${credential.user.uid}`).once("value");
        const student = snapshot.val();

        if (!student || student.status !== "approved") {
            await firebase.auth().signOut();
            hideLoader();
            message.innerText = "Your account is waiting for admin approval.";
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.innerText = "Student Login";
            }
            return;
        }

        saveStudentSession(student);
        updateLoaderText("Loading internships...");
        startSharedInternships();

        showLoaderSuccess(`Welcome, ${student.name.split(" ")[0]}!`, () => {
            document.body.classList.remove("auth-locked", "founder-login");
            document.getElementById("authGate").hidden = true;
            if (!showProfileToolFromHash()) {
                document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
                document.getElementById("home").classList.add("active");
            }
            updateStudentProfile();
        });

    } catch (error) {
        hideLoader();
        console.error("Student login failed:", error);
        message.innerText = error && ["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found"].includes(error.code)
            ? "Student account not found or password is incorrect. Register first, then use the approved account."
            : getFirebaseErrorMessage(error);
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerText = "Student Login";
        }
    }
}

function studentLogout() {
    clearStudentSession();
    stopSharedInternships();
    if (firebase.apps.length && firebase.auth().currentUser) firebase.auth().signOut();
    hideLoader();
    document.body.classList.add("auth-locked");
    document.body.classList.remove("founder-login");
    document.getElementById("authGate").hidden = false;
    document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));
    showStudentLogin();
    document.getElementById("studentLoginEmail").value = "";
    document.getElementById("studentLoginPassword").value = "";
    document.getElementById("studentLoginMessage").innerText = "";
}

async function resetStudentPassword() {
    const email = document.getElementById("studentLoginEmail").value.trim();
    const message = document.getElementById("studentLoginMessage");
    if (!email) {
        message.innerText = "Enter your student email first.";
        return;
    }
    try {
        ensureFirebase();
        await firebase.auth().sendPasswordResetEmail(email);
        message.innerText = "Password reset email sent. Check your inbox.";
    } catch (error) {
        message.innerText = error.code === "auth/user-not-found"
            ? "No Firebase student account was found for this email."
            : getFirebaseErrorMessage(error);
    }
}

/* =========================================================
   INTERNSHIP SHARED SYNC
========================================================= */
function saveInternships() {
    localStorage.setItem("internships", JSON.stringify(internships));
    if (firebaseInternshipRef) {
        firebaseInternshipRef.set(internships).catch(error => {
            console.error("Shared internships could not be saved.", error);
            alert("Could not save the internship online. Check your Firebase setup.");
        });
    }
}

function refreshInternshipViews() {
    publishInternshipUpdates();
    displayInternships();
    displayFeatured();
    displaySavedInternships();
    displayAdminInternships();
    updateHomeStats();
    if (typeof initAtsPage === "function") initAtsPage();
    if (typeof initCoverLetterPage === "function") initCoverLetterPage();
}

function startSharedInternships() {
    if (!isFirebaseConfigured() || !firebase.auth().currentUser) return;
    if (firebaseInternshipRef) return;
    try {
        ensureFirebase();
        listenToMetadata();
        loadApplicationsFromFirebase();
        firebaseInternshipRef = firebase.database().ref("internships");
        firebaseInternshipRef.on("value", snapshot => {
            const sharedInternships = snapshot.val();
            if (Array.isArray(sharedInternships)) {
                internships = sharedInternships.map(normalizeImportedListing);
                const importedDataNormalized = JSON.stringify(internships) !== JSON.stringify(sharedInternships);
                const outdatedListingsRemoved = removeExpiredInternships();
                localStorage.setItem("internships", JSON.stringify(internships));
                if ((outdatedListingsRemoved || importedDataNormalized) && isAdminAuthenticated()) firebaseInternshipRef.set(internships).catch(error => {
                    console.error("Normalized internships could not be saved to shared storage.", error);
                });
                refreshInternshipViews();
            } else if (sharedInternships === null) {
                localStorage.setItem("internships", JSON.stringify(internships));
                refreshInternshipViews();
                if (isAdminAuthenticated()) saveInternships();
            } else {
                console.error("Shared internships have an unexpected data format.");
            }
        }, error => {
            console.error("Shared internships could not be loaded.", error);
        });
    } catch (error) {
        console.error("Firebase could not be started.", error);
    }
}

function stopSharedInternships() {
    if (!firebaseInternshipRef) return;
    firebaseInternshipRef.off();
    firebaseInternshipRef = null;
}

/* =========================================================
   BOOKMARKS
========================================================= */
let bookmarks = [];
try {
    const savedBookmarks = JSON.parse(localStorage.getItem("bookmarks"));
    if (Array.isArray(savedBookmarks)) bookmarks = savedBookmarks;
} catch (error) {
    console.warn("Saved bookmarks could not be loaded.", error);
}
removeExpiredInternships();
localStorage.setItem("internships", JSON.stringify(internships));
updateSavedCount();

/* =========================================================
   ADMIN AUTH
========================================================= */
let adminAuthenticatedInMemory = false;

function setAdminAuthenticated(authenticated) {
    adminAuthenticatedInMemory = authenticated;
    if (authenticated) {
        try {
            sessionStorage.setItem("adminAuth", "true");
        } catch (e) {}
        document.documentElement.classList.remove("is-guest");
        document.documentElement.classList.add("is-authenticated");
    } else {
        try {
            sessionStorage.removeItem("adminAuth");
        } catch (e) {}
        document.documentElement.classList.remove("is-authenticated");
        document.documentElement.classList.add("is-guest");
    }
}

function getStoredAdminAuthentication() {
    return sessionStorage.getItem("adminAuth") === "true";
}

function isAdminAuthenticated() {
    return adminAuthenticatedInMemory;
}

function updateAdminView() {
    const loginPanel = document.getElementById("adminLoginPanel");
    const dashboard = document.getElementById("adminDashboard");
    if (!loginPanel || !dashboard) return;

    const authenticated = isAdminAuthenticated();
    loginPanel.hidden = authenticated;
    dashboard.hidden = !authenticated;

    if (authenticated) {
        displayAdminInternships();
        displayStudentRequests();
        displayApprovedStudents();
    }
}

/* =========================================================
   ADMIN LOGIN / LOGOUT
========================================================= */
async function adminLogin() {
    const adminEmail = document.getElementById("adminLoginId").value.trim();
    const passkey = document.getElementById("adminPasskey").value;
    const error = document.getElementById("loginError");

    if (!isFirebaseConfigured()) {
        error.innerText = "Administrator login requires the configured Firebase project.";
        return;
    }

    showLoader("Authenticating admin...");

    try {
        ensureFirebase();
        await firebase.auth().signInWithEmailAndPassword(adminEmail, passkey);
        await ensureAdminFirebaseSession();
        setAdminAuthenticated(true);
        startSharedInternships();
        error.innerText = "";
        document.getElementById("adminPasskey").value = "";

        document.body.classList.remove("auth-locked");
        document.body.classList.add("founder-login");
        document.getElementById("authGate").hidden = true;
        document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));
        document.getElementById("admin").classList.add("active");
        updateAdminView();
    } catch (loginError) {
        if (firebase.auth().currentUser) await firebase.auth().signOut();
        error.innerText = getFirebaseErrorMessage(loginError);
        hideLoader();
        return;
    }

    updateLoaderText("Loading dashboard...");
    showLoaderSuccess("Welcome back, Admin!");
}

function adminLogout() {
    setAdminAuthenticated(false);
    document.getElementById("adminPasskey").value = "";
    document.getElementById("loginError").innerText = "";
    stopSharedInternships();
    if (firebase.apps.length) firebase.auth().signOut();

    document.body.classList.remove("founder-login");
    document.body.classList.add("auth-locked");
    document.getElementById("authGate").hidden = false;
    showStudentLogin();
}

/* =========================================================
   ADMIN - STUDENT APPROVALS & MANAGEMENT
========================================================= */
let allApprovedStudents = [];

function bindStudentActionHandlers(container) {
    if (container.dataset.actionsBound === "true") return;
    container.dataset.actionsBound = "true";
    container.addEventListener("click", event => {
        const button = event.target instanceof Element
            ? event.target.closest("button[data-student-action]")
            : null;
        if (!button || !container.contains(button)) return;

        const { studentAction, studentUid, studentName } = button.dataset;
        if (!studentUid) return;

        if (studentAction === "approve") approveStudent(studentUid);
        if (studentAction === "reject") rejectStudent(studentUid);
        if (studentAction === "revoke") revokeStudentApproval(studentUid, studentName);
        if (studentAction === "delete") deleteStudentAccount(studentUid, studentName);
    });
}

async function displayApprovedStudents() {
    const container = document.getElementById("approvedStudentList");
    const count = document.getElementById("approvedStudentCount");
    if (!container || !count) return;

    try {
        bindStudentActionHandlers(container);
        await ensureAdminFirebaseSession();
        const snapshot = await firebase.database().ref("students").once("value");
        const students = snapshot.val() || {};
        allApprovedStudents = Object.entries(students)
            .map(([uid, student]) => ({ uid, ...student }))
            .filter(student => student.status === "approved");

        count.innerText = `${allApprovedStudents.length} total`;
        renderApprovedStudentsList(allApprovedStudents);
    } catch (error) {
        count.innerText = "";
        container.innerHTML = `<p class="company">${escapeHTML(getFirebaseErrorMessage(error))}</p>`;
    }
}

function filterApprovedStudents() {
    const query = (document.getElementById("adminStudentSearch")?.value || "").toLowerCase().trim();
    if (!query) {
        renderApprovedStudentsList(allApprovedStudents);
        return;
    }
    const filtered = allApprovedStudents.filter(student => {
        const name = (student.name || "").toLowerCase();
        const email = (student.email || "").toLowerCase();
        const phone = (student.phone || "").toLowerCase();
        const branch = (student.branch || "").toLowerCase();
        const roll = (student.rollNumber || "").toLowerCase();
        return name.includes(query) || email.includes(query) || phone.includes(query) || branch.includes(query) || roll.includes(query);
    });
    renderApprovedStudentsList(filtered);
}

function renderApprovedStudentsList(list) {
    const container = document.getElementById("approvedStudentList");
    if (!container) return;

    if (!list.length) {
        container.innerHTML = `<div class="empty-state" style="padding:24px;text-align:center;color:#64748b;">No approved students found.</div>`;
        return;
    }

    container.innerHTML = list.map(student => {
        const safeUid = escapeHTML(String(student.uid));
        const safeName = escapeHTML(String(student.name || "Student"));
        return `
            <div class="admin-card-row">
                <div class="admin-card-main">
                    <div class="admin-card-header">
                        <h4>${escapeHTML(student.name || "Student")}</h4>
                        <span class="tag" style="background:#ecfdf5;color:#047857;border-color:#a7f3d0;">✓ Approved</span>
                    </div>
                    <div class="admin-card-meta">
                        <span class="admin-meta-item">✉️ ${escapeHTML(student.email || "No email")}</span>
                        <span class="admin-meta-item">📞 ${escapeHTML(student.phone || "No phone")}</span>
                        <span class="admin-meta-item">🏛️ ${escapeHTML(student.branch || "General")}</span>
                        <span class="admin-meta-item">🎓 Roll No: <strong>${escapeHTML(student.rollNumber || "N/A")}</strong></span>
                    </div>
                    ${student.skills ? `<div class="admin-card-tags"><span class="admin-tag-skills">🧠 ${escapeHTML(student.skills)}</span></div>` : ""}
                </div>
                <div class="admin-card-actions">
                    <button class="secondary-btn" type="button" data-student-action="revoke" data-student-uid="${safeUid}" data-student-name="${safeName}" style="border-color:#f59e0b;color:#d97706;" title="Revoke approval and move back to Pending">Revoke Access</button>
                    <button class="danger-btn" type="button" data-student-action="delete" data-student-uid="${safeUid}" data-student-name="${safeName}" title="Remove student profile from the database">Remove profile</button>
                </div>
            </div>
        `;
    }).join("");
}

async function revokeStudentApproval(uid, name) {
    if (!confirm(`Revoke approval for "${name}"?\nTheir status will be moved back to Pending and they will not be able to log in until approved again.`)) return;

    showLoader("Revoking student approval...");
    try {
        await ensureAdminFirebaseSession();
        await firebase.database().ref(`students/${uid}/status`).set("pending");
        await displayApprovedStudents();
        await displayStudentRequests();
        showLoaderSuccess(`Access revoked for ${name}`);
    } catch (error) {
        hideLoader();
        alert(getFirebaseErrorMessage(error));
    }
}

async function deleteStudentAccount(uid, name) {
    if (!confirm(`Remove the database profile for "${name}"?\nThis does not delete their Firebase Authentication account.`)) return;

    showLoader("Removing student profile...");
    try {
        await ensureAdminFirebaseSession();
        await firebase.database().ref(`students/${uid}`).remove();
        await displayApprovedStudents();
        await displayStudentRequests();
        showLoaderSuccess(`Removed ${name}'s profile`);
    } catch (error) {
        hideLoader();
        alert(getFirebaseErrorMessage(error));
    }
}

async function displayStudentRequests() {
    const container = document.getElementById("studentRequestList");
    if (!container) return;

    try {
        bindStudentActionHandlers(container);
        if (!isFirebaseConfigured()) throw new Error("local mode");
        await ensureAdminFirebaseSession();
        const snapshot = await firebase.database().ref("students").once("value");
        const students = snapshot.val() || {};
        const pending = Object.entries(students).filter(([, student]) => student.status === "pending");
        const tabPendingCount = document.getElementById("adminTabPendingCount");
        if (tabPendingCount) tabPendingCount.innerText = String(pending.length);

        if (!pending.length) {
            container.innerHTML = `<div class="empty-state" style="padding:18px;text-align:center;color:#64748b;">No pending student registrations.</div>`;
            return;
        }

        container.innerHTML = pending.map(([uid, student]) => {
            const safeUid = escapeHTML(String(uid));
            return `
                <div class="admin-card-row" style="margin-bottom:12px;">
                    <div class="admin-card-main">
                        <div class="admin-card-header">
                            <h4>${escapeHTML(student.name || "Student")}</h4>
                            <span class="tag" style="background:#fffbeb;color:#b45309;border-color:#fde68a;">⏳ Pending Approval</span>
                        </div>
                        <div class="admin-card-meta">
                            <span class="admin-meta-item">✉️ ${escapeHTML(student.email || "")}</span>
                            <span class="admin-meta-item">📞 ${escapeHTML(student.phone || "No phone")}</span>
                            <span class="admin-meta-item">🏛️ ${escapeHTML(student.branch || "General")}</span>
                            <span class="admin-meta-item">🎓 Roll No: <strong>${escapeHTML(student.rollNumber || "N/A")}</strong></span>
                        </div>
                    </div>
                    <div class="admin-card-actions">
                        <button class="primary-btn" type="button" data-student-action="approve" data-student-uid="${safeUid}" style="padding:7px 16px;font-size:0.875rem;">Accept</button>
                        <button class="danger-btn" type="button" data-student-action="reject" data-student-uid="${safeUid}">Reject</button>
                    </div>
                </div>
            `;
        }).join("");
    } catch (error) {
        container.innerHTML = `<p class="company">${escapeHTML(getFirebaseErrorMessage(error))}</p>`;
    }
}

async function approveStudent(uid) {
    const container = document.getElementById("studentRequestList");
    try {
        await ensureAdminFirebaseSession();
        await firebase.database().ref(`students/${uid}/status`).set("approved");
        await displayStudentRequests();
        await displayApprovedStudents();
    } catch (error) {
        if (container) container.innerText = getFirebaseErrorMessage(error);
    }
}

async function rejectStudent(uid) {
    if (!confirm("Reject this registration?")) return;
    const container = document.getElementById("studentRequestList");
    try {
        await ensureAdminFirebaseSession();
        await firebase.database().ref(`students/${uid}`).remove();
        await displayStudentRequests();
        await displayApprovedStudents();
    } catch (error) {
        if (container) container.innerText = getFirebaseErrorMessage(error);
    }
}

/* =========================================================
   PAGE NAVIGATION
========================================================= */
function showPage(pageId) {
    document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));
    const targetPage = document.getElementById(pageId);
    if (targetPage) targetPage.classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (pageId === "home") {
        displayInternships();
        displayFeatured();
        updateHomeStats();
    }
    if (pageId === "favorites") displaySavedInternships();
    if (pageId === "tracker") renderTrackerPage();
    if (pageId === "insights") renderInsightsDashboard();
    if (pageId === "admin") {
        updateAdminView();
    }
    if (pageId === "profile") {
        updateStudentProfile();
    }
}

function showProfileToolFromHash() {
    const toolId = window.location.hash.slice(1);
    if (!["ats", "coverletter"].includes(toolId)) return false;

    showPage("profile");
    const tool = document.getElementById(toolId);
    if (tool) {
        tool.open = true;
        tool.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    return true;
}

function mountProfileTools() {
    const tools = [
        { id: "atsTool", targetId: "atsToolContent", initialize: initAtsPage },
        { id: "coverletterTool", targetId: "coverletterToolContent", initialize: initCoverLetterPage }
    ];

    tools.forEach(({ id, targetId, initialize }) => {
        const content = document.getElementById(id);
        const target = document.getElementById(targetId);
        const accordion = target?.closest("details");
        if (!content || !target || !accordion) return;

        content.hidden = false;
        target.appendChild(content);
        accordion.addEventListener("toggle", () => {
            if (accordion.open) initialize();
        });
    });
}

const countAnimationFrames = new WeakMap();
const countAnimationTargets = new WeakMap();

function animateValue(element, start, end, duration = 700) {
    if (!element || !Number.isFinite(Number(end))) return;

    const target = Number(end);
    const currentTarget = countAnimationTargets.get(element);
    if (currentTarget === target) return;

    const previousFrame = countAnimationFrames.get(element);
    if (previousFrame) cancelAnimationFrame(previousFrame);
    countAnimationTargets.set(element, target);

    const from = Number.isFinite(Number(start)) ? Number(start) : 0;
    const motionReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (motionReduced || !Number.isFinite(duration) || duration <= 0 || from === target) {
        element.textContent = String(Math.round(target));
        return;
    }

    const startTime = performance.now();
    const tick = now => {
        const progress = Math.min((now - startTime) / duration, 1);
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        element.textContent = String(Math.round(from + (target - from) * easedProgress));

        if (progress < 1) {
            countAnimationFrames.set(element, requestAnimationFrame(tick));
        } else {
            countAnimationFrames.delete(element);
        }
    };

    countAnimationFrames.set(element, requestAnimationFrame(tick));
}

let cardRevealObserver = null;

function initializeInternshipCardEffects(root = document) {
    const cards = root.querySelectorAll(".card:not([data-effects-bound])");
    if (!cards.length) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!cardRevealObserver && "IntersectionObserver" in window) {
        cardRevealObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add("visible");
                cardRevealObserver.unobserve(entry.target);
            });
        }, { threshold: 0.12, rootMargin: "0px 0px -28px 0px" });
    }

    cards.forEach(card => {
        card.dataset.effectsBound = "true";
        card.classList.add("reveal");
        if (reducedMotion || !cardRevealObserver) {
            card.classList.add("visible");
            return;
        }
        cardRevealObserver.observe(card);

        card.addEventListener("pointermove", event => {
            if (event.pointerType === "touch" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
            const bounds = card.getBoundingClientRect();
            const horizontalPosition = (event.clientX - bounds.left) / bounds.width * 2 - 1;
            const verticalPosition = (event.clientY - bounds.top) / bounds.height * 2 - 1;
            card.classList.add("is-tilting");
            card.style.setProperty("--card-rotate-x", `${-verticalPosition * 4}deg`);
            card.style.setProperty("--card-rotate-y", `${horizontalPosition * 4}deg`);
        });

        card.addEventListener("pointerleave", () => {
            card.classList.remove("is-tilting");
            card.style.setProperty("--card-rotate-x", "0deg");
            card.style.setProperty("--card-rotate-y", "0deg");
        });
    });
}

function updateHomeStats() {
    const count = document.getElementById("internshipCount");
    const onlineCount = document.getElementById("onlineCount");
    if (count) animateValue(count, Number(count.textContent) || 0, internships.length);
    if (onlineCount) animateValue(onlineCount, Number(onlineCount.textContent) || 0, internships.filter(i => i.type === "Online").length);
    listenToMetadata();
}

/* =========================================================
   DISPLAY FEATURED
========================================================= */
function displayFeatured() {
    const container = document.getElementById("featuredContainer");
    if (!container) return;
    container.innerHTML = internships.length
        ? ""
        : "<p class=\"company\">No live internships are synced yet.</p>";
    if (!internships.length) return;

    sortIndiaFirst(internships).slice(0, 5).forEach(internship => {
        const card = document.createElement("div");
        card.className = "feature-card";
        const workMode = hasPublishedValue(internship.type) ? internship.type : "Work mode not listed";
        card.innerHTML = `
            <div class="feature-card-top">
                <span class="feature-brand-company">${escapeHTML(internship.company || "Company")}</span>
                <span class="feature-brand-label">FEATURED</span>
            </div>
            <h3>${escapeHTML(internship.title)}</h3>
            ${hasPublishedValue(internship.location) ? `<div class="feature-info">📍 ${escapeHTML(internship.location)}</div>` : ""}
            ${hasPublishedValue(internship.stipend) ? `<div class="feature-info">💰 ${escapeHTML(internship.stipend)}</div>` : ""}
            <div class="feature-info">${escapeHTML(workMode)}</div>
            <button class="feature-view" onclick="showDetails(${escapeInlineString(internship.id)})">View Internship</button>
        `;
        container.appendChild(card);
    });
}

/* =========================================================
   DISPLAY ALL INTERNSHIPS (WITH ADVANCED FILTER BAR)
========================================================= */
function clearInternshipFilters() {
    const searchInput = document.getElementById("searchInput");
    const workType = document.getElementById("filterWorkType");
    const loc = document.getElementById("filterLocation");
    const branch = document.getElementById("filterBranch");
    const sort = document.getElementById("filterSort");
    if (searchInput) searchInput.value = "";
    if (workType) workType.value = "all";
    if (loc) loc.value = "all";
    if (branch) branch.value = "all";
    if (sort) sort.value = "india_first";
    displayInternships();
}

function displayInternships() {
    const container = document.getElementById("internshipContainer");
    if (!container) return;

    const search = (document.getElementById("searchInput")?.value || "").trim().toLowerCase();
    const workTypeFilter = document.getElementById("filterWorkType")?.value || "all";
    const locationFilter = document.getElementById("filterLocation")?.value || "all";
    const branchFilter = document.getElementById("filterBranch")?.value || "all";
    const sortFilter = document.getElementById("filterSort")?.value || "india_first";

    let filtered = internships.filter(internship => {
        // Search filter
        if (search) {
            const skills = Array.isArray(internship.skills) ? internship.skills.join(" ") : "";
            const matchedSearch = [
                internship.title,
                internship.company,
                internship.specialization,
                internship.location,
                internship.branch,
                internship.type,
                isIndiaBasedListing(internship) ? "India" : "",
                skills
            ].some(value => String(value || "").toLowerCase().includes(search));
            if (!matchedSearch) return false;
        }

        // Work mode filter
        if (workTypeFilter !== "all") {
            const curType = String(internship.type || "").toLowerCase();
            if (workTypeFilter.toLowerCase() !== curType) return false;
        }

        // Location filter
        if (locationFilter !== "all") {
            const isIndia = isIndiaBasedListing(internship);
            const locText = String(internship.location || "").toLowerCase();
            if (locationFilter === "india" && !isIndia) return false;
            if (locationFilter === "global" && isIndia) return false;
            if (locationFilter === "remote" && !/remote|online|virtual|anywhere/.test(locText) && internship.type !== "Online") return false;
            if (["bengaluru", "hyderabad", "pune", "mumbai", "delhi"].includes(locationFilter)) {
                if (!locText.includes(locationFilter) && !locText.includes(locationFilter === "bengaluru" ? "bangalore" : "")) return false;
            }
        }

        // Branch filter
        if (branchFilter !== "all") {
            const branchText = String(internship.branch || "").toLowerCase();
            const targetBranch = branchFilter.toLowerCase();
            if (branchText !== "all branches" && !branchText.includes(targetBranch) && !String(internship.specialization || "").toLowerCase().includes(targetBranch)) {
                return false;
            }
        }

        return true;
    });

    // Sorting
    if (sortFilter === "india_first") {
        filtered = sortIndiaFirst(filtered);
    } else if (sortFilter === "newest") {
        filtered.sort((a, b) => String(b.postedDate || "").localeCompare(String(a.postedDate || "")));
    } else if (sortFilter === "title_asc") {
        filtered.sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
    } else if (sortFilter === "company_asc") {
        filtered.sort((a, b) => String(a.company || "").localeCompare(String(b.company || "")));
    }

    const statusText = document.getElementById("filterStatusText");
    if (statusText) {
        statusText.innerText = `Showing ${filtered.length} of ${internships.length} opportunities`;
    }

    if (cardRevealObserver) {
        container.querySelectorAll(".card").forEach(card => cardRevealObserver.unobserve(card));
    }
    container.innerHTML = filtered.length
        ? filtered.map(createCard).join("")
        : internships.length
            ? "<p class=\"company\">No internships match your filter criteria. Try clicking Reset Filters.</p>"
            : "<p class=\"company\">No current internships are synced yet. Please check back after the next feed update.</p>";
    initializeInternshipCardEffects(container);
}

/* =========================================================
   CREATE CARD
========================================================= */
function createCard(internship) {
    const safeId = escapeInlineString(internship.id);
    const isApplied = trackedApplications.some(a => String(a.internshipId) === String(internship.id) && a.status === "Applied");
    const tags = [
        hasPublishedValue(internship.specialization) && internship.specialization !== "General"
            ? `<span class="tag">${escapeHTML(internship.specialization)}</span>` : "",
        hasPublishedValue(internship.type) ? `<span class="tag">${escapeHTML(internship.type)}</span>` : "",
        isIndiaBasedListing(internship) ? "<span class=\"tag india-tag\">India</span>" : ""
    ].filter(Boolean).join("");
    const details = [
        ["📍", internship.location],
        ["💰", internship.stipend],
        ["⏱️", internship.duration]
    ].filter(([, value]) => hasPublishedValue(value));
    return `
        <div class="card ${isApplied ? "card-applied" : ""}">
            <div class="card-top">
                <div style="display:flex;align-items:center;gap:6px;">
                    <div class="company-logo">💼</div>
                    ${isApplied ? `<span class="status-badge status-applied" style="font-size:11px;padding:2px 7px;">✓ Applied</span>` : ""}
                </div>
                <button class="bookmark" type="button" onclick="bookmark(${safeId})"
                        title="Save internship" aria-label="${bookmarks.some(bookmarkId => String(bookmarkId) === String(internship.id)) ? "Remove" : "Save"} ${escapeHTML(internship.title)}"
                        aria-pressed="${bookmarks.some(bookmarkId => String(bookmarkId) === String(internship.id))}">
                    ${bookmarks.some(bookmarkId => String(bookmarkId) === String(internship.id)) ? "♥" : "♡"}
                </button>
            </div>
            <h3>${escapeHTML(internship.title)}</h3>
            <div class="company">${escapeHTML(internship.company)}</div>
            ${tags ? `<div class="tags">${tags}</div>` : ""}
            <div class="details">
                ${details.map(([icon, value]) => `<div>${icon} ${escapeHTML(value)}</div>`).join("")}
                ${internship.postedDate ? `<div>🗓 Posted: ${escapeHTML(internship.postedDate)}</div>` : ""}
            </div>
            <div class="card-actions">
                <button class="secondary-btn" onclick="showDetails(${safeId})">Details</button>
                <button class="small-primary" onclick="apply(${safeId})" style="${isApplied ? "background:#15803d;border-color:#15803d;" : ""}">
                    ${isApplied ? "Applied ✓" : "Apply"}
                </button>
            </div>
        </div>
    `;
}

/* =========================================================
   TYPE SELECTION
========================================================= */
let selectedType = "Online";

function selectType(type) {
    selectedType = type;
    document.getElementById("onlineChoice").classList.remove("selected");
    document.getElementById("offlineChoice").classList.remove("selected");
    document.getElementById("onlineChoice").classList.toggle("selected", type === "Online");
    document.getElementById("offlineChoice").classList.toggle("selected", type === "Offline");
    document.getElementById("onlineChoice").setAttribute("aria-pressed", String(type === "Online"));
    document.getElementById("offlineChoice").setAttribute("aria-pressed", String(type === "Offline"));
}

/* =========================================================
   FIND MATCHES
========================================================= */
function findMatches() {
    const branch = document.getElementById("branch").value;
    const specialization = document.getElementById("specialization").value;
    const skills = document.getElementById("skills").value.toLowerCase();
    const location = document.getElementById("location").value.toLowerCase();
    const userSkills = [...new Set(skills.split(",").map(skill => skill.trim()).filter(Boolean))];

    let results = internships.map(internship => {
        let score = 0;
        if (internship.type === selectedType) score += 35;
        if (branch && String(internship.branch || "").toLowerCase() === branch.toLowerCase()) score += 25;
        if (specialization && String(internship.specialization || "").toLowerCase() === specialization.toLowerCase()) score += 30;
        if (location && String(internship.location || "").toLowerCase().includes(location)) score += 10;

        const internshipSkills = Array.isArray(internship.skills)
            ? internship.skills.map(skill => String(skill).trim().toLowerCase())
            : [];
        userSkills.forEach(skill => {
            if (internshipSkills.includes(skill.toLowerCase())) score += 5;
        });
        return { ...internship, score: Math.min(score, 100) };
    });

    results.sort((a, b) =>
        Number(isIndiaBasedListing(b)) - Number(isIndiaBasedListing(a)) || b.score - a.score
    );

    const container = document.getElementById("resultsContainer");
    let html = "";
    results.forEach(internship => {
        const safeId = escapeInlineString(internship.id);
        const tags = [
            hasPublishedValue(internship.specialization) && internship.specialization !== "General"
                ? `<span class="tag">${escapeHTML(internship.specialization)}</span>` : "",
            hasPublishedValue(internship.type) ? `<span class="tag">${escapeHTML(internship.type)}</span>` : "",
            isIndiaBasedListing(internship) ? "<span class=\"tag india-tag\">India</span>" : ""
        ].filter(Boolean).join("");
        const details = [
            ["📍", internship.location],
            ["💰", internship.stipend],
            ["⏱️", internship.duration]
        ].filter(([, value]) => hasPublishedValue(value));
        html += `
            <div class="card">
                <div class="card-top">
                    <div class="company-logo">🤖</div>
                    <strong style="color:#16a34a">${internship.score}% Match</strong>
                </div>
                <h3>${escapeHTML(internship.title)}</h3>
                <div class="company">${escapeHTML(internship.company)}</div>
                ${tags ? `<div class="tags">${tags}</div>` : ""}
                <div class="details">
                    ${details.map(([icon, value]) => `<div>${icon} ${escapeHTML(value)}</div>`).join("")}
                </div>
                <div class="card-actions">
                    <button class="secondary-btn" onclick="showDetails(${safeId})">Details</button>
                    <button class="small-primary" onclick="apply(${safeId})">Apply</button>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;

    document.getElementById("resultMessage").innerText =
        `We found ${results.length} internships based on your preferences.`;
    showPage("results");
}

/* =========================================================
   MODAL
========================================================= */
let lastModalTrigger = null;

function showDetails(id) {
    const internship = findInternshipById(id);
    if (!internship) return;
    trackInternshipView(internship);
    const modal = document.getElementById("detailsModal");
    const body = document.getElementById("modalBody");
    const skills = Array.isArray(internship.skills) ? internship.skills.filter(hasPublishedValue) : [];
    const applicationUrl = getSafeApplicationUrl(internship.link);
    const overviewFields = [
        ["Location", internship.location],
        ["Work arrangement", internship.type],
        ["Branch eligibility", internship.branch === "All branches" ? "" : internship.branch],
        ["Stipend", internship.stipend],
        ["Duration", internship.duration],
        ["Skills", skills.join(", ")],
        ["Posted", internship.postedDate],
        ["Application closes", internship.closingDate]
    ].filter(([, value]) => hasPublishedValue(value));
    const detailTags = [
        hasPublishedValue(internship.specialization) && internship.specialization !== "General" ? internship.specialization : "",
        isIndiaBasedListing(internship) ? "India" : ""
    ].filter(Boolean);
    const description = getCachedRoleDescription(internship.description) ||
        "The employer feed does not include a role description. Open the original posting for responsibilities and requirements.";
    lastModalTrigger = document.activeElement;

    body.innerHTML = `
        <article class="internship-detail">
            <header class="detail-heading">
                <div class="detail-company-mark" aria-hidden="true">${escapeHTML((internship.company || "I").charAt(0).toUpperCase())}</div>
                <p class="detail-company">${escapeHTML(internship.company || "Company not specified")}</p>
                <h2 id="modalTitle">${escapeHTML(internship.title || "Internship")}</h2>
                ${detailTags.length ? `<div class="detail-tags">${detailTags.map(tag => `<span>${escapeHTML(tag)}</span>`).join("")}</div>` : ""}
            </header>
            <section class="detail-section" aria-labelledby="detail-overview-title">
                <h3 id="detail-overview-title">Position overview</h3>
                <dl class="detail-grid">
                    ${overviewFields.map(([label, value]) => `<div class="${label === "Skills" ? "detail-grid-wide" : ""}"><dt>${label}</dt><dd>${escapeHTML(value)}</dd></div>`).join("")}
                </dl>
            </section>
            ${getSmartInsightsHTML(internship, skills)}
            <section class="detail-section detail-about" aria-labelledby="detail-about-title">
                <h3 id="detail-about-title">About this internship</h3>
                <p>${escapeHTML(description)}</p>
            </section>
            <footer class="detail-actions">
                ${applicationUrl
                    ? `<a class="primary-btn detail-apply" data-track-internship="${escapeHTML(String(internship.id))}" href="${escapeHTML(applicationUrl)}" target="_blank" rel="noopener noreferrer">Open application <span aria-hidden="true">↗</span></a>`
                    : "<p class=\"detail-no-link\">An application link is not available for this listing.</p>"}
            </footer>
        </article>
    `;
    modal.classList.add("show");
    modal.querySelector(".close").focus();
}

function getSmartInsightsHTML(internship, skills) {
    const rawStudentSkills = currentStudent?.skills || document.getElementById("skills")?.value || "";
    const studentSkills = (Array.isArray(rawStudentSkills) ? rawStudentSkills : rawStudentSkills.split(","))
        .map(skill => String(skill).trim().toLowerCase())
        .filter(Boolean);

    const requiredSkills = skills.map(s => String(s).trim());
    const matched = [];
    const missing = [];

    requiredSkills.forEach(req => {
        if (studentSkills.some(st => st.includes(req.toLowerCase()) || req.toLowerCase().includes(st))) {
            matched.push(req);
        } else {
            missing.push(req);
        }
    });

    const matchPercent = requiredSkills.length
        ? Math.min(100, Math.max(50, Math.round((matched.length / requiredSkills.length) * 100)))
        : 85;

    return `
        <div class="smart-insights-panel">
            <div class="smart-insights-title">
                <span>⚡ Smart Skill Gap & Match Analysis</span>
                <span style="margin-left:auto;font-size:13px;color:#16a34a;background:#dcfce7;padding:2px 8px;border-radius:6px;font-weight:700;">${matchPercent}% Fit</span>
            </div>
            <div class="skill-match-row">
                ${matched.length ? `<div><strong>Matching Skills (${matched.length}):</strong> ${matched.map(m => `<span class="skill-chip-matched">✅ ${escapeHTML(m)}</span>`).join("")}</div>` : ""}
                ${missing.length ? `<div style="margin-top:6px;"><strong>Recommended to Learn (${missing.length}):</strong> ${missing.slice(0, 3).map(m => `<span class="skill-chip-gap">💡 ${escapeHTML(m)}</span>`).join("")} <span style="font-size:12px;color:#64748b;">(Upskilling improves shortlisting!)</span></div>` : ""}
            </div>
            <button type="button" class="company-review-trigger-btn" data-review-company="${escapeHTML(internship.company || "")}">
                ⭐ View Company Reviews & Ratings ↗
            </button>
        </div>
    `;
}

function closeModal() {
    const modal = document.getElementById("detailsModal");
    modal.classList.remove("show");
    if (lastModalTrigger && lastModalTrigger.isConnected) lastModalTrigger.focus();
}

document.getElementById("detailsModal").addEventListener("click", event => {
    if (event.target === event.currentTarget) closeModal();
    const applicationLink = event.target.closest("a[data-track-internship]");
    if (applicationLink) autoTrackApplication(applicationLink.dataset.trackInternship);
    const reviewButton = event.target.closest("button[data-review-company]");
    if (reviewButton) openCompanyReviews(reviewButton.dataset.reviewCompany);
});

document.addEventListener("keydown", event => {
    const modal = document.getElementById("detailsModal");
    if (!modal.classList.contains("show")) return;
    if (event.key === "Escape") {
        closeModal();
        return;
    }
    if (event.key !== "Tab") return;

    const focusable = [...modal.querySelectorAll("button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])")];
    if (!focusable.length) return;
    if (event.shiftKey && document.activeElement === focusable[0]) {
        event.preventDefault();
        focusable[focusable.length - 1].focus();
    } else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) {
        event.preventDefault();
        focusable[0].focus();
    }
});

/* =========================================================
   APPLY & CONFIRMATION FLOW
========================================================= */
let pendingApplyInternship = null;

function apply(id) {
    const internship = findInternshipById(id);
    const applicationUrl = internship && getSafeApplicationUrl(internship.link);
    if (!applicationUrl) {
        alert("Application link will be added by the administrator.");
        return;
    }

    pendingApplyInternship = internship;

    // Track as In Progress (Visited portal link)
    trackApplicationVisit(internship);

    // Open employer portal in a new tab
    window.open(applicationUrl, "_blank", "noopener,noreferrer");

    // Open confirmation modal so student can confirm whether they actually applied
    openApplyConfirmModal(internship);
}

function openApplyConfirmModal(internship) {
    const modal = document.getElementById("applyConfirmModal");
    if (!modal) return;
    const roleEl = document.getElementById("applyConfirmRole");
    const compEl = document.getElementById("applyConfirmCompany");
    if (roleEl) roleEl.innerText = internship.title || "Internship Role";
    if (compEl) compEl.innerText = `${internship.company || "Company"} • ${internship.location || "Remote"}`;
    modal.classList.add("show");
}

function closeApplyConfirmModal() {
    const modal = document.getElementById("applyConfirmModal");
    if (modal) modal.classList.remove("show");
}

function confirmApplicationSubmitted() {
    if (pendingApplyInternship) {
        markInternshipAsApplied(pendingApplyInternship.id);
    }
    closeApplyConfirmModal();
    alert("🎉 Excellent! Your application is now officially tracked under 'Applied' in your Tracker.");
}

function confirmApplicationInProgress() {
    closeApplyConfirmModal();
    alert("📝 Tracked as 'In Progress'. Whenever you finish and submit on their portal, come to your Tracker and click 'Mark as Applied'!");
}

/* =========================================================
   BOOKMARK
========================================================= */
function bookmark(id) {
    if (bookmarks.some(bookmarkId => String(bookmarkId) === String(id))) {
        bookmarks = bookmarks.filter(bookmarkId => String(bookmarkId) !== String(id));
    }
    else bookmarks.push(id);
    localStorage.setItem("bookmarks", JSON.stringify(bookmarks));
    publishInternshipUpdates();
    updateSavedCount();
    displaySavedInternships();
    displayFeatured();
    displayInternships();
}

function updateSavedCount() {
    const count = bookmarks.length;
    const navCount = document.getElementById("savedCount");
    const pageCount = document.getElementById("savedInternshipCount");
    if (navCount) navCount.innerText = String(count);
    if (pageCount) pageCount.innerText = `${count} ${count === 1 ? "internship" : "internships"} saved`;
}

function displaySavedInternships() {
    const container = document.getElementById("savedInternshipContainer");
    if (!container) return;
    const saved = bookmarks.map(findInternshipById).filter(Boolean);
    container.innerHTML = saved.length
        ? saved.map(createCard).join("")
        : "<p class=\"company\">No saved internships yet. Use the heart on a listing to save it here.</p>";
    updateSavedCount();
}

/* =========================================================
   ADMIN - ADD INTERNSHIP
========================================================= */
function addInternship() {
    const title = document.getElementById("adminTitle").value;
    const company = document.getElementById("adminCompany").value;
    const type = document.getElementById("adminType").value;
    const branch = document.getElementById("adminBranch").value;
    const specialization = document.getElementById("adminSpecialization").value;
    const location = document.getElementById("adminLocation").value;
    const stipend = document.getElementById("adminStipend").value;
    const duration = document.getElementById("adminDuration").value;
    const closingDate = document.getElementById("adminClosingDate").value;
    const skills = document.getElementById("adminSkills").value.split(",").map(s => s.trim());
    const link = document.getElementById("adminLink").value.trim();

    if (!title || !company || !specialization || !closingDate || !link) {
        alert("Please enter the title, company, specialization, closing date and application link.");
        return;
    }
    if (closingDate < getLocalDateString()) {
        alert("The application closing date must be today or later.");
        return;
    }
    if (!getSafeApplicationUrl(link)) {
        alert("Application links must use a valid HTTPS address.");
        return;
    }

    internships.unshift({
        id: Date.now(),
        title, company, type, branch, specialization, closingDate,
        postedDate: getLocalDateString(),
        location: location || "Not specified",
        stipend: stipend || "Not specified",
        duration: duration || "Not specified",
        skills,
        description: "New internship added by the InternMatch development team.",
        link: getSafeApplicationUrl(link)
    });

    saveInternships();

    alert(isFirebaseConfigured()
        ? "Internship published and shared with other devices."
        : "Internship saved on this device only. Connect Firebase to share it with other devices.");

    document.querySelectorAll(".admin-input").forEach(input => input.value = "");
    refreshInternshipViews();
    displayAdminInternships();
}

/* =========================================================
   ADMIN - MANAGE INTERNSHIPS (COMPACT & TABBED)
========================================================= */
let adminCurrentPage = 1;
const ADMIN_PAGE_SIZE = 12;

function switchAdminTab(tabName) {
    const paneManage = document.getElementById("adminPaneManage");
    const paneAdd = document.getElementById("adminPaneAdd");
    const paneStudents = document.getElementById("adminPaneStudents");
    const paneAlerts = document.getElementById("adminPaneAlerts");
    const btnManage = document.getElementById("tabBtnManage");
    const btnAdd = document.getElementById("tabBtnAdd");
    const btnStudents = document.getElementById("tabBtnStudents");
    const btnAlerts = document.getElementById("tabBtnAlerts");

    if (paneManage) paneManage.hidden = tabName !== "manage";
    if (paneAdd) paneAdd.hidden = tabName !== "add";
    if (paneStudents) paneStudents.hidden = tabName !== "students";
    if (paneAlerts) paneAlerts.hidden = tabName !== "alerts";

    if (btnManage) btnManage.classList.toggle("active", tabName === "manage");
    if (btnAdd) btnAdd.classList.toggle("active", tabName === "add");
    if (btnStudents) btnStudents.classList.toggle("active", tabName === "students");
    if (btnAlerts) btnAlerts.classList.toggle("active", tabName === "alerts");

    if (tabName === "manage") displayAdminInternships();
    if (tabName === "students") {
        displayStudentRequests();
        displayApprovedStudents();
    }
    if (tabName === "alerts") {
        refreshAdminAlertsDashboard();
    }
}

function changeAdminPage(newPage) {
    adminCurrentPage = newPage;
    displayAdminInternships();
}

function displayAdminInternships() {
    const container = document.getElementById("adminInternshipList");
    const countEl = document.getElementById("adminInternshipCount");
    const tabCountEl = document.getElementById("adminTabInternshipCount");
    const paginationControls = document.getElementById("adminPaginationControls");
    if (!container) return;

    if (tabCountEl) tabCountEl.innerText = String(internships.length);

    const query = (document.getElementById("adminSearchInput")?.value || "").trim().toLowerCase();
    const typeFilter = document.getElementById("adminFilterType")?.value || "all";

    let filtered = sortIndiaFirst(internships).filter(internship => {
        if (typeFilter !== "all" && String(internship.type || "").toLowerCase() !== typeFilter.toLowerCase()) {
            return false;
        }
        if (!query) return true;
        const skills = Array.isArray(internship.skills) ? internship.skills.join(" ") : "";
        return [
            internship.title,
            internship.company,
            internship.location,
            internship.branch,
            internship.specialization,
            skills
        ].some(val => String(val || "").toLowerCase().includes(query));
    });

    const totalFiltered = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / ADMIN_PAGE_SIZE));
    if (adminCurrentPage > totalPages) adminCurrentPage = totalPages;
    if (adminCurrentPage < 1) adminCurrentPage = 1;

    const startIndex = (adminCurrentPage - 1) * ADMIN_PAGE_SIZE;
    const paginated = filtered.slice(startIndex, startIndex + ADMIN_PAGE_SIZE);

    if (countEl) {
        countEl.innerText = query || typeFilter !== "all"
            ? `Showing ${startIndex + 1}-${Math.min(startIndex + ADMIN_PAGE_SIZE, totalFiltered)} of ${totalFiltered} matches (${internships.length} total)`
            : `Showing ${startIndex + 1}-${Math.min(startIndex + ADMIN_PAGE_SIZE, totalFiltered)} of ${totalFiltered} listings`;
    }

    if (paginationControls) {
        paginationControls.innerHTML = totalPages > 1 ? `
            <button class="admin-page-btn" ${adminCurrentPage <= 1 ? "disabled" : ""} onclick="changeAdminPage(${adminCurrentPage - 1})">← Prev</button>
            <span style="font-size:12px;font-weight:600;padding:0 6px;">Page ${adminCurrentPage} of ${totalPages}</span>
            <button class="admin-page-btn" ${adminCurrentPage >= totalPages ? "disabled" : ""} onclick="changeAdminPage(${adminCurrentPage + 1})">Next →</button>
        ` : "";
    }

    if (!paginated.length) {
        container.innerHTML = `<p class="company" style="padding:20px 0;">No internships match your search or filter.</p>`;
        return;
    }

    container.innerHTML = `
        <div class="admin-table-container">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Role & Branch</th>
                        <th>Company</th>
                        <th>Location & Type</th>
                        <th>Deadline</th>
                        <th style="text-align: right;">Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${paginated.map(internship => {
                        const safeId = escapeInlineString(internship.id);
                        return `
                            <tr>
                                <td>
                                    <div style="font-weight: 700; color: #0f766e; font-size: 14px;">${escapeHTML(internship.title)}</div>
                                    <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
                                        ${escapeHTML(internship.branch || "General")}
                                    </div>
                                </td>
                                <td>
                                    <div style="font-weight: 600;">${escapeHTML(internship.company)}</div>
                                </td>
                                <td>
                                    <div style="font-size: 13px;">${escapeHTML(internship.location || "Remote")}</div>
                                    <div style="margin-top: 3px;">
                                        <span class="admin-tag-pill">${escapeHTML(internship.type || "Online")}</span>
                                        ${isIndiaBasedListing(internship) ? `<span class="admin-tag-pill" style="background:#def3e8;color:#155b3b;">India</span>` : ""}
                                    </div>
                                </td>
                                <td>
                                    <div style="font-size: 13px; font-weight: 600; color: #ea580c;">
                                        ${escapeHTML(internship.closingDate || "N/A")}
                                    </div>
                                </td>
                                <td style="text-align: right;">
                                    <button class="danger-btn-small" onclick="deleteInternship(${safeId})" aria-label="Delete ${escapeHTML(internship.title)}">✕ Delete</button>
                                </td>
                            </tr>
                        `;
                    }).join("")}
                </tbody>
            </table>
        </div>
    `;
}

function deleteInternship(id) {
    const internship = findInternshipById(id);
    if (!internship || !confirm(`Delete "${internship.title}"?`)) return;

    internships = internships.filter(item => String(item.id) !== String(id));
    bookmarks = bookmarks.filter(bookmarkId => String(bookmarkId) !== String(id));

    saveInternships();
    localStorage.setItem("bookmarks", JSON.stringify(bookmarks));
    refreshInternshipViews();
}

/* =========================================================
   SESSION PERSISTENCE + LOADING ON REFRESH (NO-FLICKER)
========================================================= */
async function restoreFirebaseSession(user) {
    if (!user) {
        clearStudentSession();
        hideLoader();
        document.body.classList.add("auth-locked");
        document.body.classList.remove("founder-login");
        const gate = document.getElementById("authGate");
        if (gate) gate.hidden = false;
        showStudentLogin();
        return;
    }

    if (!currentStudent) {
        showLoader("Restoring your session...");
    }

    try {
        const adminSnapshot = await firebase.database().ref(`admins/${user.uid}`).once("value");
        if (adminSnapshot.val() === true) {
            setAdminAuthenticated(true);
            startSharedInternships();
            document.body.classList.remove("auth-locked");
            document.body.classList.add("founder-login");
            const gate = document.getElementById("authGate");
            if (gate) gate.hidden = true;
            document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));
            document.getElementById("admin").classList.add("active");
            updateAdminView();
            hideLoader();
            return;
        }

        const studentSnapshot = await firebase.database().ref(`students/${user.uid}`).once("value");
        const student = studentSnapshot.val();
        if (!student || student.status !== "approved") {
            clearStudentSession();
            await firebase.auth().signOut();
            document.body.classList.add("auth-locked");
            const gate = document.getElementById("authGate");
            if (gate) gate.hidden = false;
            showStudentLogin();
            hideLoader();
            return;
        }

        saveStudentSession(student);
        document.body.classList.remove("auth-locked", "founder-login");
        const gate = document.getElementById("authGate");
        if (gate) gate.hidden = true;
        document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));
        document.getElementById("home").classList.add("active");
        startSharedInternships();
        updateStudentProfile();
    } catch (error) {
        console.error("The saved session could not be verified.", error);
        clearStudentSession();
        await firebase.auth().signOut();
        document.body.classList.add("auth-locked");
        const gate = document.getElementById("authGate");
        if (gate) gate.hidden = false;
        showStudentLogin();
    }
    hideLoader();
}

window.addEventListener("load", () => {
    if (isFirebaseConfigured()) {
        try {
            ensureFirebase();
            let unsubscribe = () => {};
            unsubscribe = firebase.auth().onAuthStateChanged(user => {
                unsubscribe();
                restoreFirebaseSession(user);
            });
        } catch (error) {
            console.error("Firebase session restoration failed.", error);
            hideLoader();
        }
        return;
    }

    hideLoader();
});

/* =========================================================
   DYNAMIC METADATA SYNC (HERO STATS)
========================================================= */
function listenToMetadata() {
    if (!isFirebaseConfigured()) return;
    try {
        ensureFirebase();
        firebase.database().ref("metadata").on("value", snapshot => {
            const data = snapshot.val();
            if (data && data.configuredJobBoards) {
                const el = document.getElementById("configuredJobBoardsCount");
                if (el) el.innerText = data.configuredJobBoards;
                const kpi = document.getElementById("kpiBoardsCount");
                if (kpi) kpi.innerText = data.configuredJobBoards;
            }
        });
    } catch (e) {
        console.warn("Could not listen to metadata", e);
    }
}

/* =========================================================
   FEATURE 5: APPLICATION & ACTIVITY TRACKER
========================================================= */
let trackedApplications = [];
try {
    const saved = JSON.parse(localStorage.getItem("trackedApplications"));
    if (Array.isArray(saved)) trackedApplications = saved;
} catch (e) {
    trackedApplications = [];
}

let viewedInternships = [];
try {
    const savedViewed = JSON.parse(localStorage.getItem("viewedInternships"));
    if (Array.isArray(savedViewed)) viewedInternships = savedViewed;
} catch (e) {
    viewedInternships = [];
}

let activeTrackerFilter = "viewed";

function trackInternshipView(internship) {
    if (!internship) return;
    const safeId = String(internship.id);
    const existingIndex = viewedInternships.findIndex(v => String(v.id) === safeId);
    if (existingIndex !== -1) {
        viewedInternships.splice(existingIndex, 1);
    }
    viewedInternships.unshift({
        id: internship.id,
        title: internship.title || "Internship Role",
        company: internship.company || "Company",
        location: internship.location || "Remote",
        type: internship.type || "Online",
        stipend: internship.stipend || "Not specified",
        link: internship.link || "",
        closingDate: internship.closingDate || "",
        viewedAt: Date.now()
    });
    if (viewedInternships.length > 50) viewedInternships = viewedInternships.slice(0, 50);
    localStorage.setItem("viewedInternships", JSON.stringify(viewedInternships));
    if (isFirebaseConfigured() && firebase.auth().currentUser) {
        try {
            ensureFirebase();
            const uid = firebase.auth().currentUser.uid;
            firebase.database().ref(`students/${uid}/viewedInternships`).set(viewedInternships).catch(console.warn);
        } catch (e) {}
    }
    updateTrackerMetrics();
    if (document.getElementById("tracker")?.classList.contains("active")) {
        renderTrackerPage();
    }
}

function removeViewedInternship(id) {
    viewedInternships = viewedInternships.filter(v => String(v.id) !== String(id));
    localStorage.setItem("viewedInternships", JSON.stringify(viewedInternships));
    updateTrackerMetrics();
    renderTrackerPage();
}

function saveApplications() {
    localStorage.setItem("trackedApplications", JSON.stringify(trackedApplications));
    if (isFirebaseConfigured() && firebase.auth().currentUser) {
        try {
            ensureFirebase();
            const uid = firebase.auth().currentUser.uid;
            firebase.database().ref(`students/${uid}/applications`).set(trackedApplications).catch(err => {
                console.warn("Could not sync applications to Firebase", err);
            });
        } catch (e) {}
    }
    updateTrackerMetrics();
}

function loadApplicationsFromFirebase() {
    if (!isFirebaseConfigured() || !firebase.auth().currentUser) return;
    try {
        ensureFirebase();
        const uid = firebase.auth().currentUser.uid;
        firebase.database().ref(`students/${uid}/applications`).once("value").then(snapshot => {
            const val = snapshot.val();
            if (Array.isArray(val)) {
                trackedApplications = val;
                localStorage.setItem("trackedApplications", JSON.stringify(trackedApplications));
                updateTrackerMetrics();
                if (document.getElementById("tracker")?.classList.contains("active")) {
                    renderTrackerPage();
                }
            }
        });
        firebase.database().ref(`students/${uid}/viewedInternships`).once("value").then(snapshot => {
            const val = snapshot.val();
            if (Array.isArray(val) && val.length) {
                viewedInternships = val;
                localStorage.setItem("viewedInternships", JSON.stringify(viewedInternships));
                updateTrackerMetrics();
                if (document.getElementById("tracker")?.classList.contains("active")) {
                    renderTrackerPage();
                }
            }
        });
    } catch (e) {}
}

function getDaysRemaining(closingDateStr) {
    if (!closingDateStr) return null;
    try {
        const parts = closingDateStr.split("-");
        if (parts.length !== 3) return null;
        const target = new Date(parts[0], parts[1] - 1, parts[2]);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffMs = target.getTime() - today.getTime();
        return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    } catch (e) {
        return null;
    }
}

function updateTrackerMetrics() {
    const viewedCount = viewedInternships.length;
    const appliedList = trackedApplications.filter(a => a.status === "Applied");
    const appliedCount = appliedList.length;
    const savedCount = bookmarks.length + trackedApplications.filter(a => a.status === "Saved").length;

    const closingSoonList = internships.filter(i => {
        const days = getDaysRemaining(i.closingDate);
        return days !== null && days >= 0 && days <= 14;
    });
    const closingSoonCount = closingSoonList.length;
    const totalActivity = viewedCount + trackedApplications.length + bookmarks.length;

    const badge = document.getElementById("trackerBadge");
    if (badge) badge.innerText = String(totalActivity);

    const elViewed = document.getElementById("trackerTotalViewedCount");
    const elApplied = document.getElementById("trackerAppliedCount");
    const elSaved = document.getElementById("trackerSavedCount");
    const elClosing = document.getElementById("trackerClosingSoonCount");
    if (elViewed) elViewed.innerText = String(viewedCount);
    if (elApplied) elApplied.innerText = String(appliedCount);
    if (elSaved) elSaved.innerText = String(savedCount);
    if (elClosing) elClosing.innerText = String(closingSoonCount);

    const tabViewed = document.getElementById("tabCountViewed");
    const tabApplied = document.getElementById("tabCountApplied");
    const tabSaved = document.getElementById("tabCountSaved");
    const tabClosing = document.getElementById("tabCountClosingSoon");
    const tabAll = document.getElementById("tabCountAll");
    if (tabViewed) tabViewed.innerText = String(viewedCount);
    if (tabApplied) tabApplied.innerText = String(appliedCount);
    if (tabSaved) tabSaved.innerText = String(savedCount);
    if (tabClosing) tabClosing.innerText = String(closingSoonCount);
    if (tabAll) tabAll.innerText = String(totalActivity);
}

function trackApplicationVisit(internship) {
    if (!internship) return;
    const exists = trackedApplications.some(a => String(a.internshipId) === String(internship.id));
    if (!exists) {
        trackedApplications.unshift({
            id: Date.now(),
            internshipId: internship.id,
            company: internship.company || "Company",
            title: internship.title || "Internship Role",
            status: "In Progress",
            date: getLocalDateString(),
            link: getSafeApplicationUrl(internship.link),
            notes: "Employer portal link opened. Application pending submission."
        });
        saveApplications();
    }
}

function autoTrackApplication(internshipId) {
    trackApplicationVisit(findInternshipById(internshipId));
}

function markInternshipAsApplied(internshipId) {
    const safeId = String(internshipId);
    const internship = findInternshipById(safeId);
    const existingIndex = trackedApplications.findIndex(a => String(a.internshipId) === safeId);

    if (existingIndex !== -1) {
        trackedApplications[existingIndex].status = "Applied";
        trackedApplications[existingIndex].date = getLocalDateString();
        trackedApplications[existingIndex].notes = "Application submitted on official company portal.";
    } else if (internship) {
        trackedApplications.unshift({
            id: Date.now(),
            internshipId: internship.id,
            company: internship.company || "Company",
            title: internship.title || "Internship Role",
            status: "Applied",
            date: getLocalDateString(),
            link: getSafeApplicationUrl(internship.link),
            notes: "Application submitted on official company portal."
        });
    }

    saveApplications();
    renderTrackerPage();
    displayInternships();
}

function updateApplicationStage(appId, newStatus) {
    const item = trackedApplications.find(a => String(a.id) === String(appId));
    if (item) {
        item.status = newStatus;
        if (newStatus === "Applied" && !item.date) {
            item.date = getLocalDateString();
        }
        saveApplications();
        renderTrackerPage();
    }
}

function openAddTrackerModal() {
    const modal = document.getElementById("addTrackerModal");
    if (modal) {
        const dateInput = document.getElementById("trackDate");
        if (dateInput) dateInput.value = getLocalDateString();
        modal.classList.add("show");
    }
}

function closeAddTrackerModal() {
    const modal = document.getElementById("addTrackerModal");
    if (modal) modal.classList.remove("show");
}

function submitCustomTracker(e) {
    e.preventDefault();
    const company = document.getElementById("trackCompany").value.trim();
    const title = document.getElementById("trackTitle").value.trim();
    const status = document.getElementById("trackStatus").value || "Applied";
    const date = document.getElementById("trackDate").value || getLocalDateString();
    const rawLink = document.getElementById("trackLink").value.trim();
    const link = rawLink ? getSafeApplicationUrl(rawLink) : "";
    const notes = document.getElementById("trackNotes").value.trim();

    if (!company || !title) return;
    if (rawLink && !link) {
        alert("Enter a valid HTTPS application link.");
        document.getElementById("trackLink").focus();
        return;
    }

    trackedApplications.unshift({
        id: Date.now(),
        internshipId: null,
        company,
        title,
        status,
        date,
        link,
        notes
    });

    saveApplications();
    closeAddTrackerModal();
    renderTrackerPage();
}

function filterTrackerStatus(status, tabElement) {
    activeTrackerFilter = status;
    document.querySelectorAll(".tracker-tab").forEach(tab => tab.classList.remove("active"));
    document.querySelectorAll(".tracker-status-tabs [data-status], .tracker-summary-grid [data-status]").forEach(control => {
        control.setAttribute("aria-pressed", String(control.dataset.status === status));
    });
    if (tabElement) {
        tabElement.classList.add("active");
    } else {
        const matchingTab = document.querySelector(`.tracker-tab[data-status="${status}"]`);
        if (matchingTab) matchingTab.classList.add("active");
    }
    renderTrackerPage();
}

function deleteTrackedApplication(id) {
    if (!confirm("Remove this application from your tracker?")) return;
    trackedApplications = trackedApplications.filter(a => String(a.id) !== String(id));
    saveApplications();
    renderTrackerPage();
}

function formatRelativeTime(timestamp) {
    if (!timestamp) return "Recently";
    const diffSec = Math.floor((Date.now() - Number(timestamp)) / 1000);
    if (diffSec < 60) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
}

function renderTrackerPage() {
    updateTrackerMetrics();
    const container = document.getElementById("trackerListContainer");
    if (!container) return;

    // 1. VIEWED TAB
    if (activeTrackerFilter === "viewed") {
        if (!viewedInternships.length) {
            container.innerHTML = `
                <div class="tracker-empty-state">
                    <span style="font-size:32px;display:block;margin-bottom:8px;">👁️</span>
                    <strong>No viewed internships yet</strong>
                    <p class="company mt-4">When you browse and view internship details, they will automatically appear here in real-time!</p>
                    <button class="primary-btn" style="margin-top:14px;" onclick="showPage('preferences')">Explore Internships →</button>
                </div>
            `;
            return;
        }

        container.innerHTML = viewedInternships.map(item => {
            const isBookmarked = bookmarks.some(b => String(b) === String(item.id));
            const isApplied = trackedApplications.some(a => String(a.internshipId) === String(item.id) && a.status === "Applied");
            const safeId = escapeInlineString(item.id);
            const relativeTime = formatRelativeTime(item.viewedAt);
            return `
                <div class="tracker-card">
                    <div class="tracker-card-left">
                        <div class="tracker-card-title">${escapeHTML(item.title)}</div>
                        <div class="tracker-card-company">🏢 ${escapeHTML(item.company)} • 📍 ${escapeHTML(item.location || "Remote")} • 💰 ${escapeHTML(item.stipend || "Not specified")}</div>
                        <div class="tracker-view-meta">
                            <span>👁️ Viewed ${escapeHTML(relativeTime)}</span>
                            <span>•</span>
                            <span class="tag" style="padding:2px 8px;font-size:11px;">${escapeHTML(item.type || "Online")}</span>
                            ${isApplied ? `<span class="status-badge status-applied" style="margin-left:6px;font-size:11px;">✓ Applied</span>` : ""}
                        </div>
                    </div>
                    <div class="tracker-card-right">
                        ${!isApplied ? `                        <button class="secondary-btn tracker-action-button" onclick="markInternshipAsApplied(${safeId})">✅ Mark Applied</button>` : ""}
                        <button class="primary-btn" onclick="apply(${safeId})" style="padding:7px 16px;font-size:13px;">Apply Now ↗</button>
                        <button class="secondary-btn" onclick="bookmark(${safeId});renderTrackerPage();" style="padding:7px 12px;font-size:13px;">
                            ${isBookmarked ? "⭐ Saved" : "☆ Save"}
                        </button>
                        <button class="secondary-btn" onclick="showDetails(${safeId})" style="padding:7px 12px;font-size:13px;">Details</button>
                        <button class="danger-btn" onclick="removeViewedInternship(${safeId})" style="padding:7px 10px;font-size:12px;" title="Remove from viewed history">✕</button>
                    </div>
                </div>
            `;
        }).join("");
        return;
    }

    // 2. APPLIED TAB
    if (activeTrackerFilter === "Applied") {
        const appliedList = trackedApplications.filter(a => ["Applied", "In Progress", "Interviewing", "Offer", "Rejected"].includes(a.status));
        if (!appliedList.length) {
            container.innerHTML = `
                <div class="tracker-empty-state">
                    <span style="font-size:32px;display:block;margin-bottom:8px;">🚀</span>
                    <strong>No tracked applications yet</strong>
                    <p class="company mt-4">When you visit or submit an application, you can track and manage its status here!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = appliedList.map(app => {
            const safeAppId = escapeInlineString(app.id);
            return `
                <div class="tracker-card">
                    <div class="tracker-card-left">
                        <div class="tracker-card-title">${escapeHTML(app.title)}</div>
                        <div class="tracker-card-company">🏢 ${escapeHTML(app.company)} • 🗓 Logged: <strong>${escapeHTML(app.date || "Recently")}</strong></div>
                        ${app.notes ? `<div class="tracker-card-notes">📝 ${escapeHTML(app.notes)}</div>` : ""}
                    </div>
                    <div class="tracker-card-right" style="gap:8px;">
                        <select class="tracker-stage-select" aria-label="Application status for ${escapeHTML(app.title)}" onchange="updateApplicationStage(${safeAppId}, this.value)">
                            <option value="Applied" ${app.status === "Applied" ? "selected" : ""}>🚀 Applied</option>
                            <option value="In Progress" ${app.status === "In Progress" ? "selected" : ""}>⏳ In Progress</option>
                            <option value="Interviewing" ${app.status === "Interviewing" ? "selected" : ""}>🗣️ Interviewing</option>
                            <option value="Offer" ${app.status === "Offer" ? "selected" : ""}>🎉 Offer Received</option>
                            <option value="Rejected" ${app.status === "Rejected" ? "selected" : ""}>❌ Rejected</option>
                        </select>
                        ${app.link ? `<a class="secondary-btn" href="${escapeHTML(app.link)}" target="_blank" rel="noopener noreferrer" style="padding:7px 14px;font-size:13px;text-decoration:none;">Portal ↗</a>` : ""}
                        <button class="danger-btn" onclick="deleteTrackedApplication(${safeAppId})" style="padding:7px 12px;font-size:12px;">Delete</button>
                    </div>
                </div>
            `;
        }).join("");
        return;
    }

    // 3. SAVED TAB
    if (activeTrackerFilter === "Saved") {
        const savedInternships = bookmarks.map(findInternshipById).filter(Boolean);
        const savedApplications = trackedApplications.filter(application => application.status === "Saved");
        if (!savedInternships.length && !savedApplications.length) {
            container.innerHTML = `
                <div class="tracker-empty-state">
                    <span style="font-size:32px;display:block;margin-bottom:8px;">⭐</span>
                    <strong>No saved internships</strong>
                    <p class="company mt-4">Save roles you want to apply for later by clicking the star icon on any card.</p>
                </div>
            `;
            return;
        }

        const savedApplicationCards = savedApplications.map(app => {
            const safeAppId = escapeInlineString(app.id);
            return `
                <div class="tracker-card">
                    <div class="tracker-card-left">
                        <div class="tracker-card-title">${escapeHTML(app.title)}</div>
                        <div class="tracker-card-company">🏢 ${escapeHTML(app.company)} • 🗓 Saved: ${escapeHTML(app.date || "Recently")}</div>
                        ${app.notes ? `<div class="tracker-card-notes">📝 ${escapeHTML(app.notes)}</div>` : ""}
                    </div>
                    <div class="tracker-card-right">
                        <select class="tracker-stage-select" aria-label="Application status for ${escapeHTML(app.title)}" onchange="updateApplicationStage(${safeAppId}, this.value)">
                            <option value="Saved" selected>📌 Saved for Later</option>
                            <option value="Applied">🚀 Applied</option>
                            <option value="In Progress">⏳ In Progress</option>
                            <option value="Interviewing">🗣️ Interviewing</option>
                            <option value="Offer">🎉 Offer Received</option>
                            <option value="Rejected">❌ Rejected</option>
                        </select>
                        ${app.link && getSafeApplicationUrl(app.link) ? `<a class="secondary-btn" href="${escapeHTML(getSafeApplicationUrl(app.link))}" target="_blank" rel="noopener noreferrer" style="padding:7px 14px;font-size:13px;text-decoration:none;">Portal ↗</a>` : ""}
                        <button class="danger-btn" onclick="deleteTrackedApplication(${safeAppId})" style="padding:7px 12px;font-size:12px;">Delete</button>
                    </div>
                </div>
            `;
        });
        container.innerHTML = [...savedApplicationCards, ...savedInternships.map(item => {
            const safeId = escapeInlineString(item.id);
            return `
                <div class="tracker-card">
                    <div class="tracker-card-left">
                        <div class="tracker-card-title">${escapeHTML(item.title)}</div>
                        <div class="tracker-card-company">🏢 ${escapeHTML(item.company)} • 📍 ${escapeHTML(item.location || "Remote")} • 💰 ${escapeHTML(item.stipend || "Not specified")}</div>
                    </div>
                    <div class="tracker-card-right">
                        <button class="primary-btn" onclick="apply(${safeId})" style="padding:7px 16px;font-size:13px;">Apply Now ↗</button>
                        <button class="secondary-btn" onclick="showDetails(${safeId})" style="padding:7px 12px;font-size:13px;">Details</button>
                        <button class="danger-btn" onclick="bookmark(${safeId});renderTrackerPage();" style="padding:7px 10px;font-size:12px;" title="Remove bookmark">✕</button>
                    </div>
                </div>
            `;
        })].join("");
        return;
    }

    // 4. CLOSING SOON TAB
    if (activeTrackerFilter === "ClosingSoon") {
        const closingSoonList = internships.filter(i => {
            const days = getDaysRemaining(i.closingDate);
            return days !== null && days >= 0 && days <= 14;
        }).sort((a, b) => (getDaysRemaining(a.closingDate) || 0) - (getDaysRemaining(b.closingDate) || 0));

        if (!closingSoonList.length) {
            container.innerHTML = `
                <div class="tracker-empty-state">
                    <span style="font-size:32px;display:block;margin-bottom:8px;">⏳</span>
                    <strong>No urgent deadlines in the next 14 days</strong>
                    <p class="company mt-4">All opportunities have ample application windows remaining.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = closingSoonList.map(item => {
            const days = getDaysRemaining(item.closingDate);
            const safeId = escapeInlineString(item.id);
            return `
                <div class="tracker-card" style="border-left:4px solid #ea580c;">
                    <div class="tracker-card-left">
                        <div class="tracker-card-title">${escapeHTML(item.title)}</div>
                        <div class="tracker-card-company">🏢 ${escapeHTML(item.company)} • 📍 ${escapeHTML(item.location || "Remote")}</div>
                        <div class="tracker-closing-meta">
                            ⏰ Closes in ${days === 0 ? "Today!" : `${days} day${days > 1 ? "s" : ""}`} (${escapeHTML(item.closingDate)})
                        </div>
                    </div>
                    <div class="tracker-card-right">
                        <button class="primary-btn" onclick="apply(${safeId})" style="padding:7px 16px;font-size:13px;">Apply Before Deadline ↗</button>
                        <button class="secondary-btn" onclick="showDetails(${safeId})" style="padding:7px 12px;font-size:13px;">Details</button>
                    </div>
                </div>
            `;
        }).join("");
        return;
    }

    // 5. ALL ACTIVITY TAB
    const totalCount = viewedInternships.length + trackedApplications.length + bookmarks.length;
    if (!totalCount) {
        container.innerHTML = `
            <div class="tracker-empty-state">
                <strong>No student activity logged yet</strong>
                <p class="company mt-4">Start exploring internships to build your personal activity history!</p>
            </div>
        `;
        return;
    }

    let combinedHTML = "";
    if (viewedInternships.length) {
        combinedHTML += `<h4 class="tracker-activity-heading">👁️ Recently Viewed (${viewedInternships.length})</h4>`;
        combinedHTML += viewedInternships.slice(0, 5).map(item => `
            <div class="tracker-card" style="margin-bottom:10px;">
                <div class="tracker-card-left">
                    <div class="tracker-card-title">${escapeHTML(item.title)}</div>
                    <div class="tracker-card-company">🏢 ${escapeHTML(item.company)} • 👁️ ${formatRelativeTime(item.viewedAt)}</div>
                </div>
                <div class="tracker-card-right">
                    <button class="primary-btn" onclick="apply(${escapeInlineString(item.id)})" style="padding:6px 14px;font-size:12px;">Apply Now ↗</button>
                    <button class="secondary-btn" onclick="showDetails(${escapeInlineString(item.id)})" style="padding:6px 10px;font-size:12px;">Details</button>
                </div>
            </div>
        `).join("");
    }

    if (trackedApplications.length) {
        combinedHTML += `<h4 class="tracker-activity-heading">🚀 Tracked Applications (${trackedApplications.length})</h4>`;
        combinedHTML += trackedApplications.slice(0, 5).map(app => `
            <div class="tracker-card" style="margin-bottom:10px;">
                <div class="tracker-card-left">
                    <div class="tracker-card-title">${escapeHTML(app.title)}</div>
                    <div class="tracker-card-company">🏢 ${escapeHTML(app.company)} • 🗓 ${escapeHTML(app.date || "")}</div>
                    ${app.notes ? `<div class="tracker-card-notes">📝 ${escapeHTML(app.notes)}</div>` : ""}
                </div>
                <div class="tracker-card-right">
                    <span class="status-badge ${getTrackerStatusClass(app.status)}">${escapeHTML(app.status || "In Progress")}</span>
                    ${app.link && getSafeApplicationUrl(app.link) ? `<a class="secondary-btn" href="${escapeHTML(getSafeApplicationUrl(app.link))}" target="_blank" rel="noopener noreferrer" style="padding:6px 12px;font-size:12px;text-decoration:none;">Portal ↗</a>` : ""}
                </div>
            </div>
        `).join("");
    }

    container.innerHTML = combinedHTML;
}

function getTrackerStatusClass(status) {
    return {
        Applied: "status-applied",
        Interviewing: "status-interviewing",
        Offer: "status-offer",
        Rejected: "status-rejected",
        Saved: "status-saved",
        "In Progress": "status-saved"
    }[status] || "status-saved";
}

/* =========================================================
   FEATURE 1: STATS & INSIGHTS DASHBOARD (EXECUTIVE TELEMETRY)
========================================================= */
function selectSkillSearch(skillName) {
    if (!skillName) return;
    showPage("home");
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
        searchInput.value = skillName;
        displayInternships();
        const section = document.getElementById("home");
        if (section) section.scrollIntoView({ behavior: "smooth" });
    }
}

function renderInsightsDashboard() {
    const totalRoles = internships.length;
    const indiaRoles = internships.filter(isIndiaBasedListing).length;
    const remoteRoles = internships.filter(i => i.type === "Online" || /remote|virtual|online/i.test(i.location || "")).length;
    const configuredBoardsEl = document.getElementById("configuredJobBoardsCount");
    const boardsCount = configuredBoardsEl ? configuredBoardsEl.innerText : "46";

    // 1. KPI Numbers
    const elTotal = document.getElementById("kpiTotalRoles");
    const elIndia = document.getElementById("kpiIndiaRoles");
    const elRemote = document.getElementById("kpiRemoteRoles");
    const elBoards = document.getElementById("kpiBoardsCount");
    if (elTotal) elTotal.innerText = String(totalRoles);
    if (elIndia) elIndia.innerText = `${indiaRoles} (${totalRoles ? Math.round((indiaRoles / totalRoles) * 100) : 0}%)`;
    if (elRemote) elRemote.innerText = `${remoteRoles} (${totalRoles ? Math.round((remoteRoles / totalRoles) * 100) : 0}%)`;
    if (elBoards) elBoards.innerText = String(boardsCount);

    // 2. Top Hiring Companies Leaderboard
    const companyCounts = {};
    internships.forEach(i => {
        const c = String(i.company || "Other").trim();
        if (c && c.toLowerCase() !== "unknown" && c.toLowerCase() !== "not specified") {
            companyCounts[c] = (companyCounts[c] || 0) + 1;
        }
    });
    const sortedCompanies = Object.entries(companyCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const maxComp = sortedCompanies[0]?.[1] || 1;
    const companiesContainer = document.getElementById("topCompaniesList");
    if (companiesContainer) {
        companiesContainer.innerHTML = sortedCompanies.map(([name, count], index) => {
            const pct = Math.round((count / (totalRoles || 1)) * 100);
            return `
                <div class="analytics-bar-item">
                    <div class="analytics-bar-label">
                        <span><strong>#${index + 1}</strong> ${escapeHTML(name)}</span>
                        <span><strong>${count}</strong> openings <small style="color:#64748b;">(${pct}%)</small></span>
                    </div>
                    <div class="analytics-bar-track">
                        <div class="analytics-bar-fill" style="width:${Math.round((count / maxComp) * 100)}%"></div>
                    </div>
                </div>
            `;
        }).join("") || "<p class='company'>No company statistics available.</p>";
    }

    // 3. Most In-Demand Skills with Interactive Search
    const skillCounts = {};
    internships.forEach(i => {
        if (Array.isArray(i.skills)) {
            i.skills.forEach(s => {
                const clean = String(s).trim();
                if (clean && clean.length > 1 && !["not specified", "unknown", "n/a"].includes(clean.toLowerCase())) {
                    skillCounts[clean] = (skillCounts[clean] || 0) + 1;
                }
            });
        }
    });
    const sortedSkills = Object.entries(skillCounts).sort((a, b) => b[1] - a[1]).slice(0, 14);
    const skillsCloud = document.getElementById("topSkillsCloud");
    if (skillsCloud) {
        skillsCloud.innerHTML = sortedSkills.map(([skill, count]) => {
            const safeSkill = escapeInlineString(skill);
            return `
                <button type="button" class="skill-pill" onclick='selectSkillSearch(${safeSkill})' title="Filter internships requiring ${escapeHTML(skill)}">
                    ${escapeHTML(skill)}
                    <span class="skill-pill-count">${count}</span>
                </button>
            `;
        }).join("") || "<p class='company'>No skill tags available.</p>";
    }

    // 4. Top Locations in India with Smarter Pattern Matching
    const hubNames = [
        ["Bengaluru", /\b(bengaluru|bangalore)\b/i],
        ["Delhi-NCR / Gurgaon", /\b(delhi|gurgaon|gurugram|noida|ncr)\b/i],
        ["Hyderabad", /\bhyderabad\b/i],
        ["Pune", /\bpune\b/i],
        ["Mumbai", /\bmumbai\b/i],
        ["Chennai", /\bchennai\b/i],
        ["Remote (India / Global)", /\b(remote|online|virtual|anywhere)\b/i]
    ];
    const hubCounts = hubNames.map(([label, pattern]) => {
        const count = internships.filter(i => pattern.test(i.location || "")).length;
        return [label, count];
    }).sort((a, b) => b[1] - a[1]);
    const maxHub = Math.max(...hubCounts.map(h => h[1]), 1);
    const hubsContainer = document.getElementById("topLocationsList");
    if (hubsContainer) {
        hubsContainer.innerHTML = hubCounts.map(([city, count]) => `
            <div class="analytics-bar-item">
                <div class="analytics-bar-label">
                    <span>📍 ${city}</span>
                    <strong>${count} roles</strong>
                </div>
                <div class="analytics-bar-track">
                    <div class="analytics-bar-fill" style="width:${Math.round((count / maxHub) * 100)}%"></div>
                </div>
            </div>
        `).join("");
    }

    // 5. Work Arrangement Breakdown with Rich Multi-Color Bars
    const online = internships.filter(i => i.type === "Online" || /remote|virtual|online/i.test(i.location || "")).length;
    const offline = internships.filter(i => i.type === "Offline" && !/remote|virtual|online/i.test(i.location || "")).length;
    const hybrid = internships.filter(i => i.type === "Hybrid").length;
    const breakdownContainer = document.getElementById("workModeBreakdown");
    if (breakdownContainer) {
        const total = totalRoles || 1;
        breakdownContainer.innerHTML = `
            <div class="analytics-bar-item">
                <div class="analytics-bar-label"><span>🌐 Online / Remote (${Math.round((online/total)*100)}%)</span><strong>${online} roles</strong></div>
                <div class="analytics-bar-track"><div class="analytics-bar-fill" style="width:${Math.round((online/total)*100)}%"></div></div>
            </div>
            <div class="analytics-bar-item">
                <div class="analytics-bar-label"><span>🏢 In-Person / Onsite (${Math.round((offline/total)*100)}%)</span><strong>${offline} roles</strong></div>
                <div class="analytics-bar-track"><div class="analytics-bar-fill" style="width:${Math.round((offline/total)*100)}%;background:#f59e0b;"></div></div>
            </div>
            <div class="analytics-bar-item">
                <div class="analytics-bar-label"><span>🔄 Hybrid (${Math.round((hybrid/total)*100)}%)</span><strong>${hybrid} roles</strong></div>
                <div class="analytics-bar-track"><div class="analytics-bar-fill" style="width:${Math.round((hybrid/total)*100)}%;background:#6366f1;"></div></div>
            </div>
        `;
    }
}

/* =========================================================
   FEATURE 8: COMPANY REVIEWS & RATINGS
========================================================= */
let currentCompanyForReview = "";
const sampleReviewsStore = {
    "google": [
        { name: "Akhil K. (CSE)", rating: 5, difficulty: "Hard", role: "Software Engineering Intern", comment: "Outstanding mentorship, cutting-edge projects in distributed systems, and very supportive team culture.", tips: "Practice graph algorithms and dynamic programming. Strong system design fundamentals are rewarded." },
        { name: "Sneha M. (IT)", rating: 5, difficulty: "Hard", role: "Cloud Technical Intern", comment: "Fast-paced environment, generous stipend, and great conversion rates for dedicated students.", tips: "Be crystal clear on OS concepts, networking, and clean coding practices." }
    ],
    "microsoft": [
        { name: "Varun R. (CSE)", rating: 5, difficulty: "Medium", role: "SDE Intern", comment: "Amazing work-life balance and high focus on learning. Mentors hold weekly 1-on-1s.", tips: "LeetCode Mediums on Trees, Graphs, and HashMaps are sufficient. Communicate your thought process clearly." }
    ],
    "technovaai": [
        { name: "Praveen T. (AI&DS)", rating: 4, difficulty: "Medium", role: "Machine Learning Intern", comment: "Worked on real-time computer vision inference models. Great hands-on production experience.", tips: "Brush up PyTorch, model optimization, and Docker deployment basics." }
    ]
};

function getSanitizedCompanyKey(company) {
    return String(company || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function openCompanyReviews(companyName) {
    currentCompanyForReview = companyName;
    const modal = document.getElementById("companyReviewsModal");
    if (!modal) return;

    const key = getSanitizedCompanyKey(companyName);
    const reviews = sampleReviewsStore[key] || [
        { name: "SVEC Senior", rating: 4, difficulty: "Medium", role: "Software Intern", comment: "Good learning curve, fair assessment process, and responsive engineering team.", tips: "Prepare basic DSA, OOPs concepts, and your resume projects thoroughly." }
    ];

    const header = document.getElementById("companyReviewsHeader");
    const countEl = document.getElementById("companyReviewsCount");
    if (header) {
        const avg = (reviews.reduce((acc, r) => acc + Number(r.rating || 4), 0) / reviews.length).toFixed(1);
        header.innerHTML = `
            <h2 id="reviewsModalTitle" style="margin-bottom:4px;color:#0f766e;">🏢 ${escapeHTML(companyName)} Reviews</h2>
            <div style="font-size:15px;font-weight:700;color:#16a34a;margin-bottom:6px;">⭐ ${avg} / 5.0 Rating • ${reviews.length} Verified Student Reviews</div>
            <p class="company">Interview insights, difficulty ratings, and work culture submitted by seniors.</p>
        `;
    }
    if (countEl) countEl.innerText = reviews.length;

    renderCompanyReviewsList(reviews);
    switchReviewsTab("view");
    modal.classList.add("show");
}

function closeReviewsModal() {
    const modal = document.getElementById("companyReviewsModal");
    if (modal) modal.classList.remove("show");
}

function switchReviewsTab(tab) {
    const viewPane = document.getElementById("reviewsViewPane");
    const writePane = document.getElementById("reviewsWritePane");
    const tabView = document.getElementById("tabViewReviews");
    const tabWrite = document.getElementById("tabWriteReview");

    if (tab === "view") {
        viewPane.hidden = false;
        writePane.hidden = true;
        tabView.classList.add("active");
        tabWrite.classList.remove("active");
    } else {
        viewPane.hidden = true;
        writePane.hidden = false;
        tabView.classList.remove("active");
        tabWrite.classList.add("active");
    }
}

function renderCompanyReviewsList(reviews) {
    const list = document.getElementById("companyReviewsList");
    if (!list) return;

    list.innerHTML = reviews.map(r => {
        const stars = "⭐".repeat(Math.max(1, Math.min(5, Number(r.rating || 4))));
        const diffClass = r.difficulty === "Easy" ? "diff-easy" : r.difficulty === "Hard" ? "diff-hard" : "diff-medium";
        return `
            <div class="review-item-card">
                <div class="review-item-top">
                    <div>
                        <strong>${escapeHTML(r.name || "Student")}</strong>
                        <span style="font-size:12px;color:#64748b;margin-left:8px;">${escapeHTML(r.role || "Intern")}</span>
                    </div>
                    <span class="difficulty-badge ${diffClass}">${escapeHTML(r.difficulty)} Difficulty</span>
                </div>
                <div style="margin-bottom:6px;">${stars}</div>
                <p style="font-size:13px;line-height:1.5;margin-bottom:8px;">${escapeHTML(r.comment)}</p>
                ${r.tips ? `<div style="font-size:12px;color:#0f766e;background:#f0fdfa;padding:6px 10px;border-radius:6px;">💡 <strong>Junior Tips:</strong> ${escapeHTML(r.tips)}</div>` : ""}
            </div>
        `;
    }).join("");
}

function submitCompanyReview(e) {
    e.preventDefault();
    const rating = Number(document.getElementById("reviewRating").value);
    const difficulty = document.getElementById("reviewDifficulty").value;
    const role = document.getElementById("reviewRole").value.trim();
    const comment = document.getElementById("reviewComment").value.trim();
    const tips = document.getElementById("reviewTips").value.trim();

    const key = getSanitizedCompanyKey(currentCompanyForReview);
    if (!sampleReviewsStore[key]) sampleReviewsStore[key] = [];

    const newReview = {
        name: currentStudent ? `${currentStudent.name.split(" ")[0]} (${currentStudent.branch || "SVEC"})` : "SVEC Student",
        rating, difficulty, role, comment, tips
    };

    sampleReviewsStore[key].unshift(newReview);
    if (isFirebaseConfigured()) {
        try {
            ensureFirebase();
            firebase.database().ref(`company_reviews/${key}`).push(newReview).catch(console.warn);
        } catch (err) {}
    }

    renderCompanyReviewsList(sampleReviewsStore[key]);
    switchReviewsTab("view");
    alert("Thank you! Your company review has been submitted for fellow students.");
}

/* =========================================================
   FEATURE: ATS RESUME CHECKER & SCORER
========================================================= */
const ATS_SKILL_KEYWORDS = [
    "python", "javascript", "typescript", "java", "c++", "c#", "c", "ruby", "php", "swift", "kotlin", "go", "golang", "rust", "r", "dart",
    "html", "html5", "css", "css3", "react", "react.js", "next.js", "vue", "angular", "node.js", "express", "tailwind", "bootstrap", "sass", "redux", "rest api", "graphql", "json", "dom", "ajax",
    "django", "flask", "spring", "spring boot", "fastapi", "sql", "mysql", "postgresql", "mongodb", "nosql", "firebase", "supabase", "aws", "azure", "gcp", "docker", "kubernetes", "linux", "git", "github", "ci/cd", "nginx", "jenkins",
    "machine learning", "deep learning", "artificial intelligence", "data science", "nlp", "computer vision", "tensorflow", "pytorch", "pandas", "numpy", "scikit-learn", "data analytics", "power bi", "tableau", "excel", "big data", "hadoop", "spark",
    "android", "ios", "flutter", "react native", "data structures", "algorithms", "dsa", "oops", "dbms", "operating systems", "computer networks",
    "agile", "scrum", "problem solving", "communication", "teamwork", "leadership", "critical thinking", "collaboration", "debugging", "unit testing", "system design"
];

const ATS_ACTION_VERBS = [
    "developed", "built", "created", "designed", "implemented", "engineered", "optimized",
    "led", "collaborated", "managed", "deployed", "integrated", "automated", "enhanced",
    "reduced", "increased", "resolved", "architected", "delivered", "executed", "configured",
    "analyzed", "spearheaded", "refactored", "maintained", "conducted", "trained"
];

function initAtsPage() {
    if (window.pdfjsLib && !window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }

    const select = document.getElementById("atsJobSelect");
    if (select) {
        const currentVal = select.value;
        const liveList = (Array.isArray(internships) && internships.length) ? internships : [];
        select.innerHTML = '<option value="">-- Choose from active internships --</option>' +
            liveList.map(item => `<option value="${escapeHTML(item.id)}">${escapeHTML(item.title)} - ${escapeHTML(item.company)} (${escapeHTML(item.type)})</option>`).join("");
        if (currentVal) select.value = currentVal;
    }

    setupAtsDropzone();
}

function setupAtsDropzone() {
    const dropzone = document.getElementById("atsDropzone");
    if (!dropzone || dropzone.dataset.bound === "true") return;
    dropzone.dataset.bound = "true";

    ["dragenter", "dragover"].forEach(eventName => {
        dropzone.addEventListener(eventName, e => {
            e.preventDefault();
            dropzone.classList.add("drag-over");
        });
    });

    ["dragleave", "drop"].forEach(eventName => {
        dropzone.addEventListener(eventName, e => {
            e.preventDefault();
            dropzone.classList.remove("drag-over");
        });
    });

    dropzone.addEventListener("drop", e => {
        const file = e.dataTransfer && e.dataTransfer.files ? e.dataTransfer.files[0] : null;
        if (file) processResumeFile(file);
    });
}

async function handleResumeFileUpload(event) {
    const file = event.target.files ? event.target.files[0] : null;
    if (file) await processResumeFile(file);
}

async function processResumeFile(file) {
    const fileNameEl = document.getElementById("atsFileName");
    const resumeTextarea = document.getElementById("atsResumeText");
    if (!file || !resumeTextarea) return;

    if (fileNameEl) {
        fileNameEl.innerText = `Selected: ${file.name} (${Math.round(file.size / 1024)} KB)`;
        fileNameEl.hidden = false;
    }

    const fileExt = file.name.split(".").pop().toLowerCase();

    if (fileExt === "pdf") {
        if (!window.pdfjsLib) {
            alert("PDF library is loading. Please paste text directly or retry in 2 seconds.");
            return;
        }
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let fullText = "";

            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();
                const pageStrings = textContent.items.map(item => item.str).join(" ");
                fullText += pageStrings + "\n\n";
            }

            resumeTextarea.value = fullText.trim();
            updateAtsWordCounts();
        } catch (err) {
            console.error("PDF read error:", err);
            alert("Could not parse this PDF. Please copy and paste the text manually into the box below.");
        }
    } else {
        try {
            const text = await file.text();
            resumeTextarea.value = text.trim();
            updateAtsWordCounts();
        } catch (err) {
            console.error("File read error:", err);
            alert("Could not read text file. Please paste your resume text manually.");
        }
    }
}

function useProfileAsResume() {
    if (!currentStudent) {
        alert("Please login first to load your profile details!");
        return;
    }

    const resumeTextarea = document.getElementById("atsResumeText");
    if (!resumeTextarea) return;

    const studentSkills = Array.isArray(currentStudent.skills)
        ? currentStudent.skills.join(", ")
        : (currentStudent.skills || "Python, Data Structures, Web Development, SQL");

    const template = `${currentStudent.name || "Student"}
Email: ${currentStudent.email || "student@srivasaviengg.ac.in"} | Phone: ${currentStudent.phone || "+91 9876543210"}
Branch: ${currentStudent.branch || "Computer Science Engineering"} | Roll No: ${currentStudent.rollNumber || "21A81A0501"}
Location: ${currentStudent.preferredLocation || "Tadepalligudem / Hyderabad"}

PROFESSIONAL SUMMARY:
Dedicated engineering graduate from Sri Vasavi Engineering College with strong fundamentals in ${currentStudent.branch || "software development"}. Passionate about building robust systems and solving real-world problems.

TECHNICAL SKILLS:
${studentSkills}

EDUCATION:
Bachelor of Technology in ${currentStudent.branch || "Computer Science and Engineering"}
Sri Vasavi Engineering College, Pedatadepalli, Tadepalligudem (CGPA: 8.4/10)
Expected Graduation: 2026

PROJECTS & EXPERIENCE:
• Web Application Development: Engineered a responsive portal with modern authentication, real-time sync, and REST API integration. Optimized performance by 35%.
• Machine Learning Classifier: Developed a predictive model using Python, Scikit-Learn, and Pandas to classify real-world datasets with 91% accuracy.

ACHIEVEMENTS & CERTIFICATIONS:
• Completed technical certifications in modern full-stack development and data structures.
• Active coding contributor on GitHub and technical hackathons.`;

    resumeTextarea.value = template;
    updateAtsWordCounts();
}

function onAtsJobSelect(internshipId) {
    const jdTextarea = document.getElementById("atsJdText");
    if (!jdTextarea) return;

    if (!internshipId) {
        jdTextarea.value = "";
        updateAtsWordCounts();
        return;
    }

    const item = findInternshipById(internshipId);
    if (!item) return;

    const skillsStr = Array.isArray(item.skills) ? item.skills.join(", ") : (item.skills || "Not specified");

    const formattedJD = `Role: ${item.title}
Company: ${item.company}
Work Mode: ${item.type} | Location: ${item.location || "Remote / Onsite"}
Stipend: ${item.stipend || "Best in industry"} | Duration: ${item.duration || "Flexible"}

Required Technical Skills:
${skillsStr}

Job Description & Responsibilities:
${item.description || "Looking for passionate interns with strong problem solving skills, good understanding of fundamental algorithms, and eager to build scalable solutions in a fast-paced environment."}`;

    jdTextarea.value = formattedJD;
    updateAtsWordCounts();
}

function updateAtsWordCounts() {
    const resumeText = document.getElementById("atsResumeText")?.value.trim() || "";
    const jdText = document.getElementById("atsJdText")?.value.trim() || "";

    const resumeWords = resumeText ? resumeText.split(/\s+/).length : 0;
    const jdWords = jdText ? jdText.split(/\s+/).length : 0;

    const resumeCountEl = document.getElementById("atsResumeCharCount");
    const resumeReadEl = document.getElementById("atsResumeReadability");
    const jdCountEl = document.getElementById("atsJdCharCount");

    if (resumeCountEl) resumeCountEl.innerText = `${resumeWords} words`;
    if (jdCountEl) jdCountEl.innerText = `${jdWords} words`;

    if (resumeReadEl) {
        if (resumeWords === 0) resumeReadEl.innerText = "";
        else if (resumeWords < 150) resumeReadEl.innerText = "⚠️ Short resume";
        else if (resumeWords > 800) resumeReadEl.innerText = "⚠️ Exceeds 1-page length";
        else resumeReadEl.innerText = "✅ Good 1-page length";
    }
}

function clearAtsForm() {
    const resumeEl = document.getElementById("atsResumeText");
    const jdEl = document.getElementById("atsJdText");
    const selectEl = document.getElementById("atsJobSelect");
    const fileInput = document.getElementById("atsFileInput");
    const fileNameEl = document.getElementById("atsFileName");
    const resultsEl = document.getElementById("atsResultsSection");

    if (resumeEl) resumeEl.value = "";
    if (jdEl) jdEl.value = "";
    if (selectEl) selectEl.value = "";
    if (fileInput) fileInput.value = "";
    if (fileNameEl) { fileNameEl.innerText = ""; fileNameEl.hidden = true; }
    if (resultsEl) resultsEl.hidden = true;

    updateAtsWordCounts();
}

function extractKeywordsFromText(text) {
    if (!text) return [];
    const normalized = text.toLowerCase();
    const found = new Set();

    ATS_SKILL_KEYWORDS.forEach(skill => {
        const regex = new RegExp(`(^|[^a-z0-9#+])${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=[^a-z0-9#+]|$)`, "i");
        if (regex.test(normalized)) {
            found.add(skill);
        }
    });

    return Array.from(found);
}

async function copyAtsKeyword(keyword) {
    try {
        await navigator.clipboard.writeText(keyword);
        alert(`Copied keyword: ${keyword}`);
    } catch (error) {
        console.error("Could not copy ATS keyword.", error);
        alert("Could not copy automatically. Select and copy the keyword manually.");
    }
}

function runAtsAnalysis() {
    const resumeText = document.getElementById("atsResumeText")?.value.trim() || "";
    const jdText = document.getElementById("atsJdText")?.value.trim() || "";

    if (!resumeText) {
        alert("Please paste or upload your resume first!");
        document.getElementById("atsResumeText")?.focus();
        return;
    }
    if (!jdText) {
        alert("Please paste the job description or select an internship from the dropdown!");
        document.getElementById("atsJdText")?.focus();
        return;
    }

    const jdKeywords = extractKeywordsFromText(jdText);
    const resumeKeywords = extractKeywordsFromText(resumeText);

    // If JD doesn't mention standard keywords, fallback to extracting significant words
    const effectiveJdKeywords = jdKeywords.length > 0 ? jdKeywords : ["problem solving", "communication", "python", "data structures", "git"];

    const matchedKeywords = effectiveJdKeywords.filter(k => resumeKeywords.includes(k));
    const missingKeywords = effectiveJdKeywords.filter(k => !resumeKeywords.includes(k));

    // 1. Keyword Score (45% weight)
    const keywordMatchRatio = matchedKeywords.length / effectiveJdKeywords.length;
    const keywordScore = Math.round(keywordMatchRatio * 100);

    // 2. Standard Sections (20% weight)
    const resumeLower = resumeText.toLowerCase();
    let sectionsFound = 0;
    const sectionsStatus = [];

    // Contact Info
    if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(resumeText) || /\b\d{10}\b|\+\d{2}/.test(resumeText)) {
        sectionsFound++;
        sectionsStatus.push("Contact Details");
    }
    // Education
    if (/\b(?:education|b\.?tech|degree|college|university|cgpa|gpa|intermediate|diploma)\b/i.test(resumeLower)) {
        sectionsFound++;
        sectionsStatus.push("Education");
    }
    // Skills
    if (/\b(?:skills|technologies|technical proficiencies|tech stack|competencies)\b/i.test(resumeLower)) {
        sectionsFound++;
        sectionsStatus.push("Skills");
    }
    // Experience / Projects
    if (/\b(?:projects|project|experience|internship|work history)\b/i.test(resumeLower)) {
        sectionsFound++;
        sectionsStatus.push("Projects / Experience");
    }
    // Certifications / Achievements
    if (/\b(?:certifications|certificates|achievements|awards|activities|leadership)\b/i.test(resumeLower)) {
        sectionsFound++;
        sectionsStatus.push("Certifications / Achievements");
    }
    const sectionScore = Math.round((sectionsFound / 5) * 100);

    // 3. Action Verbs (20% weight)
    let verbsFoundCount = 0;
    ATS_ACTION_VERBS.forEach(verb => {
        const regex = new RegExp(`\\b${verb}\\b`, "i");
        if (regex.test(resumeLower)) verbsFoundCount++;
    });
    const verbScore = Math.min(100, Math.round((verbsFoundCount / 5) * 100));

    // 4. Quantified Metrics (15% weight)
    const metricMatches = resumeText.match(/\b\d+%(?!\w)|\b\d+\+(?!\w)|\b\d+x\b|\b\d{2,}\b/g) || [];
    const metricCount = metricMatches.length;
    const metricScore = Math.min(100, Math.round((metricCount / 4) * 100));

    // Overall Weighted Score
    let overallScore = Math.round(
        (keywordScore * 0.45) +
        (sectionScore * 0.20) +
        (verbScore * 0.20) +
        (metricScore * 0.15)
    );
    overallScore = Math.max(20, Math.min(98, overallScore));

    // Render Metrics
    document.getElementById("atsScoreNumber").innerText = `${overallScore}%`;
    const scoreCircle = document.getElementById("atsScoreCircle");
    if (scoreCircle) {
        const circumference = 314;
        const offset = circumference - (circumference * overallScore / 100);
        scoreCircle.style.strokeDashoffset = offset;
        scoreCircle.style.stroke = overallScore >= 75 ? "#34d399" : (overallScore >= 55 ? "#fbbf24" : "#f87171");
    }

    const badgeEl = document.getElementById("atsRatingBadge");
    const titleEl = document.getElementById("atsScoreTitle");
    const summaryEl = document.getElementById("atsScoreSummary");

    if (overallScore >= 75) {
        if (badgeEl) { badgeEl.innerText = "🟢 Highly ATS Optimized"; badgeEl.style.background = "rgba(52, 211, 153, 0.3)"; }
        if (titleEl) titleEl.innerText = "Strong Match for This Role!";
        if (summaryEl) summaryEl.innerText = `Your resume has excellent alignment with ${matchedKeywords.length} matching skills and solid structural formatting. You have a high probability of passing initial automated filters.`;
    } else if (overallScore >= 55) {
        if (badgeEl) { badgeEl.innerText = "🟡 Moderate Match - Minor Gaps"; badgeEl.style.background = "rgba(251, 191, 36, 0.3)"; }
        if (titleEl) titleEl.innerText = "Good Foundation with Skill Gaps";
        if (summaryEl) summaryEl.innerText = `Your profile aligns moderately with the requirements. Adding the missing ${missingKeywords.length} keywords will significantly increase your callback rate.`;
    } else {
        if (badgeEl) { badgeEl.innerText = "🔴 Needs Optimization"; badgeEl.style.background = "rgba(248, 113, 113, 0.3)"; }
        if (titleEl) titleEl.innerText = "Low Keyword Match";
        if (summaryEl) summaryEl.innerText = `The automated ATS system may filter this resume out before human recruiters see it. Review the missing skill tags and recommendations below.`;
    }

    // Update 4 Pillar cards
    document.getElementById("atsMetricKeywords").innerText = `${keywordScore}%`;
    document.getElementById("atsMetricKeywordsSub").innerText = `${matchedKeywords.length} of ${effectiveJdKeywords.length} skills`;

    document.getElementById("atsMetricSections").innerText = `${sectionScore}%`;
    document.getElementById("atsMetricSectionsSub").innerText = `${sectionsFound} of 5 sections`;

    document.getElementById("atsMetricVerbs").innerText = `${verbScore}%`;
    document.getElementById("atsMetricVerbsSub").innerText = `${verbsFoundCount} action verbs`;

    document.getElementById("atsMetricMetrics").innerText = `${metricScore}%`;
    document.getElementById("atsMetricMetricsSub").innerText = `${metricCount} metrics / stats`;

    // Render Skill Badges
    const matchedContainer = document.getElementById("atsMatchedSkills");
    const missingContainer = document.getElementById("atsMissingSkills");
    document.getElementById("atsMatchedCount").innerText = matchedKeywords.length;
    document.getElementById("atsMissingCount").innerText = missingKeywords.length;

    if (matchedContainer) {
        matchedContainer.innerHTML = matchedKeywords.length
            ? matchedKeywords.map(k => `<span class="ats-skill-badge ats-skill-matched">✓ ${escapeHTML(k)}</span>`).join("")
            : `<span style="font-size:12px; color:#64748b;">No direct skill matches found. Check spellings or add keywords.</span>`;
    }

    if (missingContainer) {
        missingContainer.innerHTML = missingKeywords.length
            ? missingKeywords.map(k => `<button type="button" class="ats-skill-badge ats-skill-missing" title="Copy keyword" onclick="copyAtsKeyword(${escapeInlineString(k)})">+ ${escapeHTML(k)}</button>`).join("")
            : `<span style="font-size:12px; color:#166534;">🎉 Congratulations! You have covered all detected job keywords.</span>`;
    }

    // Generate Tailored Tips
    const tipsList = document.getElementById("atsTipsList");
    if (tipsList) {
        const tips = [];
        if (missingKeywords.length > 0) {
            tips.push({
                icon: "🎯",
                text: `<strong>Integrate Missing Keywords:</strong> Incorporate high-frequency terms like <em>${missingKeywords.slice(0, 4).join(", ")}</em> naturally into your skills section and project bullet points.`
            });
        }
        if (verbsFoundCount < 4) {
            tips.push({
                icon: "🚀",
                text: `<strong>Use Strong Action Verbs:</strong> Begin your project bullet points with impact verbs like <em>Engineered, Architected, Optimized, Deployed</em> rather than passive verbs like <em>Worked on, Assisted with</em>.`
            });
        }
        if (metricCount < 2) {
            tips.push({
                icon: "📊",
                text: `<strong>Quantify Project Results:</strong> ATS and engineering managers love metrics. Add percentages or measurable stats (e.g. <em>"Optimized query response time by 40%"</em> or <em>"Handled 500+ requests"</em>).`
            });
        }
        if (sectionsFound < 4) {
            tips.push({
                icon: "📑",
                text: `<strong>Add Missing Standard Sections:</strong> Ensure your resume has explicit section headers for <em>Education, Technical Skills, Projects, and Certifications</em>.`
            });
        }
        tips.push({
            icon: "📄",
            text: `<strong>ATS Formatting Tip:</strong> Keep the resume in a clean single-column format without tables, complex graphics, or embedded icons for best machine-reading accuracy.`
        });

        tipsList.innerHTML = tips.map(tip => `
            <li class="ats-tip-item">
                <span class="ats-tip-icon">${tip.icon}</span>
                <div>${tip.text}</div>
            </li>
        `).join("");
    }

    const resultsEl = document.getElementById("atsResultsSection");
    if (resultsEl) {
        resultsEl.hidden = false;
        resultsEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
}

/* =========================================================
   FEATURE: AI COVER LETTER GENERATOR
========================================================= */
function initCoverLetterPage() {
    const select = document.getElementById("clJobSelect");
    if (select) {
        const currentVal = select.value;
        const liveList = (Array.isArray(internships) && internships.length) ? internships : [];
        select.innerHTML = '<option value="">-- Choose from live internships --</option>' +
            liveList.map(item => `<option value="${escapeHTML(item.id)}">${escapeHTML(item.title)} - ${escapeHTML(item.company)}</option>`).join("");
        if (currentVal) select.value = currentVal;
    }

    if (currentStudent && !document.getElementById("clSkills")?.value) {
        autoFillCoverLetterProfile();
    }
}

function onCoverLetterJobSelect(internshipId) {
    if (!internshipId) return;
    const item = findInternshipById(internshipId);
    if (!item) return;

    const roleInput = document.getElementById("clTargetRole");
    const companyInput = document.getElementById("clTargetCompany");
    const skillsInput = document.getElementById("clSkills");

    if (roleInput) roleInput.value = item.title || "";
    if (companyInput) companyInput.value = item.company || "";

    const jobSkills = Array.isArray(item.skills) ? item.skills.join(", ") : (item.skills || "");
    if (skillsInput && jobSkills && !skillsInput.value.trim()) {
        skillsInput.value = jobSkills;
    }
}

function autoFillCoverLetterProfile() {
    if (!currentStudent) {
        alert("Please login first to load profile information!");
        return;
    }

    const skillsInput = document.getElementById("clSkills");
    const highlightsInput = document.getElementById("clHighlights");

    const studentSkills = Array.isArray(currentStudent.skills)
        ? currentStudent.skills.join(", ")
        : (currentStudent.skills || "");

    if (skillsInput && studentSkills) {
        skillsInput.value = studentSkills;
    }

    if (highlightsInput && currentStudent.bio && !highlightsInput.value.trim()) {
        highlightsInput.value = currentStudent.bio;
    }
}

function generateCoverLetter() {
    const role = (document.getElementById("clTargetRole")?.value || "").trim();
    const company = (document.getElementById("clTargetCompany")?.value || "").trim();
    const tone = document.getElementById("clTone")?.value || "confident";
    const level = document.getElementById("clExperienceLevel")?.value || "fresher";
    const skills = (document.getElementById("clSkills")?.value || "").trim();
    const highlights = (document.getElementById("clHighlights")?.value || "").trim();

    if (!role || !company) {
        alert("Please enter both Target Role and Company Name!");
        document.getElementById("clTargetRole")?.focus();
        return;
    }

    const studentName = currentStudent?.name || "Applicant";
    const studentEmail = currentStudent?.email || "student@srivasaviengg.ac.in";
    const studentPhone = currentStudent?.phone || "+91 9876543210";
    const studentBranch = currentStudent?.branch || "Computer Science and Engineering";
    const college = currentStudent?.college || "Sri Vasavi Engineering College";
    const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    let salutation = `Dear Hiring Team at ${company},`;
    if (tone === "formal" || tone === "professional") {
        salutation = `Dear Hiring Manager,\n${company} Recruitment Team,`;
    }

    let opening = "";
    if (tone === "concise") {
        opening = `I am writing to express my enthusiastic interest in the ${role} position at ${company}. As an engineering student in ${studentBranch} at ${college}, I have developed strong foundational problem-solving capabilities and technical competencies in ${skills || "core engineering principles"}, and I am eager to contribute directly to your team's upcoming initiatives.`;
    } else if (tone === "research") {
        opening = `I am submitting my application for the ${role} opening at ${company} with great interest. Currently pursuing my studies in ${studentBranch} at ${college}, I have maintained a focused academic interest in analytical engineering, algorithmic design, and emerging technological frameworks. I look forward to applying my analytical rigor to high-impact projects at ${company}.`;
    } else {
        opening = `I am thrilled to submit my application for the ${role} position at ${company}. Having followed ${company}'s impressive engineering milestones and innovative culture, I am eager to bring my drive, proactive technical skills in ${skills || "software engineering"}, and fresh perspectives as a student of ${studentBranch} at ${college} to your esteemed organization.`;
    }

    let skillsParagraph = "";
    const skillsList = skills ? skills.split(",").map(s => s.trim()).filter(Boolean) : ["analytical reasoning", "software development", "problem solving"];
    const topSkills = skillsList.slice(0, 4).join(", ");

    if (level === "previous") {
        skillsParagraph = `Throughout my academic tenure and prior internship experiences, I have demonstrated the ability to write robust, maintainable code and collaborate effectively within sprint cycles. My hands-on proficiency in ${topSkills} enables me to quickly grasp complex architectural specifications, debug intricate issues, and ship reliable features that serve user needs.`;
    } else if (level === "projects") {
        skillsParagraph = `Through rigorous coursework and hands-on independent project development, I have gained substantial practical experience with ${topSkills}. I place strong emphasis on writing clean, modular code, adhering to industry best practices, and continuously optimizing system performance.`;
    } else {
        skillsParagraph = `My academic training has grounded me deeply in core fundamentals, data structures, and practical application development using ${topSkills}. I pride myself on rapid learning agility, curiosity, and the capability to break down abstract technical problems into scalable, well-structured solutions.`;
    }

    let highlightParagraph = "";
    if (highlights) {
        highlightParagraph = `Notably, ${highlights.endsWith(".") ? highlights : highlights + "."} This experience sharpened my technical execution, teamwork, and ability to deliver meaningful results under real-world constraints.`;
    } else {
        highlightParagraph = `Beyond technical acumen, I am a collaborative teammate who values constructive feedback, clear technical communication, and continuous learning. I am deeply motivated by ${company}'s mission to build transformative products and would welcome the opportunity to learn from and contribute alongside your talented engineering team.`;
    }

    let closing = "";
    if (tone === "concise") {
        closing = `Thank you for your time and consideration. I would appreciate the opportunity to discuss how my skill set aligns with ${company}'s goals for this internship role.`;
    } else {
        closing = `I am confident that my enthusiasm, technical foundation, and relentless dedication to excellence make me an outstanding candidate for the ${role}. Thank you for your time, consideration, and review of my application. I eagerly look forward to the possibility of discussing my background in an interview.`;
    }

    const fullLetter = `${studentName}
${studentEmail} | ${studentPhone}
Tadepalligudem, Andhra Pradesh, India
Date: ${today}

To:
The Hiring Committee / Campus Recruiting
${company}

${salutation}

${opening}

${skillsParagraph}

${highlightParagraph}

${closing}

Sincerely,

${studentName}
Undergraduate Student, ${studentBranch}
${college}`;

    const contentEl = document.getElementById("clLetterContent");
    const placeholderEl = document.getElementById("clPlaceholder");
    const wordCountEl = document.getElementById("clWordCount");
    const generateBtn = document.getElementById("generateCoverLetterBtn");

    if (contentEl && placeholderEl) {
        placeholderEl.hidden = true;
        contentEl.hidden = false;
        contentEl.innerText = fullLetter;

        const words = fullLetter.trim().split(/\s+/).length;
        if (wordCountEl) wordCountEl.innerText = `${words} words`;

        contentEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    if (generateBtn) {
        const originalText = generateBtn.innerText;
        generateBtn.innerText = "✨ Cover Letter Ready!";
        setTimeout(() => { generateBtn.innerText = originalText; }, 2200);
    }
}

function copyCoverLetter() {
    const contentEl = document.getElementById("clLetterContent");
    const copyBtn = document.getElementById("copyClBtn");
    if (!contentEl || contentEl.hidden || !contentEl.innerText.trim()) {
        alert("Please generate a cover letter first!");
        return;
    }

    navigator.clipboard.writeText(contentEl.innerText).then(() => {
        if (copyBtn) {
            const orig = copyBtn.innerText;
            copyBtn.innerText = "✅ Copied!";
            setTimeout(() => { copyBtn.innerText = orig; }, 2000);
        } else {
            alert("Cover letter copied to clipboard!");
        }
    }).catch(() => {
        alert("Could not copy automatically. Please select and copy the text manually.");
    });
}

function downloadCoverLetter() {
    const contentEl = document.getElementById("clLetterContent");
    if (!contentEl || contentEl.hidden || !contentEl.innerText.trim()) {
        alert("Please generate a cover letter first!");
        return;
    }

    const company = (document.getElementById("clTargetCompany")?.value || "Company").replace(/[^a-zA-Z0-9_-]/g, "_");
    const blob = new Blob([contentEl.innerText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Cover_Letter_${company}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function clearCoverLetterForm() {
    const roleInput = document.getElementById("clTargetRole");
    const companyInput = document.getElementById("clTargetCompany");
    const jobSelect = document.getElementById("clJobSelect");
    const skillsInput = document.getElementById("clSkills");
    const highlightsInput = document.getElementById("clHighlights");
    const contentEl = document.getElementById("clLetterContent");
    const placeholderEl = document.getElementById("clPlaceholder");
    const wordCountEl = document.getElementById("clWordCount");

    if (roleInput) roleInput.value = "";
    if (companyInput) companyInput.value = "";
    if (jobSelect) jobSelect.value = "";
    if (skillsInput) skillsInput.value = "";
    if (highlightsInput) highlightsInput.value = "";

    if (contentEl) { contentEl.innerText = ""; contentEl.hidden = true; }
    if (placeholderEl) placeholderEl.hidden = false;
    if (wordCountEl) wordCountEl.innerText = "0 words";
}

/* =========================================================
   FEATURE: EMAIL ALERTS & NOTIFICATIONS
========================================================= */

function findStudentMatchingInternships(student, limit = 5) {
    if (!Array.isArray(internships) || internships.length === 0) return [];

    const studentBranch = String(student.branch || "").toLowerCase().trim();
    const studentLocation = String(student.preferredLocation || student.location || "").toLowerCase().trim();
    const studentMode = String(student.workMode || student.preferredWorkMode || "").toLowerCase().trim();
    const rawSkills = student.skills || "";
    const studentSkills = (Array.isArray(rawSkills) ? rawSkills : rawSkills.split(","))
        .map(s => String(s).toLowerCase().trim())
        .filter(Boolean);

    const branchKeywords = {
        "computer science": ["software", "developer", "frontend", "backend", "full stack", "web", "python", "java", "react", "c++", "engineering"],
        "artificial intelligence": ["ai", "machine learning", "deep learning", "nlp", "computer vision", "data science", "python", "pytorch"],
        "information technology": ["it", "cloud", "devops", "software", "network", "system", "database", "security"],
        "electronics": ["embedded", "vlsi", "iot", "hardware", "circuit", "signal", "electronics", "robotics"],
        "mechanical": ["mechanical", "cad", "solidworks", "design", "manufacturing", "automotive"],
        "civil": ["civil", "structural", "autocad", "construction", "surveying"]
    };

    let relevantKeywords = [];
    for (const [branchKey, keywords] of Object.entries(branchKeywords)) {
        if (studentBranch && (studentBranch.includes(branchKey) || branchKey.includes(studentBranch))) {
            relevantKeywords = relevantKeywords.concat(keywords);
        }
    }
    relevantKeywords = relevantKeywords.concat(studentSkills);

    const scored = internships.map(item => {
        let score = 0;
        const title = String(item.title || "").toLowerCase();
        const description = String(item.description || "").toLowerCase();
        const branchTag = String(item.branch || "").toLowerCase();
        const mode = String(item.type || "").toLowerCase();
        const location = String(item.location || "").toLowerCase();

        if (studentBranch && branchTag && (branchTag.includes(studentBranch) || studentBranch.includes(branchTag))) {
            score += 40;
        }
        if (studentMode && studentMode !== "any" && mode.includes(studentMode)) {
            score += 20;
        }
        if (studentLocation && location && (location.includes(studentLocation) || studentLocation.includes(location))) {
            score += 15;
        }
        for (const kw of relevantKeywords) {
            if (title.includes(kw)) score += 15;
            else if (description.includes(kw)) score += 5;
        }
        if (isIndiaBasedListing(item)) score += 5;
        return { item, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const matches = scored.filter(s => s.score > 0).map(s => s.item);
    return matches.slice(0, limit);
}

function generateStudentDigestHtml(student, matches) {
    const studentName = escapeHTML(student.name || "Student");
    const studentRoll = student.rollNumber ? ` (${escapeHTML(student.rollNumber)})` : "";
    const studentBranch = escapeHTML(student.branch || "Engineering & Technology");
    const portalUrl = window.location.origin;

    const cardsHtml = matches.map((job, idx) => {
        const title = escapeHTML(job.title || "Internship Role");
        const company = escapeHTML(job.company || "Top Employer");
        const location = escapeHTML(job.location || (job.type === "Online" ? "Remote / Virtual" : "India"));
        const stipend = escapeHTML(job.stipend || "Competitive Stipend");
        const mode = escapeHTML(job.type || "Online");
        const applyLink = escapeHTML(getSafeApplicationUrl(job.link) || portalUrl);

        const isOnline = mode.toLowerCase().includes("online");
        const badgeColor = isOnline ? "#0d9488" : "#2563eb";
        const badgeBg = isOnline ? "#ccfbf1" : "#dbeafe";

        return `
        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:18px; margin-bottom:14px; box-shadow:0 2px 6px rgba(15,23,42,0.03);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div>
                    <span style="font-size:11px; font-weight:700; color:${badgeColor}; background:${badgeBg}; padding:3px 9px; border-radius:20px; text-transform:uppercase;">
                        ${mode}
                    </span>
                    <h3 style="margin:8px 0 4px; font-size:17px; color:#0f172a; font-weight:700;">${title}</h3>
                    <p style="margin:0; font-size:13.5px; color:#0f766e; font-weight:600;">🏢 ${company}</p>
                </div>
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:14px; margin:10px 0; font-size:12.5px; color:#64748b;">
                <span>📍 <strong>Location:</strong> ${location}</span>
                <span>💰 <strong>Stipend:</strong> ${stipend}</span>
            </div>
            <div style="margin-top:12px; padding-top:10px; border-top:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:11.5px; color:#94a3b8;">Opportunity #${idx + 1}</span>
                <a href="${applyLink}" target="_blank" style="display:inline-block; background:#0f766e; color:#ffffff; text-decoration:none; font-size:12.5px; font-weight:700; padding:8px 16px; border-radius:7px;">
                    View & Apply →
                </a>
            </div>
        </div>
        `;
    }).join("");

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>InternMatch Email Digest</title>
    </head>
    <body style="margin:0; padding:0; background:#f8fafc; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#334155;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc; padding:20px 8px;">
            <tr>
                <td align="center">
                    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px; background:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #e2e8f0; box-shadow:0 6px 24px rgba(15,23,42,0.06);">
                        <tr>
                            <td style="background:linear-gradient(135deg, #0f766e, #0d9488); padding:26px 22px; text-align:center; color:#ffffff;">
                                <div style="display:inline-block; background:rgba(255,255,255,0.22); border-radius:20px; padding:4px 12px; font-size:11px; font-weight:700; letter-spacing:0.5px; text-transform:uppercase; margin-bottom:10px;">
                                    🎓 InternMatch • Student Alerts
                                </div>
                                <h1 style="margin:0; font-size:22px; font-weight:800; line-height:1.3;">
                                    New Internship Matches For You 🚀
                                </h1>
                                <p style="margin:8px 0 0; font-size:13.5px; opacity:0.9;">
                                    Handpicked opportunities matching your academic branch and career interests.
                                </p>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:22px 22px 10px;">
                                <h2 style="margin:0 0 6px; font-size:17px; color:#0f172a;">Dear ${studentName}${studentRoll},</h2>
                                <p style="margin:0 0 14px; font-size:14px; line-height:1.55; color:#475569;">
                                    We found <strong>${matches.length} fresh opportunities</strong> tailored to your field (<span style="color:#0f766e; font-weight:600;">${studentBranch}</span>). Apply early to boost your interview callbacks!
                                </p>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:0 22px;">
                                ${cardsHtml}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:14px 22px 20px;">
                                <div style="background:#f0fdfa; border:1px solid #99f6e4; border-radius:12px; padding:16px; text-align:center;">
                                    <h4 style="margin:0 0 4px; font-size:14px; color:#0f766e; font-weight:700;">
                                        ⚡ Boost Your Application Success
                                    </h4>
                                    <p style="margin:0 0 12px; font-size:12.5px; color:#475569;">
                                        Check your resume ATS score and generate a customized AI Cover Letter on InternMatch.
                                    </p>
                                    <div>
                                        <a href="${portalUrl}" target="_blank" style="display:inline-block; background:#0f766e; color:#ffffff; font-size:12px; font-weight:700; padding:8px 14px; border-radius:6px; text-decoration:none;">
                                            Open InternMatch Portal →
                                        </a>
                                    </div>
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <td style="background-color:#f8fafc; border-top:1px solid #e2e8f0; padding:18px 22px; text-align:center; font-size:11.5px; color:#94a3b8; line-height:1.5;">
                                <p style="margin:0 0 4px; font-weight:600; color:#64748b;">
                                    Sri Vasavi Engineering College • InternMatch Career Portal
                                </p>
                                <p style="margin:0;">
                                    You received this verified alert as an approved student on InternMatch. Manage alerts in My Profile.
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

function previewStudentEmailAlert() {
    const student = currentStudent || {
        name: "Student",
        email: "student@srivasaviengg.ac.in",
        branch: "Computer Science",
        rollNumber: "21A81A0501"
    };

    const matches = student.emailAlertFilter === "all"
        ? internships.slice(0, 4)
        : findStudentMatchingInternships(student, 4);
    const html = generateStudentDigestHtml(student, matches);

    const modal = document.getElementById("emailPreviewModal");
    const container = document.getElementById("emailPreviewContainer");
    const meta = document.getElementById("emailPreviewMeta");

    if (meta) {
        meta.innerText = `Preview for ${student.name} (${student.email}) • ${matches.length} matching opportunities`;
    }

    if (container) {
        container.innerHTML = `<iframe srcdoc="${escapeHTML(html).replace(/"/g, '&quot;')}" style="width:100%; height:460px; border:none; border-radius:10px;"></iframe>`;
    }

    if (modal) modal.classList.add("show");
}

function previewSampleEmailAlert() {
    const sampleStudent = {
        name: "Sai Krishna",
        email: "sai.krishna@srivasaviengg.ac.in",
        branch: "Computer Science",
        rollNumber: "21A81A0512",
        workMode: "Online"
    };

    const matches = findStudentMatchingInternships(sampleStudent, 4);
    const html = generateStudentDigestHtml(sampleStudent, matches);

    const modal = document.getElementById("emailPreviewModal");
    const container = document.getElementById("emailPreviewContainer");
    const meta = document.getElementById("emailPreviewMeta");

    if (meta) {
        meta.innerText = `Sample broadcast preview for ${sampleStudent.name} (${sampleStudent.branch}) • ${matches.length} matches`;
    }

    if (container) {
        container.innerHTML = `<iframe srcdoc="${escapeHTML(html).replace(/"/g, '&quot;')}" style="width:100%; height:460px; border:none; border-radius:10px;"></iframe>`;
    }

    if (modal) modal.classList.add("show");
}

function closeEmailPreviewModal() {
    const modal = document.getElementById("emailPreviewModal");
    if (modal) modal.classList.remove("show");
}

async function sendTestEmailAlert() {
    const statusMsg = document.getElementById("emailAlertStatusMsg");
    if (!currentStudent || !currentStudent.email) {
        alert("Please log in to send a test alert to your email.");
        return;
    }

    if (statusMsg) {
        statusMsg.style.display = "block";
        statusMsg.style.color = "#b91c1c";
        statusMsg.innerText = "Test email delivery is not available yet. Preview your digest here; email sending requires the server SMTP setup.";
    }
}

async function refreshAdminAlertsDashboard() {
    const subCountEl = document.getElementById("adminAlertSubscribersCount");
    const activeCountEl = document.getElementById("adminAlertActiveListingsCount");
    const lastSentEl = document.getElementById("adminAlertLastSentCount");
    const logsBody = document.getElementById("adminEmailLogsBody");

    if (activeCountEl) activeCountEl.innerText = String(internships.length);

    if (!isFirebaseConfigured() || !firebase.apps.length) {
        if (subCountEl) subCountEl.innerText = "Unavailable";
        if (lastSentEl) lastSentEl.innerText = "Unavailable";
        if (logsBody) {
            logsBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:18px; color:#64748b;">Connect Firebase to view live subscriber counts and dispatch logs.</td></tr>`;
        }
        return;
    }

    try {
        const studentsSnap = await firebase.database().ref("students").once("value");
        const studentsData = studentsSnap.val() || {};
        const subscribedStudents = Object.values(studentsData).filter(s =>
            s.status === "approved" && s.email && s.emailAlertsEnabled === true
        );

        if (subCountEl) subCountEl.innerText = String(subscribedStudents.length);

        const logsSnap = await firebase.database().ref("email_alerts_log").limitToLast(10).once("value");
        const logsData = logsSnap.val() || {};
        const logs = Object.entries(logsData).map(([id, item]) => ({ id, ...item })).reverse();

        if (lastSentEl) {
            lastSentEl.innerText = logs.length > 0 ? (logs[0].sentCount ? `${logs[0].sentCount} sent` : "Active") : "None yet";
        }

        if (logsBody) {
            if (logs.length === 0) {
                logsBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:18px; color:#64748b;">No alert dispatches recorded yet. Automated alerts run after a successful catalog sync when SMTP is configured.</td></tr>`;
            } else {
                logsBody.innerHTML = logs.map(log => {
                    const timeStr = log.timestamp ? new Date(log.timestamp).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : "Recent";
                    const subs = log.totalSubscribers || (log.studentEmail ? 1 : "-");
                    const sent = log.sentCount !== undefined ? log.sentCount : (log.status === "sent" ? 1 : 0);
                    const errors = log.errorCount || 0;
                    const statusBadge = errors === 0
                        ? `<span class="status-badge status-applied" style="background:#dcfce7; color:#15803d;">✓ Success</span>`
                        : `<span class="status-badge" style="background:#fee2e2; color:#991b1b;">⚠️ ${errors} Errors</span>`;

                    return `
                    <tr>
                        <td><strong>${escapeHTML(timeStr)}</strong></td>
                        <td>${escapeHTML(String(subs))}</td>
                        <td style="color:#0f766e; font-weight:700;">${sent}</td>
                        <td>${errors}</td>
                        <td>${statusBadge}</td>
                    </tr>
                    `;
                }).join("");
            }
        }
    } catch (err) {
        console.error("Failed to load admin alert stats:", err);
    }
}

async function adminDispatchEmailAlerts() {
    const statusEl = document.getElementById("adminDispatchStatus");
    if (!isAdminAuthenticated()) {
        alert("Admin authentication required.");
        return;
    }

    if (statusEl) {
        statusEl.style.display = "block";
        statusEl.style.color = "#b91c1c";
        statusEl.innerText = "Manual email broadcasts are not connected. Automated alerts run after a successful catalog sync when SMTP is configured.";
    }
}

/* =========================================================
   INITIAL RENDER
========================================================= */
Object.assign(window, {
    addInternship,
    adminDispatchEmailAlerts,
    adminLogin,
    adminLogout,
    animateValue,
    apply,
    approveStudent,
    autoFillCoverLetterProfile,
    clearCoverLetterForm,
    copyCoverLetter,
    downloadCoverLetter,
    generateCoverLetter,
    initCoverLetterPage,
    onCoverLetterJobSelect,
    bookmark,
    beginProfileEdit,
    cancelProfileEdit,
    clearAtsForm,
    copyAtsKeyword,
    closeApplyConfirmModal,
    closeEmailPreviewModal,
    confirmApplicationSubmitted,
    confirmApplicationInProgress,
    handleResumeFileUpload,
    initAtsPage,
    markInternshipAsApplied,
    onAtsJobSelect,
    previewSampleEmailAlert,
    previewStudentEmailAlert,
    refreshAdminAlertsDashboard,
    runAtsAnalysis,
    sendTestEmailAlert,
    updateApplicationStage,
    updateAtsWordCounts,
    useProfileAsResume,
    changeAdminPage,
    clearInternshipFilters,
    closeAddTrackerModal,
    closeModal,
    closeReviewsModal,
    deleteInternship,
    deleteStudentAccount,
    deleteTrackedApplication,
    displayAdminInternships,
    displayApprovedStudents,
    displayInternships,
    displayStudentRequests,
    filterApprovedStudents,
    filterTrackerStatus,
    findMatches,
    openAddTrackerModal,
    openCompanyReviews,
    openFounderLogin,
    rejectStudent,
    registerStudent,
    removeViewedInternship,
    resetStudentPassword,
    returnToStudentLogin,
    renderInsightsDashboard,
    renderTrackerPage,
    revokeStudentApproval,
    selectSkillSearch,
    selectType,
    showDetails,
    showPage,
    showRegistration,
    showStudentLogin,
    saveStudentProfile,
    studentLogin,
    studentLogout,
    submitCompanyReview,
    submitCustomTracker,
    switchAdminTab,
    switchReviewsTab,
    togglePassword
});

const navbar = document.querySelector(".navbar");
function updateNavbarScrollState() {
    if (navbar) navbar.classList.toggle("nav-scrolled", window.scrollY > 50);
}

window.addEventListener("scroll", updateNavbarScrollState, { passive: true });
updateNavbarScrollState();

mountProfileTools();
window.addEventListener("hashchange", showProfileToolFromHash);
showProfileToolFromHash();
displayFeatured();
displayInternships();
displayAdminInternships();
updateHomeStats();
updateTrackerMetrics();
listenToMetadata();
publishInternshipUpdates();