# 🚀 Agentic AI Project Management Dashboard

A next-generation, full-stack Kanban project management platform powered by **Real-Time WebSockets** and **Google Gemini Agentic AI**. Built to help engineering teams collaborate faster, avoid duplicate work, and make smarter management decisions using AI.

## ✨ Core Features

### 🔐 Secure & Collaborative
*   **Role-Based Access Control (RBAC):** Strict permission boundaries for Admins, Project Admins, and Members. Only Admins can delete tasks or trigger AI management actions.
*   **Real-Time WebSockets:** Instantly syncs task movements, status updates, and deletions across all connected users without refreshing the page.
*   **Cloud Attachments:** Seamlessly upload and attach images/documents to tasks using Cloudinary.
*   **Target Dates:** Built-in deadlines with visual warnings for overdue tasks.

### 🤖 The "Agentic AI" Engine
Unlike standard wrappers, this platform features an autonomous background agent and on-demand AI tools powered by `@google/genai` and local Machine Learning:

*   **🕵️ Background AI Gatekeeper:** Uses local Machine Learning (`Xenova/all-MiniLM-L6-v2`) to perform zero-cost semantic overlap analysis in the background. If you create a duplicate task, the AI wakes up, evaluates the context, and sends a real-time WebSocket Toast notification warning you.
*   **✨ Predict Deadline:** AI analyzes a task's title and description to predict exactly how many days it will take to complete, automatically filling in your calendar.
*   **✨ Suggest Assignee:** The AI acts as an Engineering Manager. It queries the database, analyzes the active workloads, historical experience, and roles of your team, and mathematically determines the best person for the job.
*   **⚡ AI Task Breakdown:** Instantly breaks down complex tasks into manageable subtasks using generative AI.
*   **📊 AI Standup Generator:** Automatically reads all activity in your project and generates a perfect "Daily Standup" summary of what the team accomplished and what is blocking progress.

---

## 💻 Tech Stack

*   **Frontend:** React, Vite, Vanilla CSS (Premium Glassmorphism Dark Mode)
*   **Backend:** Node.js, Express, Socket.io (WebSockets)
*   **Database:** PostgreSQL (Aiven), Drizzle ORM
*   **Authentication:** JSON Web Tokens (JWT) & bcrypt
*   **AI Integration:** `@google/genai` (Gemini 2.5 Flash), Xenova Transformers pipeline

---

## 🛠️ Local Setup Instructions

1.  **Clone the Repository**
2.  **Install Dependencies**
    Ensure you run `npm install` in both the root backend directory and the `/frontend` directory.
3.  **Environment Variables (`.env`)**
    Rename the `.env.example` file in the root directory to `.env` and fill in your actual API keys and database credentials:
    ```bash
    cp .env.example .env
    ```
    *Note: Never commit your actual `.env` file to version control. It is already included in the `.gitignore`.*
4.  **Push Database Schema**
    Run `npx drizzle-kit push` to sync your local models to your PostgreSQL database.
5.  **Run the Application**
    *   **Backend:** `node server.js`
    *   **Frontend:** `cd frontend && npm run dev`

---

## 🎨 Design Aesthetic
The frontend utilizes a custom `index.css` design system focusing on **vibrant dark modes, glassmorphism, and dynamic micro-animations**. It avoids standard UI libraries in favor of tailored, highly performant CSS tokens.
