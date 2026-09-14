/* =========================================================
   INTERNSHIP DATA
========================================================= */
let internships = [
    {
        id: 1,
        title: "Machine Learning Intern",
        company: "TechNova AI",
        type: "Online",
        branch: "Computer Science",
        specialization: "Machine Learning",
        location: "Remote",
        stipend: "₹15,000/month",
        duration: "3 Months",
        skills: ["Python", "Machine Learning", "TensorFlow"],
        description: "Work on real-world machine learning projects and build predictive models.",
        link: "#"
    },
    {
        id: 2,
        title: "Data Science Intern",
        company: "DataWorks",
        type: "Online",
        branch: "Artificial Intelligence",
        specialization: "Data Science",
        location: "Remote",
        stipend: "₹12,000/month",
        duration: "2 Months",
        skills: ["Python", "SQL", "Pandas"],
        description: "Analyze datasets and create useful business insights using data science.",
        link: "#"
    },
    {
        id: 3,
        title: "Web Development Intern",
        company: "WebCraft Solutions",
        type: "Offline",
        branch: "Computer Science",
        specialization: "Web Development",
        location: "Hyderabad",
        stipend: "₹10,000/month",
        duration: "3 Months",
        skills: ["HTML", "CSS", "JavaScript"],
        description: "Build modern websites and web applications with an experienced development team.",
        link: "#"
    },
    {
        id: 4,
        title: "AI Research Intern",
        company: "FutureAI Labs",
        type: "Online",
        branch: "Artificial Intelligence",
        specialization: "Artificial Intelligence",
        location: "Remote",
        stipend: "₹20,000/month",
        duration: "6 Months",
        skills: ["Python", "Deep Learning", "PyTorch"],
        description: "Explore modern AI techniques and contribute to experimental research projects.",
        link: "#"
    },
    {
        id: 5,
        title: "Cyber Security Intern",
        company: "SecureNet",
        type: "Offline",
        branch: "Information Technology",
        specialization: "Cyber Security",
        location: "Bangalore",
        stipend: "₹18,000/month",
        duration: "4 Months",
        skills: ["Linux", "Networking", "Security"],
        description: "Learn practical cybersecurity concepts and work with security professionals.",
        link: "#"
    },
    {
        id: 6,
        title: "Cloud Computing Intern",
        company: "CloudSphere",
        type: "Online",
        branch: "Information Technology",
        specialization: "Cloud Computing",
        location: "Remote",
        stipend: "₹14,000/month",
        duration: "3 Months",
        skills: ["AWS", "Docker", "Linux"],
        description: "Learn cloud infrastructure and deploy applications using modern cloud technologies.",
        link: "#"
    }
];

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

function saveStudentSession(student) {
    currentStudent = student;
    localStorage.setItem("studentSession", JSON.stringify(student));
}

function getStoredStudentSession() {
    try {
        return JSON.parse(localStorage.getItem("studentSession"));
    } catch (error) {
        return null;
    }
}

function clearStudentSession() {
    currentStudent = null;
    localStorage.removeItem("studentSession");
}

function updateStudentProfile() {
    const student = currentStudent || getStoredStudentSession();
    if (!student) return;
    currentStudent = student;
    document.getElementById("profileName").innerText = student.name || "Student";
    document.getElementById("profileEmail").innerText = student.email || "";
    document.getElementById("profileAvatar").innerText = (student.name || "S").charAt(0).toUpperCase();
    document.getElementById("profileDetails").innerHTML = `
        <div><span>Phone</span><strong>${student.phone || "Not added"}</strong></div>
        <div><span>College / Branch</span><strong>${student.branch || "Not added"}</strong></div>
        <div><span>Roll Number</span><strong>${student.rollNumber || "Not added"}</strong></div>
        <div><span>Account Status</span><strong class="profile-status">Approved</strong></div>
    `;
}

/* Load saved internships */
try {
    const savedInternships = JSON.parse(localStorage.getItem("internships"));
    if (Array.isArray(savedInternships)) internships = savedInternships;
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
    if (!firebase.auth().currentUser) await firebase.auth().signInAnonymously();
}

/* =========================================================
   STUDENT REGISTRATION & LOGIN
========================================================= */
async function registerStudent() {
    const message = document.getElementById("registrationMessage");
    try {
        if (!isFirebaseConfigured()) {
            saveLocalStudentRegistration(message);
            return;
        }
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
        if (isFirebaseConfigured()) {
            message.innerText = getFirebaseErrorMessage(error);
        } else {
            saveLocalStudentRegistration(message);
        }
    }
}

function getLocalStudentRegistrations() {
    try {
        return JSON.parse(localStorage.getItem("studentRegistrations")) || {};
    } catch (error) {
        return {};
    }
}

function saveLocalStudentRegistration(message) {
    const registrations = getLocalStudentRegistrations();
    const uid = `local-${Date.now()}`;
    registrations[uid] = {
        name: document.getElementById("registerName").value.trim(),
        email: document.getElementById("registerEmail").value.trim().toLowerCase(),
        password: document.getElementById("registerPassword").value,
        phone: document.getElementById("registerPhone").value.trim(),
        branch: document.getElementById("registerBranch").value.trim(),
        rollNumber: document.getElementById("registerRoll").value.trim(),
        status: "pending"
    };
    localStorage.setItem("studentRegistrations", JSON.stringify(registrations));
    showStudentLogin();
    document.getElementById("studentLoginMessage").innerText =
        "Registration submitted. An admin must approve your account before logging in.";
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
        if (isFirebaseConfigured()) {
            console.error("Student login failed:", error);
            message.innerText = error && ["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found"].includes(error.code)
                ? "Student account not found or password is incorrect. Register first, then use the approved account."
                : getFirebaseErrorMessage(error);
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.innerText = "Student Login";
            }
            return;
        }
        const registrations = getLocalStudentRegistrations();
        const student = Object.values(registrations).find(account =>
            account.email === email.toLowerCase() &&
            account.password === password
        );

        if (student && student.status === "approved") {
            saveStudentSession(student);
            showLoader("Loading internships...");
            setTimeout(() => {
                showLoaderSuccess(`Welcome, ${student.name.split(" ")[0]}!`, () => {
                    document.body.classList.remove("auth-locked", "founder-login");
                    document.getElementById("authGate").hidden = true;
                    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
                    document.getElementById("home").classList.add("active");
                    updateStudentProfile();
                });
            }, 800);
        } else {
            message.innerText = "Unable to log in. Check your email and password.";
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.innerText = "Student Login";
            }
        }
    }
}

function studentLogout() {
    clearStudentSession();
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
    displayInternships();
    displayFeatured();
    displayAdminInternships();
    updateHomeStats();
}

function startSharedInternships() {
    if (!isFirebaseConfigured() || !firebase.auth().currentUser) return;
    try {
        ensureFirebase();
        firebaseInternshipRef = firebase.database().ref("internships");
        firebaseInternshipRef.on("value", snapshot => {
            const sharedInternships = snapshot.val();
            if (Array.isArray(sharedInternships)) {
                internships = sharedInternships;
                localStorage.setItem("internships", JSON.stringify(internships));
                refreshInternshipViews();
            } else {
                saveInternships();
            }
        }, error => {
            console.error("Shared internships could not be loaded.", error);
        });
    } catch (error) {
        console.error("Firebase could not be started.", error);
    }
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

/* =========================================================
   ADMIN AUTH
========================================================= */
const ADMIN_ID = "admin";
const ADMIN_PASSKEY = "DTI PROJECT 5";
let adminAuthenticatedInMemory = false;

function getAdminAuthStorages() {
    const storages = [];
    try { if (window.sessionStorage) storages.push(window.sessionStorage); } catch (e) {}
    try { if (window.localStorage) storages.push(window.localStorage); } catch (e) {}
    return storages;
}

function setAdminAuthenticated(authenticated) {
    adminAuthenticatedInMemory = authenticated;
    getAdminAuthStorages().forEach(storage => {
        try {
            if (authenticated) storage.setItem("adminAuthenticated", "true");
            else storage.removeItem("adminAuthenticated");
        } catch (error) {
            console.warn("Admin login state could not be saved.", error);
        }
    });
}

function getStoredAdminAuthentication() {
    for (const storage of getAdminAuthStorages()) {
        try {
            if (storage.getItem("adminAuthenticated") === "true") return true;
        } catch (error) {
            console.warn("Admin login state could not be read.", error);
        }
    }
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
    const adminId = document.getElementById("adminLoginId").value.trim();
    const passkey = document.getElementById("adminPasskey").value;
    const error = document.getElementById("loginError");

    if (adminId !== ADMIN_ID || passkey !== ADMIN_PASSKEY) {
        error.innerText = "Incorrect Admin ID or passkey.";
        return;
    }

    showLoader("Authenticating admin...");

    const openDashboard = () => {
        setAdminAuthenticated(true);
        error.innerText = "";
        document.getElementById("adminPasskey").value = "";

        document.body.classList.remove("auth-locked");
        document.body.classList.add("founder-login");
        document.getElementById("authGate").hidden = true;
        document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));
        document.getElementById("admin").classList.add("active");
        updateAdminView();
    };

    try {
        await ensureAdminFirebaseSession();
    } catch (firebaseError) {
        console.warn("Firebase admin session failed, using local mode.", firebaseError);
    }

    updateLoaderText("Loading dashboard...");
    showLoaderSuccess("Welcome back, Admin!", openDashboard);
}

function adminLogout() {
    setAdminAuthenticated(false);
    document.getElementById("adminLoginId").value = "";
    document.getElementById("adminPasskey").value = "";
    document.getElementById("loginError").innerText = "";
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

    let students = {};
    try {
        if (isFirebaseConfigured()) {
            await ensureAdminFirebaseSession();
            students = (await firebase.database().ref("students").once("value")).val() || {};
        } else {
            throw new Error("local mode");
        }
    } catch (error) {
        students = getLocalStudentRegistrations();
    }

    const approved = Object.values(students).filter(student => student.status === "approved");
    count.innerText = `${approved.length} total`;
    container.innerHTML = approved.length ? approved.map(student => `
        <div style="padding:14px 0;border-top:1px solid #e5e7eb">
            <strong>${student.name}</strong>
            <div class="company">${student.email} - ${student.phone}</div>
            <div class="company">${student.branch} - Roll No: ${student.rollNumber}</div>
        </div>
    `).join("") : "<p class=\"company\">No approved users yet.</p>";
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
                <strong>${student.name}</strong>
                <div class="company">${student.email} - ${student.phone}</div>
                <div class="company">${student.branch} - Roll No: ${student.rollNumber}</div>
                <button class="small-primary" style="margin-top:10px" onclick="approveStudent('${uid}')">Accept</button>
                <button class="danger-btn" style="margin-top:10px" onclick="rejectStudent('${uid}')">Reject</button>
            </div>
        `).join("") : "<p class=\"company\">No pending registrations.</p>";
    } catch (error) {
        const registrations = getLocalStudentRegistrations();
        const pending = Object.entries(registrations).filter(([, student]) => student.status === "pending");
        container.innerHTML = pending.length ? pending.map(([uid, student]) => `
            <div style="padding:14px 0;border-top:1px solid #e5e7eb">
                <strong>${student.name}</strong>
                <div class="company">${student.email} - ${student.phone}</div>
                <div class="company">${student.branch} - Roll No: ${student.rollNumber}</div>
                <button class="small-primary" style="margin-top:10px" onclick="approveStudent('${uid}')">Accept</button>
                <button class="danger-btn" style="margin-top:10px" onclick="rejectStudent('${uid}')">Reject</button>
            </div>
        `).join("") : "<p class=\"company\">No pending registrations.</p>";
    }
}

async function approveStudent(uid) {
    const container = document.getElementById("studentRequestList");
    try {
        if (uid.startsWith("local-")) {
            const registrations = getLocalStudentRegistrations();
            registrations[uid].status = "approved";
            localStorage.setItem("studentRegistrations", JSON.stringify(registrations));
        } else {
            await ensureAdminFirebaseSession();
            await firebase.database().ref(`students/${uid}/status`).set("approved");
        }
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
        if (uid.startsWith("local-")) {
            const registrations = getLocalStudentRegistrations();
            delete registrations[uid];
            localStorage.setItem("studentRegistrations", JSON.stringify(registrations));
        } else {
            await ensureAdminFirebaseSession();
            await firebase.database().ref(`students/${uid}`).remove();
        }
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
    container.innerHTML = "";

    internships.slice(0, 5).forEach(internship => {
        const card = document.createElement("div");
        card.className = "feature-card";
        card.innerHTML = `
            <div style="font-size:30px">🚀</div>
            <h3>${internship.title}</h3>
            <div class="company">${internship.company}</div>
            <div class="feature-info">📍 ${internship.location}</div>
            <div class="feature-info">💰 ${internship.stipend}</div>
            <div class="feature-info">${internship.type === "Online" ? "🌐 Online" : "🏢 Offline"}</div>
            <button onclick="showDetails(${internship.id})">View Internship</button>
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

    const search = document.getElementById("searchInput").value.toLowerCase();

    const filtered = internships.filter(i =>
        i.title.toLowerCase().includes(search) ||
        i.company.toLowerCase().includes(search) ||
        i.specialization.toLowerCase().includes(search) ||
        i.skills.join(" ").toLowerCase().includes(search)
    );

    let html = "";
    filtered.forEach(internship => { html += createCard(internship); });
    container.innerHTML = html;
}

/* =========================================================
   CREATE CARD
========================================================= */
function createCard(internship) {
    return `
        <div class="card">
            <div class="card-top">
                <div class="company-logo">💼</div>
                <button class="bookmark" onclick="bookmark(${internship.id})"
                        title="Save internship" aria-label="Save ${internship.title}">
                    ${bookmarks.includes(internship.id) ? "♥" : "♡"}
                </button>
            </div>
            <h3>${internship.title}</h3>
            <div class="company">${internship.company}</div>
            <div class="tags">
                <span class="tag">${internship.specialization}</span>
                <span class="tag">${internship.type}</span>
            </div>
            <div class="details">
                <div>📍 ${internship.location}</div>
                <div>💰 ${internship.stipend}</div>
                <div>⏱️ ${internship.duration}</div>
            </div>
            <div class="card-actions">
                <button class="secondary-btn" onclick="showDetails(${internship.id})">Details</button>
                <button class="small-primary" onclick="apply(${internship.id})">Apply</button>
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
    if (type === "Online") document.getElementById("onlineChoice").classList.add("selected");
    else document.getElementById("offlineChoice").classList.add("selected");
}

/* =========================================================
   FIND MATCHES
========================================================= */
function findMatches() {
    const branch = document.getElementById("branch").value;
    const specialization = document.getElementById("specialization").value;
    const skills = document.getElementById("skills").value.toLowerCase();
    const location = document.getElementById("location").value.toLowerCase();
    const graduation = document.getElementById("graduation").value;

    let results = internships.map(internship => {
        let score = 0;
        if (internship.type === selectedType) score += 35;
        if (branch && internship.branch === branch) score += 25;
        if (specialization && internship.specialization === specialization) score += 30;
        if (location && internship.location.toLowerCase().includes(location)) score += 10;
        if (graduation) score += 5;

        if (skills) {
            const userSkills = skills.split(",").map(s => s.trim());
            userSkills.forEach(skill => {
                if (internship.skills.join(" ").toLowerCase().includes(skill)) score += 5;
            });
        }
        return { ...internship, score: Math.min(score, 100) };
    });

    results.sort((a, b) => b.score - a.score);

    const container = document.getElementById("resultsContainer");
    let html = "";
    results.forEach(internship => {
        html += `
            <div class="card">
                <div class="card-top">
                    <div class="company-logo">🤖</div>
                    <strong style="color:#16a34a">${internship.score}% Match</strong>
                </div>
                <h3>${internship.title}</h3>
                <div class="company">${internship.company}</div>
                <div class="tags">
                    <span class="tag">${internship.type}</span>
                    <span class="tag">${internship.specialization}</span>
                </div>
                <div class="details">
                    <div>📍 ${internship.location}</div>
                    <div>💰 ${internship.stipend}</div>
                    <div>⏱️ ${internship.duration}</div>
                </div>
                <div class="card-actions">
                    <button class="secondary-btn" onclick="showDetails(${internship.id})">Details</button>
                    <button class="small-primary" onclick="apply(${internship.id})">Apply</button>
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
function showDetails(id) {
    const internship = internships.find(i => i.id === id);
    const modal = document.getElementById("detailsModal");
    const body = document.getElementById("modalBody");

    body.innerHTML = `
        <div style="font-size:45px">💼</div>
        <h2 style="margin-top:15px">${internship.title}</h2>
        <p style="color:#64748b;margin:8px 0 25px">${internship.company}</p>
        <div class="tags">
            <span class="tag">${internship.type}</span>
            <span class="tag">${internship.specialization}</span>
            <span class="tag">${internship.branch}</span>
        </div>
        <h3 style="margin-top:25px">Internship Details</h3>
        <div class="details" style="margin-top:15px">
            <div>📍 Location: <strong>${internship.location}</strong></div>
            <div>💰 Stipend: <strong>${internship.stipend}</strong></div>
            <div>⏱️ Duration: <strong>${internship.duration}</strong></div>
            <div>🧠 Skills: <strong>${internship.skills.join(", ")}</strong></div>
        </div>
        <h3 style="margin-top:25px">About the Internship</h3>
        <p style="color:#64748b;line-height:1.7;margin-top:10px">${internship.description}</p>
        <button class="primary-btn" style="width:100%;margin-top:25px" onclick="apply(${internship.id})">
            Apply Now →
        </button>
    `;
    modal.classList.add("show");
}

function closeModal() {
    document.getElementById("detailsModal").classList.remove("show");
}

/* =========================================================
   APPLY
========================================================= */
function apply(id) {
    const internship = internships.find(i => i.id === id);
    if (internship.link && internship.link !== "#") {
        window.open(internship.link, "_blank");
    } else {
        alert("Application link will be added by the administrator.");
    }
}

/* =========================================================
   BOOKMARK
========================================================= */
function bookmark(id) {
    if (bookmarks.includes(id)) bookmarks = bookmarks.filter(b => b !== id);
    else bookmarks.push(id);
    localStorage.setItem("bookmarks", JSON.stringify(bookmarks));
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
    const skills = document.getElementById("adminSkills").value.split(",").map(s => s.trim());
    const link = document.getElementById("adminLink").value;

    if (!title || !company || !specialization) {
        alert("Please enter the internship title, company and specialization.");
        return;
    }

    internships.unshift({
        id: Date.now(),
        title, company, type, branch, specialization,
        location: location || "Not specified",
        stipend: stipend || "Not specified",
        duration: duration || "Not specified",
        skills,
        description: "New internship added by the InternMatch development team.",
        link: link || "#"
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
    container.innerHTML = internships.map(internship => `
        <div class="card" style="margin-top:15px">
            <div class="card-top">
                <div>
                    <h3 style="margin:0 0 6px">${internship.title}</h3>
                    <div class="company">${internship.company}</div>
                </div>
                <span class="tag">${internship.type}</span>
            </div>
            <div class="tags">
                <span class="tag">${internship.branch}</span>
                <span class="tag">${internship.specialization}</span>
            </div>
            <div class="details">
                <div>📍 ${internship.location}</div>
                <div>💰 ${internship.stipend}</div>
                <div>⏱️ ${internship.duration}</div>
                <div>🧠 ${internship.skills.join(", ")}</div>
            </div>
            <p class="company" style="margin-top:15px">${internship.description}</p>
            <div class="card-actions">
                <button class="secondary-btn" onclick="showDetails(${internship.id})">View Details</button>
                <button class="danger-btn" onclick="deleteInternship(${internship.id})"
                        aria-label="Delete ${internship.title}">Delete</button>
            </div>
        </div>
    `).join("");
}

function deleteInternship(id) {
    const internship = internships.find(item => item.id === id);
    if (!internship || !confirm(`Delete "${internship.title}"?`)) return;

    internships = internships.filter(item => item.id !== id);
    bookmarks = bookmarks.filter(b => b !== id);

    saveInternships();
    localStorage.setItem("bookmarks", JSON.stringify(bookmarks));
    refreshInternshipViews();
}

/* =========================================================
   FEATURED AUTO SCROLL
========================================================= */
setInterval(() => {
    const container = document.getElementById("featuredContainer");
    if (!container) return;
    container.scrollBy({ left: 330, behavior: "smooth" });
    if (container.scrollLeft + container.clientWidth >= container.scrollWidth - 20) {
        container.scrollTo({ left: 0, behavior: "smooth" });
    }
}, 3500);

/* =========================================================
   SESSION PERSISTENCE + LOADING ON REFRESH
========================================================= */
window.addEventListener("load", () => {
    if (getStoredAdminAuthentication()) {
        showLoader("Restoring your session...");
        adminAuthenticatedInMemory = true;

        setTimeout(() => {
            document.body.classList.remove("auth-locked");
            document.body.classList.add("founder-login");
            document.getElementById("authGate").hidden = true;
            document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));
            document.getElementById("admin").classList.add("active");
            updateAdminView();
            hideLoader();
        }, 900);
    } else if (getStoredStudentSession()) {
        currentStudent = getStoredStudentSession();
        document.body.classList.remove("auth-locked", "founder-login");
        document.getElementById("authGate").hidden = true;
        document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));
        document.getElementById("home").classList.add("active");
        updateStudentProfile();
        hideLoader();
    } else {
        hideLoader();
    }
});

/* =========================================================
   INITIAL RENDER
========================================================= */
displayFeatured();
displayInternships();
displayAdminInternships();
updateHomeStats();