# 🚀 Agentic AI Project Management Dashboard

A next-generation, full-stack Kanban project management platform powered by **Real-Time WebSockets** and **Google Gemini Agentic AI**. Built to help engineering teams collaborate faster, avoid duplicate work, and make smarter management decisions using AI.

## ✨ Core Features

### 🔐 Secure & Collaborative
*   **Role-Based Access Control (RBAC):** Strict permission boundaries for Admins, Project Admins, and Members. Only Admins can delete tasks or trigger AI management actions.
*   **Real-Time WebSockets:** Instantly syncs task movements, status updates, and deletions across all connected users without refreshing the page.
*   **Cloud Attachments:** Seamlessly upload and attach images/documents to tasks using Cloudinary.
*   **Target Dates:** Built-in deadlines with visual warnings for overdue tasks.

### 🤖 Why this is better than Jira or Basecamp
Most project management tools (like Jira, Trello, or Basecamp) are fundamentally just **dumb databases**. They act as digital whiteboards where a human Project Manager has to spend 15 hours a week manually grooming backlogs, checking capacities, and typing out standup reports. They *track* work, but they don't *manage* it.

This platform is the first truly **Agentic Project Management Platform**. It features an autonomous background agent and a suite of on-demand AI tools powered by `@google/genai` (Gemini 2.5) and local Machine Learning that actively manage the project alongside you:

1.  **🕵️ Background AI Gatekeeper (Local ML):** Uses local Machine Learning (`Xenova/all-MiniLM-L6-v2`) to perform zero-cost semantic overlap analysis in the background. If you try to create a duplicate bug ticket that someone else already logged, the AI intercepts it and sends a real-time WebSocket warning before the duplicate work is even started.
2.  **🧠 The Skill-Memory Agent (Suggest Assignee):** Jira forces you to manually guess who is available. Our AI acts as a virtual Engineering Manager. Using **Function Calling**, the AI independently queries the PostgreSQL database, analyzes the team's active workloads, calculates mathematical capacity, evaluates their semantic history, and autonomously assigns the right person.
3.  **📅 The Multi-Step Planning Agent (Project Health Advisor):** A background chron job that wakes up every morning at 9:00 AM, surveys the health of every project, evaluates the subtask progress of all at-risk tasks, and sends intelligent reassignment recommendations directly to the Project Admin's notification bell. 
4.  **⚡ AI Task Breakdown:** Instead of spending an hour writing subtasks, a Product Manager can just type "Build Login Page", and the AI instantly generates the database schema, frontend UI, and API subtasks required to build it.
5.  **📊 AI Standup Generator:** Automatically reads all activity in your project from the last 24 hours and generates a perfect "Daily Standup" summary of what the team accomplished and what is blocking progress.

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
