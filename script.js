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
const INDIA_CITY_PATTERN = /\b(?:bengaluru|bangalore|hyderabad|mumbai|pune|chennai|gurugram|gurgaon|noida|new delhi|delhi|kolkata|ahmedabad|jaipur|kochi|cochin|thiruvananthapuram|visakhapatnam|vizag|lucknow|indore|bhubaneswar|mysuru|mysore|mangaluru|mangalore)\b/i;

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
        type: getWorkTypeFromLocation(internship.location),
        branch: internship.branch === "All branches" ? "Not specified" : internship.branch,
        description: getCachedRoleDescription(internship.description)
    };
}

function getInternshipChatData() {
    return sortIndiaFirst(internships).map(internship => ({
        title: internship.title,
        company: internship.company,
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

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
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
}

function clearStudentSession() {
    currentStudent = null;
    localStorage.removeItem("studentSession");
}

function updateStudentProfile() {
    const student = currentStudent;
    if (!student) return;
    currentStudent = student;
    document.getElementById("profileName").innerText = student.name || "Student";
    document.getElementById("profileEmail").innerText = student.email || "";
    document.getElementById("profileAvatar").innerText = (student.name || "S").charAt(0).toUpperCase();
    document.getElementById("profileDetails").innerHTML = `
        <div><span>Phone</span><strong>${escapeHTML(student.phone || "Not added")}</strong></div>
        <div><span>College / Branch</span><strong>${escapeHTML(student.branch || "Not added")}</strong></div>
        <div><span>Roll Number</span><strong>${escapeHTML(student.rollNumber || "Not added")}</strong></div>
        <div><span>Account Status</span><strong class="profile-status">Approved</strong></div>
    `;
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
    document.body.classList.remove("auth-locked");
    document.body.classList.add("founder-login");
    document.getElementById("authGate").hidden = true;
    document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));
    document.getElementById("admin").classList.add("active");
    showPage("admin");
}

function returnToStudentLogin() {
    setAdminAuthenticated(false);
    document.body.classList.remove("founder-login");
    document.body.classList.add("auth-locked");
    document.getElementById("authGate").hidden = false;
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
    if (!isFirebaseConfigured()) {
        message.innerText = "Student registration requires the configured Firebase project.";
        return;
    }
    try {
        ensureFirebase();
        const credential = await firebase.auth().createUserWithEmailAndPassword(
            document.getElementById("registerEmail").value.trim(),
            document.getElementById("registerPassword").value
        );
        await firebase.database().ref(`students/${credential.user.uid}`).set({
            name: document.getElementById("registerName").value.trim(),
            email: credential.user.email,
            phone: document.getElementById("registerPhone").value.trim(),
            branch: document.getElementById("registerBranch").value.trim(),
            rollNumber: document.getElementById("registerRoll").value.trim(),
            status: "pending"
        });
        await firebase.auth().signOut();
        showStudentLogin();
        document.getElementById("studentLoginMessage").innerText =
            "Registration submitted. Wait for founder approval before logging in.";
    } catch (error) {
        message.innerText = getFirebaseErrorMessage(error);
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
            document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
            document.getElementById("home").classList.add("active");
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
    displayAdminInternships();
    updateHomeStats();
}

function startSharedInternships() {
    if (!isFirebaseConfigured() || !firebase.auth().currentUser) return;
    if (firebaseInternshipRef) return;
    try {
        ensureFirebase();
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

/* =========================================================
   ADMIN AUTH
========================================================= */
let adminAuthenticatedInMemory = false;

function setAdminAuthenticated(authenticated) {
    adminAuthenticatedInMemory = authenticated;
}

function getStoredAdminAuthentication() {
    return false;
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
   ADMIN - STUDENT APPROVALS
========================================================= */
async function displayApprovedStudents() {
    const container = document.getElementById("approvedStudentList");
    const count = document.getElementById("approvedStudentCount");
    if (!container || !count) return;

    try {
        await ensureAdminFirebaseSession();
        const students = (await firebase.database().ref("students").once("value")).val() || {};
        const approved = Object.values(students).filter(student => student.status === "approved");
        count.innerText = `${approved.length} total`;
        container.innerHTML = approved.length ? approved.map(student => `
            <div style="padding:14px 0;border-top:1px solid #e5e7eb">
                <strong>${escapeHTML(student.name)}</strong>
                <div class="company">${escapeHTML(student.email)} - ${escapeHTML(student.phone)}</div>
                <div class="company">${escapeHTML(student.branch)} - Roll No: ${escapeHTML(student.rollNumber)}</div>
            </div>
        `).join("") : "<p class=\"company\">No approved users yet.</p>";
    } catch (error) {
        count.innerText = "";
        container.innerText = getFirebaseErrorMessage(error);
    }
}

async function displayStudentRequests() {
    const container = document.getElementById("studentRequestList");
    if (!container) return;

    try {
        if (!isFirebaseConfigured()) throw new Error("local mode");
        await ensureAdminFirebaseSession();
        const snapshot = await firebase.database().ref("students").once("value");
        const students = snapshot.val() || {};
        const pending = Object.entries(students).filter(([, student]) => student.status === "pending");
        container.innerHTML = pending.length ? pending.map(([uid, student]) => `
            <div style="padding:14px 0;border-top:1px solid #e5e7eb">
                <strong>${escapeHTML(student.name)}</strong>
                <div class="company">${escapeHTML(student.email)} - ${escapeHTML(student.phone)}</div>
                <div class="company">${escapeHTML(student.branch)} - Roll No: ${escapeHTML(student.rollNumber)}</div>
                <button class="small-primary" style="margin-top:10px" onclick="approveStudent('${escapeHTML(uid)}')">Accept</button>
                <button class="danger-btn" style="margin-top:10px" onclick="rejectStudent('${escapeHTML(uid)}')">Reject</button>
            </div>
        `).join("") : "<p class=\"company\">No pending registrations.</p>";
    } catch (error) {
        container.innerText = getFirebaseErrorMessage(error);
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
    document.getElementById(pageId).classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (pageId === "home") {
        displayInternships();
        displayFeatured();
        updateHomeStats();
    }
    if (pageId === "admin") {
        updateAdminView();
    }
    if (pageId === "profile") {
        updateStudentProfile();
    }
}

function updateHomeStats() {
    const count = document.getElementById("internshipCount");
    const onlineCount = document.getElementById("onlineCount");
    if (count) count.innerText = internships.length;
    if (onlineCount) onlineCount.innerText = internships.filter(i => i.type === "Online").length;
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
            <div style="font-size:30px">🚀</div>
            <h3>${escapeHTML(internship.title)}</h3>
            <div class="company">${escapeHTML(internship.company)}</div>
            ${hasPublishedValue(internship.location) ? `<div class="feature-info">📍 ${escapeHTML(internship.location)}</div>` : ""}
            ${hasPublishedValue(internship.stipend) ? `<div class="feature-info">💰 ${escapeHTML(internship.stipend)}</div>` : ""}
            <div class="feature-info">${escapeHTML(workMode)}</div>
            <button onclick="showDetails(${Number(internship.id)})">View Internship</button>
        `;
        container.appendChild(card);
    });
}

/* =========================================================
   DISPLAY ALL INTERNSHIPS
========================================================= */
function displayInternships() {
    const container = document.getElementById("internshipContainer");
    if (!container) return;

    const search = document.getElementById("searchInput").value.trim().toLowerCase();
    const filtered = sortIndiaFirst(internships).filter(internship => {
        const skills = Array.isArray(internship.skills) ? internship.skills.join(" ") : "";
        return [
            internship.title,
            internship.company,
            internship.specialization,
            internship.location,
            internship.branch,
            internship.type,
            isIndiaBasedListing(internship) ? "India" : "",
            skills
        ]
            .some(value => String(value || "").toLowerCase().includes(search));
    });

    container.innerHTML = filtered.length
        ? filtered.map(createCard).join("")
        : internships.length
            ? "<p class=\"company\">No internships match your search.</p>"
            : "<p class=\"company\">No current internships are synced yet. Please check back after the next feed update.</p>";
}

/* =========================================================
   CREATE CARD
========================================================= */
function createCard(internship) {
    const internshipId = Number(internship.id);
    const safeId = Number.isSafeInteger(internshipId) ? internshipId : "null";
    const tags = [
        hasPublishedValue(internship.specialization) && internship.specialization !== "General"
            ? `<span class="tag">${escapeHTML(internship.specialization)}</span>` : "",
        hasPublishedValue(internship.type)
            ? `<span class="tag">${escapeHTML(internship.type)}</span>` : "",
        isIndiaBasedListing(internship) ? "<span class=\"tag india-tag\">India</span>" : ""
    ].filter(Boolean).join("");
    const details = [
        ["📍", internship.location],
        ["💰", internship.stipend],
        ["⏱️", internship.duration]
    ].filter(([, value]) => hasPublishedValue(value));
    return `
        <div class="card">
            <div class="card-top">
                <div class="company-logo">💼</div>
                <button class="bookmark" onclick="bookmark(${safeId})"
                        title="Save internship" aria-label="Save ${escapeHTML(internship.title)}">
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
                <button class="small-primary" onclick="apply(${safeId})">Apply</button>
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
        const internshipId = Number(internship.id);
        const safeId = Number.isSafeInteger(internshipId) ? internshipId : "null";
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
            <section class="detail-section detail-about" aria-labelledby="detail-about-title">
                <h3 id="detail-about-title">About this internship</h3>
                <p>${escapeHTML(description)}</p>
            </section>
            <footer class="detail-actions">
                ${applicationUrl
                    ? `<a class="primary-btn detail-apply" href="${escapeHTML(applicationUrl)}" target="_blank" rel="noopener noreferrer">Open application <span aria-hidden="true">↗</span></a>`
                    : "<p class=\"detail-no-link\">An application link is not available for this listing.</p>"}
            </footer>
        </article>
    `;
    modal.classList.add("show");
    modal.querySelector(".close").focus();
}

function closeModal() {
    const modal = document.getElementById("detailsModal");
    modal.classList.remove("show");
    if (lastModalTrigger && lastModalTrigger.isConnected) lastModalTrigger.focus();
}

document.getElementById("detailsModal").addEventListener("click", event => {
    if (event.target === event.currentTarget) closeModal();
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
   APPLY
========================================================= */
function apply(id) {
    const internship = findInternshipById(id);
    const applicationUrl = internship && getSafeApplicationUrl(internship.link);
    if (applicationUrl) {
        window.open(applicationUrl, "_blank", "noopener,noreferrer");
    } else {
        alert("Application link will be added by the administrator.");
    }
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
    displayInternships();
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
   ADMIN - MANAGE INTERNSHIPS
========================================================= */
function displayAdminInternships() {
    const container = document.getElementById("adminInternshipList");
    const count = document.getElementById("adminInternshipCount");
    if (!container) return;

    count.innerText = `${internships.length} total`;
    container.innerHTML = sortIndiaFirst(internships).map(internship => `
        <div class="card" style="margin-top:15px">
            <div class="card-top">
                <div>
                    <h3 style="margin:0 0 6px">${escapeHTML(internship.title)}</h3>
                    <div class="company">${escapeHTML(internship.company)}</div>
                </div>
                <span class="tag">${escapeHTML(internship.type)}</span>
            </div>
            <div class="tags">
                <span class="tag">${escapeHTML(internship.branch)}</span>
                <span class="tag">${escapeHTML(internship.specialization)}</span>
            </div>
            <div class="details">
                <div>📍 ${escapeHTML(internship.location)}</div>
                <div>💰 ${escapeHTML(internship.stipend)}</div>
                <div>⏱️ ${escapeHTML(internship.duration)}</div>
                <div>🧠 ${escapeHTML(Array.isArray(internship.skills) ? internship.skills.join(", ") : "")}</div>
            </div>
            <p class="company" style="margin-top:15px">${escapeHTML(internship.description)}</p>
            <div class="card-actions">
                <button class="secondary-btn" onclick="showDetails(${Number(internship.id)})">View Details</button>
                <button class="danger-btn" onclick="deleteInternship(${Number(internship.id)})"
                        aria-label="Delete ${escapeHTML(internship.title)}">Delete</button>
            </div>
        </div>
    `).join("");
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
   SESSION PERSISTENCE + LOADING ON REFRESH
========================================================= */
async function restoreFirebaseSession(user) {
    if (!user) {
        clearStudentSession();
        hideLoader();
        return;
    }

    showLoader("Restoring your session...");
    try {
        const adminSnapshot = await firebase.database().ref(`admins/${user.uid}`).once("value");
        if (adminSnapshot.val() === true) {
            setAdminAuthenticated(true);
            startSharedInternships();
            document.body.classList.remove("auth-locked");
            document.body.classList.add("founder-login");
            document.getElementById("authGate").hidden = true;
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
            hideLoader();
            return;
        }

        saveStudentSession(student);
        document.body.classList.remove("auth-locked", "founder-login");
        document.getElementById("authGate").hidden = true;
        document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));
        document.getElementById("home").classList.add("active");
        startSharedInternships();
        updateStudentProfile();
    } catch (error) {
        console.error("The saved session could not be verified.", error);
        clearStudentSession();
        await firebase.auth().signOut();
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
   INITIAL RENDER
========================================================= */
Object.assign(window, {
    addInternship,
    adminLogin,
    adminLogout,
    apply,
    approveStudent,
    bookmark,
    closeModal,
    deleteInternship,
    displayInternships,
    findMatches,
    openFounderLogin,
    rejectStudent,
    registerStudent,
    resetStudentPassword,
    returnToStudentLogin,
    selectType,
    showDetails,
    showPage,
    showRegistration,
    showStudentLogin,
    studentLogin,
    studentLogout,
    togglePassword
});

displayFeatured();
displayInternships();
displayAdminInternships();
updateHomeStats();
publishInternshipUpdates();