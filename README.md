# 🎓 InternMatch

**A web platform that helps students and graduates discover internships matched to their branch, skills and career goals.**

**Built with:** HTML5 • CSS3 • JavaScript • React (chat assistant) • Firebase • Vite • GitHub Pages

🔗 **Live Demo:** https://ratnaprasad17.github.io/jip-project/

---

## 📌 About the Project

Finding the right internship is hard: listings are scattered and rarely match a student's branch or skills. **InternMatch** brings internships into one place. Students register, tell the app about their branch, interests and skills, and get a list of recommended online or offline internships. An admin team keeps the listings updated and approves student accounts.

This project was built as a student project at **Sri Vasavi Engineering College**.

---

## ✨ Features

### For Students
- 🔐 **Secure login and registration** with admin approval
- 🔑 Forgot password and show/hide password options
- ☼ Persistent light/dark appearance, initialized from the device preference
- 🔥 **Featured and latest internships** on the home page
- 💬 **InternMatch assistant** for current listings, follow-up questions, application steps and matching rules
- 🔎 **Live search** by internship title, skill or company
- 🎯 **Personalised matching** based on:
  - Internship type (Online / Offline)
  - Branch and specialization
   - Skills and preferred location
- 📄 Detailed internship view with stipend, duration, skills and apply link
- 👤 Student profile page

### For Admin
- 👨‍💻 Firebase-authenticated admin login with database-enforced access
- ➕ Publish new internships (title, company, type, branch, stipend, duration, skills, apply link)
- 🗂️ Manage and remove existing internships
- ✅ Approve student registrations and view approved users

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, JavaScript (vanilla), React chatbot, bot-avatars |
| Authentication & Database | Firebase Authentication, Firebase Realtime Database |
| Build & Deployment | Vite, GitHub Pages with GitHub Actions |

---

## 📂 Project Structure

```
jip-project/
├── .github/workflows/   # GitHub Actions workflow for deployment
├── .githooks/           # Git hooks (auto push after commits)
├── index.html           # Main page and all app sections
├── style.css            # Styling
├── script.js            # App logic (auth, matching, admin, Firebase)
├── src/chatbot.jsx      # React chatbot with bot-avatars
├── vite.config.mjs      # Production build configuration
├── vasavi-logo.jpg      # College logo
└── README.md
```

---

## 🚀 Getting Started

### Run locally

1. **Clone the repository**
   ```bash
   git clone https://github.com/ratnaprasad17/jip-project.git
   cd jip-project
   ```

2. **Install and run the website**
   ```bash
   npm ci
   npm run dev
   ```
   Open the local URL printed by Vite. Use `npm run build` to create the GitHub Pages site in `dist/`.

3. **Firebase setup** (to use your own backend)
   - Create a project in the [Firebase Console](https://console.firebase.google.com/)
   - Enable **Authentication** (Email/Password) and **Realtime Database**
   - Add your Firebase config in `script.js`
   - Create an admin user under Authentication, then add `/admins/<admin-uid>` as boolean `true` in Realtime Database
   - Deploy the database access rules with `firebase deploy --only database`

Admin access is never granted by a password in the website source or browser storage. The admin UID must be explicitly allowlisted in Realtime Database, and the deployed rules restrict internship writes and student management to that UID. See [AUTOMATION.md](AUTOMATION.md) for deployment details.

---

## 🧭 How It Works

1. A student **registers** with name, email, phone, college/branch and roll number.
2. The admin **approves** the account.
3. The student **logs in** and fills in preferences on the *Find Internship* page.
4. InternMatch shows **recommended internships** that match the profile.
5. The student opens the details and **applies** through the provided link.

---

## 🔮 Future Improvements

- [ ] Email notifications for new matching internships
- [ ] Resume upload for students
- [ ] Admin activity audit log
- [ ] Advanced filters (stipend range, duration)

---

## 👨‍💻 Author

**Benny**
B.Tech (AI & ML), Sri Vasavi Engineering College

🔗 GitHub: [@ratnaprasad17](https://github.com/ratnaprasad17)

---

## 📜 License

This project is created for educational purposes as a student project.

---

⭐ If you like this project, give it a star!
