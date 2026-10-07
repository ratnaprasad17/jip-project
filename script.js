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
    const profileFields = [
        ["Phone", student.phone],
        ["College / Branch", student.branch],
        ["Roll Number", student.rollNumber],
        ["Skills", Array.isArray(student.skills) ? student.skills.join(", ") : student.skills],
        ["Preferred location", student.preferredLocation],
        ["Account Status", student.status === "approved" ? "Approved" : "Pending"]
    ];
    document.getElementById("profileDetails").innerHTML = profileFields.map(([label, value]) =>
        `<div><span>${escapeHTML(label)}</span><strong>${escapeHTML(value || "Not added")}</strong></div>`
    ).join("");
}

function beginProfileEdit() {
    if (!currentStudent) return;
    document.getElementById("profileMessage").innerText = "";
    document.getElementById("profileNameInput").value = currentStudent.name || "";
    document.getElementById("profilePhoneInput").value = currentStudent.phone || "";
    document.getElementById("profileBranchInput").value = currentStudent.branch || "";
    document.getElementById("profileRollNumberInput").value = currentStudent.rollNumber || "";
    document.getElementById("profileSkillsInput").value = Array.isArray(currentStudent.skills)
        ? currentStudent.skills.join(", ")
        : currentStudent.skills || "";
    document.getElementById("profileLocationInput").value = currentStudent.preferredLocation || "";
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
        branch: document.getElementById("profileBranchInput").value.trim(),
        rollNumber: document.getElementById("profileRollNumberInput").value.trim(),
        skills: document.getElementById("profileSkillsInput").value.trim(),
        preferredLocation: document.getElementById("profileLocationInput").value.trim()
    };
    if (!updates.name) return;

    saveButton.disabled = true;
    saveButton.innerText = "Saving...";
    message.innerText = "";
    try {
        await firebase.database().ref(`students/${user.uid}`).update(updates);
        currentStudent = { ...currentStudent, ...updates };
        updateStudentProfile();
        cancelProfileEdit();
        message.innerText = "Profile updated.";
    } catch (error) {
        message.innerText = getFirebaseErrorMessage(error);
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
    displaySavedInternships();
    displayAdminInternships();
    updateHomeStats();
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

async function displayApprovedStudents() {
    const container = document.getElementById("approvedStudentList");
    const count = document.getElementById("approvedStudentCount");
    if (!container || !count) return;

    try {
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
        const safeUid = escapeHTML(JSON.stringify(String(student.uid)));
        const safeName = escapeHTML(JSON.stringify(String(student.name || "Student")));
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
                    <button class="secondary-btn" style="border-color:#f59e0b;color:#d97706;" onclick="revokeStudentApproval(${safeUid}, ${safeName})" title="Revoke approval and move back to Pending">Revoke Access</button>
                    <button class="danger-btn" onclick="deleteStudentAccount(${safeUid}, ${safeName})" title="Remove student profile from the database">Remove profile</button>
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
            const safeUid = JSON.stringify(String(uid));
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
                        <button class="primary-btn" style="padding:7px 16px;font-size:0.875rem;" onclick="approveStudent(${safeUid})">Accept</button>
                        <button class="danger-btn" onclick="rejectStudent(${safeUid})">Reject</button>
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

function updateHomeStats() {
    const count = document.getElementById("internshipCount");
    const onlineCount = document.getElementById("onlineCount");
    if (count) count.innerText = internships.length;
    if (onlineCount) onlineCount.innerText = internships.filter(i => i.type === "Online").length;
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
            <button class="feature-view" onclick="showDetails(${Number(internship.id)})">View Internship</button>
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

    container.innerHTML = filtered.length
        ? filtered.map(createCard).join("")
        : internships.length
            ? "<p class=\"company\">No internships match your filter criteria. Try clicking Reset Filters.</p>"
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
                    ? `<a class="primary-btn detail-apply" href="${escapeHTML(applicationUrl)}" target="_blank" rel="noopener noreferrer" onclick="autoTrackApplication(findInternshipById(${Number(internship.id)}))">Open application <span aria-hidden="true">↗</span></a>`
                    : "<p class=\"detail-no-link\">An application link is not available for this listing.</p>"}
            </footer>
        </article>
    `;
    modal.classList.add("show");
    modal.querySelector(".close").focus();
}

function getSmartInsightsHTML(internship, skills) {
    const studentSkills = currentStudent?.skills
        ? currentStudent.skills.split(",").map(s => s.trim().toLowerCase()).filter(Boolean)
        : (document.getElementById("skills")?.value || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);

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
            <button type="button" class="company-review-trigger-btn" onclick="openCompanyReviews('${escapeHTML(internship.company || "")}')">
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
        autoTrackApplication(internship);
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
    const btnManage = document.getElementById("tabBtnManage");
    const btnAdd = document.getElementById("tabBtnAdd");
    const btnStudents = document.getElementById("tabBtnStudents");

    if (paneManage) paneManage.hidden = tabName !== "manage";
    if (paneAdd) paneAdd.hidden = tabName !== "add";
    if (paneStudents) paneStudents.hidden = tabName !== "students";

    if (btnManage) btnManage.classList.toggle("active", tabName === "manage");
    if (btnAdd) btnAdd.classList.toggle("active", tabName === "add");
    if (btnStudents) btnStudents.classList.toggle("active", tabName === "students");

    if (tabName === "manage") displayAdminInternships();
    if (tabName === "students") {
        displayStudentRequests();
        displayApprovedStudents();
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
                        const safeId = Number(internship.id);
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
    const savedCount = bookmarks.length;

    const closingSoonList = internships.filter(i => {
        const days = getDaysRemaining(i.closingDate);
        return days !== null && days >= 0 && days <= 14;
    });
    const closingSoonCount = closingSoonList.length;
    const totalActivity = viewedCount + appliedCount + savedCount;

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

function autoTrackApplication(internship) {
    if (!internship) return;
    const exists = trackedApplications.some(a => String(a.internshipId) === String(internship.id));
    if (!exists) {
        trackedApplications.unshift({
            id: Date.now(),
            internshipId: internship.id,
            company: internship.company || "Company",
            title: internship.title || "Internship Role",
            status: "Applied",
            date: getLocalDateString(),
            link: getSafeApplicationUrl(internship.link),
            notes: "Applied directly through official job board."
        });
        saveApplications();
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
    const link = document.getElementById("trackLink").value.trim();
    const notes = document.getElementById("trackNotes").value.trim();

    if (!company || !title) return;

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
                <div class="empty-state" style="padding:32px;text-align:center;background:#fff;border-radius:14px;border:1px dashed #cbd5e1;">
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
            const safeId = JSON.stringify(String(item.id));
            const relativeTime = formatRelativeTime(item.viewedAt);
            return `
                <div class="tracker-card">
                    <div class="tracker-card-left">
                        <div class="tracker-card-title">${escapeHTML(item.title)}</div>
                        <div class="tracker-card-company">🏢 ${escapeHTML(item.company)} • 📍 ${escapeHTML(item.location || "Remote")} • 💰 ${escapeHTML(item.stipend || "Not specified")}</div>
                        <div style="font-size:12px;color:#64748b;display:flex;align-items:center;gap:6px;margin-top:4px;">
                            <span>👁️ Viewed ${escapeHTML(relativeTime)}</span>
                            <span>•</span>
                            <span class="tag" style="padding:2px 8px;font-size:11px;">${escapeHTML(item.type || "Online")}</span>
                        </div>
                    </div>
                    <div class="tracker-card-right">
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
        const appliedList = trackedApplications.filter(a => a.status === "Applied");
        if (!appliedList.length) {
            container.innerHTML = `
                <div class="empty-state" style="padding:32px;text-align:center;background:#fff;border-radius:14px;border:1px dashed #cbd5e1;">
                    <span style="font-size:32px;display:block;margin-bottom:8px;">🚀</span>
                    <strong>No applications submitted yet</strong>
                    <p class="company mt-4">When you click "Apply" on any role, it automatically saves to this tracker!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = appliedList.map(app => {
            const safeAppId = JSON.stringify(String(app.id));
            return `
                <div class="tracker-card">
                    <div class="tracker-card-left">
                        <div class="tracker-card-title">${escapeHTML(app.title)}</div>
                        <div class="tracker-card-company">🏢 ${escapeHTML(app.company)} • 🗓 Applied on: <strong>${escapeHTML(app.date || "Recently")}</strong></div>
                        ${app.notes ? `<div class="tracker-card-notes">📝 ${escapeHTML(app.notes)}</div>` : ""}
                    </div>
                    <div class="tracker-card-right">
                        <span class="status-badge status-applied">✓ Applied</span>
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
        if (!savedInternships.length) {
            container.innerHTML = `
                <div class="empty-state" style="padding:32px;text-align:center;background:#fff;border-radius:14px;border:1px dashed #cbd5e1;">
                    <span style="font-size:32px;display:block;margin-bottom:8px;">⭐</span>
                    <strong>No saved internships</strong>
                    <p class="company mt-4">Save roles you want to apply for later by clicking the star icon on any card.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = savedInternships.map(item => {
            const safeId = JSON.stringify(String(item.id));
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
        }).join("");
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
                <div class="empty-state" style="padding:32px;text-align:center;background:#fff;border-radius:14px;border:1px dashed #cbd5e1;">
                    <span style="font-size:32px;display:block;margin-bottom:8px;">⏳</span>
                    <strong>No urgent deadlines in the next 14 days</strong>
                    <p class="company mt-4">All opportunities have ample application windows remaining.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = closingSoonList.map(item => {
            const days = getDaysRemaining(item.closingDate);
            const safeId = JSON.stringify(String(item.id));
            return `
                <div class="tracker-card" style="border-left:4px solid #ea580c;">
                    <div class="tracker-card-left">
                        <div class="tracker-card-title">${escapeHTML(item.title)}</div>
                        <div class="tracker-card-company">🏢 ${escapeHTML(item.company)} • 📍 ${escapeHTML(item.location || "Remote")}</div>
                        <div style="font-size:12px;color:#c2410c;font-weight:700;margin-top:4px;">
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
            <div class="empty-state" style="padding:32px;text-align:center;background:#fff;border-radius:14px;border:1px dashed #cbd5e1;">
                <strong>No student activity logged yet</strong>
                <p class="company mt-4">Start exploring internships to build your personal activity history!</p>
            </div>
        `;
        return;
    }

    let combinedHTML = "";
    if (viewedInternships.length) {
        combinedHTML += `<h4 style="margin:8px 0;color:#0f766e;">👁️ Recently Viewed (${viewedInternships.length})</h4>`;
        combinedHTML += viewedInternships.slice(0, 5).map(item => `
            <div class="tracker-card" style="margin-bottom:10px;">
                <div class="tracker-card-left">
                    <div class="tracker-card-title">${escapeHTML(item.title)}</div>
                    <div class="tracker-card-company">🏢 ${escapeHTML(item.company)} • 👁️ ${formatRelativeTime(item.viewedAt)}</div>
                </div>
                <div class="tracker-card-right">
                    <button class="primary-btn" onclick="apply(${JSON.stringify(String(item.id))})" style="padding:6px 14px;font-size:12px;">Apply Now ↗</button>
                    <button class="secondary-btn" onclick="showDetails(${JSON.stringify(String(item.id))})" style="padding:6px 10px;font-size:12px;">Details</button>
                </div>
            </div>
        `).join("");
    }

    if (trackedApplications.length) {
        combinedHTML += `<h4 style="margin:16px 0 8px;color:#1e40af;">🚀 Submitted Applications (${trackedApplications.length})</h4>`;
        combinedHTML += trackedApplications.slice(0, 5).map(app => `
            <div class="tracker-card" style="margin-bottom:10px;">
                <div class="tracker-card-left">
                    <div class="tracker-card-title">${escapeHTML(app.title)}</div>
                    <div class="tracker-card-company">🏢 ${escapeHTML(app.company)} • 🗓 ${escapeHTML(app.date || "")}</div>
                </div>
                <div class="tracker-card-right">
                    <span class="status-badge status-applied">✓ Applied</span>
                    ${app.link ? `<a class="secondary-btn" href="${escapeHTML(app.link)}" target="_blank" rel="noopener noreferrer" style="padding:6px 12px;font-size:12px;text-decoration:none;">Portal ↗</a>` : ""}
                </div>
            </div>
        `).join("");
    }

    container.innerHTML = combinedHTML;
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
            const safeSkill = JSON.stringify(String(skill));
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
   INITIAL RENDER
========================================================= */
Object.assign(window, {
    addInternship,
    adminLogin,
    adminLogout,
    apply,
    approveStudent,
    autoTrackApplication,
    bookmark,
    beginProfileEdit,
    cancelProfileEdit,
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

displayFeatured();
displayInternships();
displayAdminInternships();
updateHomeStats();
updateTrackerMetrics();
listenToMetadata();
publishInternshipUpdates();