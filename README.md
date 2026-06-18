#  Agentic AI Project Management Dashboard

** Live Demo:** [https://agentic-agile.vercel.app](https://agentic-agile.vercel.app)

A next-generation, full-stack Kanban project management platform powered by **Real-Time WebSockets** and **Google Gemini Agentic AI**. Built to help engineering teams collaborate faster, avoid duplicate work, and make smarter management decisions using AI.

##  Core Features

###  Secure & Collaborative
*   **Role-Based Access Control (RBAC):** Strict permission boundaries for Admins, Project Admins, and Members. Only Admins can delete tasks or trigger AI management actions.
*   **Real-Time WebSockets:** Instantly syncs task movements, status updates, and deletions across all connected users without refreshing the page.
*   **Cloud Attachments:** Seamlessly upload and attach images/documents to tasks using Cloudinary.
*   **Target Dates:** Built-in deadlines with visual warnings for overdue tasks.

###  Why this is better than Jira or Basecamp
Most project management tools (like Jira, Trello, or Basecamp) are fundamentally just **dumb databases**. They act as digital whiteboards where a human Project Manager has to spend 15 hours a week manually grooming backlogs, checking capacities, and typing out standup reports. They *track* work, but they don't *manage* it.

This platform is the first truly **Agentic Project Management Platform**. It features an autonomous background agent and a suite of on-demand AI tools powered by `@google/genai` (Gemini 2.5) and local Machine Learning that actively manage the project alongside you:

1.  ** Background AI Gatekeeper (Local ML):** Uses local Machine Learning (`Xenova/all-MiniLM-L6-v2`) to perform zero-cost semantic overlap analysis in the background. If you try to create a duplicate bug ticket that someone else already logged, the AI intercepts it and sends a real-time WebSocket warning before the duplicate work is even started.
2.  ** The Skill-Memory Agent (Suggest Assignee):** Jira forces you to manually guess who is available. Our AI acts as a virtual Engineering Manager. Using **Function Calling**, the AI independently queries the PostgreSQL database, analyzes workload and semantic history to recommend the right person.
3.  ** The Multi-Step Planning Agent (Project Health Advisor):** A background cron job that wakes up every morning at 9:00 AM, surveys the health of every project, evaluates the subtask progress of all at-risk tasks, and sends intelligent reassignment recommendations directly to the Project Admin's notification bell. 
4.  ** AI Task Breakdown:** Instead of spending an hour writing subtasks, a Product Manager can just type "Build Login Page", and the AI instantly generates the database schema, frontend UI, and API subtasks required to build it.
5.  ** AI Standup Generator:** Automatically reads all activity in your project from the last 24 hours and generates a perfect "Daily Standup" summary of what the team accomplished and what is blocking progress.

---

##  System Architecture & Scalability Strategy

This application is designed to be highly scalable. If asked in a System Design interview how this project scales to 100,000+ users, here is the architectural blueprint:

### 1. Scaling the Real-Time Traffic (Backend & WebSockets)
*   **The Bottleneck:** WebSockets maintain persistent TCP connections. A single Node.js instance will eventually run out of memory juggling tens of thousands of active connections. Furthermore, if you use standard Round Robin load balancing, the multi-step handshake will get split across different servers, causing the connection to drop before it even opens.
*   **The Load Balancing Strategy:** The backend sits behind an API Gateway configured with **Path-Based Routing** to apply different algorithms based on the request type:
    *   **Round Robin:** Applied to all stateless REST API traffic (`/api/*`) to distribute normal HTTP requests evenly across the cluster.
    *   **IP Hash (Sticky Sessions):** Applied exclusively to stateful WebSocket traffic (`/socket.io/*`) to ensure the TCP upgrade handshake stays glued to the exact same server instance.
*   **Vertical Scaling (Scaling Up):** The initial scaling strategy is to vertically scale the primary server by increasing CPU and RAM. Because Node.js utilizes a highly efficient non-blocking Event Loop, vertically scaling a single server can comfortably support up to 10,000 concurrent WebSocket connections without adding DevOps complexity.
*   **Horizontal Scaling (Scaling Out):** To scale beyond 10,000 users, we horizontally scale the backend by spinning up multiple Node.js instances behind the API Gateway. Because this splits users across isolated servers, a WebSocket broadcast on Server A will not reach a user on Server B. To resolve this, we implement a **Redis Pub/Sub Adapter**. Server A publishes events to Redis, which acts as a central megaphone to instantly broadcast the event to all other horizontally scaled nodes.

### 2. Scaling the Database & AI Memory (pgvector)
*   **The Bottleneck:** Vector similarity search (Cosine Distance) is extremely slow if calculated mathematically on the fly. 
*   **The Solution:** We utilize PostgreSQL with the `pgvector` extension and employ **HNSW (Hierarchical Navigable Small World)** indexes to ensure sub-millisecond AI memory retrieval. Because HNSW is a graph-based algorithm, it requires intense memory jumps.
*   **Vertical Scaling (RAM Limits):** Because of HNSW's random access pattern, the primary scaling strategy is vertically scaling the database's **RAM** to ensure the entire vector index fits comfortably in memory, avoiding devastating Disk I/O bottlenecks.
*   **Horizontal Scaling (CPU Limits):** Even if the index fits in RAM, calculating 768-dimensional vector distances is incredibly CPU-intensive. If 10,000 users trigger an AI search simultaneously, a single server's CPU will max out at 100%. To resolve this, we horizontally scale by introducing **PostgreSQL Read Replicas**. This distributes the heavy `pgvector` mathematical `SELECT` queries across multiple database CPUs.

### 3. Data Distribution (Replication & Partitioning)
*   **Replication Strategy (Single-Leader):** A Project Management tool requires Strong Consistency. If a manager deletes a task, it must vanish instantly for all users. We avoid Multi-Leader and Leaderless architectures because a Kanban board cannot tolerate returning outdated or conflicting task statuses. All writes are routed to a Single Leader to guarantee absolute data integrity.
*   **Partitioning Strategy (Project-Based Sharding):** If the database grows too massive for a single cluster, we partition the data by `project_id`. This guarantees that 100% of a company's projects and tasks live on the exact same physical database server, ensuring immediate query responses and strict data isolation.

### 4. The CAP Theorem Decision (Choosing CP over AP)
In distributed systems, the CAP theorem forces a choice between **Consistency** (perfectly accurate data) and **Availability** (100% uptime) during a network failure. 
For this enterprise tool, we strictly choose **CP (Consistency)**. If a database server disconnects, it is significantly safer for the application to temporarily go offline and show an error message rather than staying online and showing developers outdated tasks. Serving outdated data on a Kanban board would cause developers to perform duplicate work, costing the business time and money.

### 5. Scaling the Compute (Machine Learning)
*   **The Bottleneck:** Node.js is Single-Threaded (Event Loop). Running local machine learning inference (like our `Xenova` semantic overlap checker) directly on the main Node.js process blocks the Event Loop, causing the entire server to freeze for all other users while the math computes.
*   **The Solution:** The heavy reasoning AI is already externalized to Google Gemini's highly scalable APIs. To scale the local ML embeddings, the `Xenova` pipeline is extracted into a **dedicated, stateless Python or Node.js Microservice** (or AWS Lambda). The main server simply makes an asynchronous network call to this microservice, ensuring its single thread remains 100% free to handle other live user requests.

### 6. API Rate Limiting & Message Queues (`pg-boss` & PostgreSQL)
*   **The Bottleneck:** Third-party AI APIs (like Google Gemini) enforce strict rate limits (e.g., 15 Requests Per Minute). If a basic `node-cron` job wakes up and tries to evaluate 10,000 projects simultaneously, it will instantly crash the API and freeze the Node.js Event Loop. Furthermore, `node-cron` is volatile (wiped on server restart) and causes catastrophic race conditions if the backend is horizontally scaled.
*   **The Solution:** We implemented **`pg-boss`**, an enterprise-grade Job Queue that runs natively on our PostgreSQL database using `FOR UPDATE SKIP LOCKED`. We split the architecture into a **Producer** and a **Consumer**:
    *   **The Producer (The Alarm Clock):** A lightweight job that fires at Midnight. It instantly fetches all 10,000 projects and dumps them into a "Waiting Line" queue (`evaluate-project`). It does not communicate with the AI, ensuring the main Event Loop remains completely unblocked.
    *   **The Consumer (The Token Bucket):** A dedicated Worker that listens to the waiting line. It is strictly configured with `teamSize: 1` and `teamConcurrency: 1` to process exactly one project at a time. After each evaluation, it executes a non-blocking `await setTimeout(8000)`. This artificial 8-second delay mathematically guarantees the server will never exceed 7.5 Requests Per Minute, safely protecting the Google API from crashing during heavy traffic spikes.

### 7. Microservices Architecture (Decoupling the Backend)
*   **The Strategy:** To guarantee that the main Node.js API server remains blazingly fast and is never bogged down by heavy machine learning operations, the backend is split into three distinct microservices:
    1.  **Main API Server:** Handles lightweight CRUD operations, User Authentication, and WebSockets. (Fast & Immune to AI rate limits).
    2.  **Dedicated AI Worker:** Solely responsible for communicating with Google Gemini, managing the Token Bucket, and processing the Message Queues. 
    3.  **Local ML Server (Xenova):** A separate CPU-optimized environment dedicated to running local Hugging Face mathematical embeddings without blocking the main event loop.
*   **[NOTE FOR DEPLOYMENT]:** *The codebase is currently structured as a monolithic MVP for ease of local development. The backend will be officially extracted into these three distinct microservices before the final production deployment.*

---

##  Tech Stack

*   **Frontend:** React, Vite, Vanilla CSS (Premium Glassmorphism Dark Mode)
*   **Backend:** Node.js, Express, Socket.io (WebSockets)
*   **Database:** PostgreSQL (Aiven), Drizzle ORM
*   **Authentication:** JSON Web Tokens (JWT) & bcrypt
*   **AI Integration:** `@google/genai` (Gemini 2.5 Flash), Xenova Transformers pipeline

---

##  Local Setup Instructions

1.  **Clone the Repository**
2.  **Install Dependencies**
    Ensure you run `npm install` in both the root backend directory and the `/frontend` directory.
3.  **Environment Variables (`.env`)**
    Rename the `.env.example` file in the root directory to `.env` and fill in your actual API keys and database credentials:
    ```bash
    cp .env.example .env
    ```

4.  **Google OAuth Setup**
    To use the "Login with Google" functionality, you must create a Google Cloud Project and generate an OAuth Client ID.
    *   Go to the Google Cloud Console -> APIs & Services -> Credentials.
    *   Create an **OAuth Client ID** (Web Application).
    *   Add `http://localhost:5173` to the **Authorized JavaScript origins**.
    *   Copy the generated `Client ID`.
    *   Add `VITE_GOOGLE_CLIENT_ID=your-client-id` to `frontend/.env`.
    *   Add `GOOGLE_CLIENT_ID=your-client-id` to `backend/.env`.

5.  **Push Database Schema**
    Run `npx drizzle-kit push` to sync your local models to your PostgreSQL database.

6.  **Run the Application**
    *   **Backend:** `cd backend && node server.js`
    *   **Frontend:** `cd frontend && npm run dev`


