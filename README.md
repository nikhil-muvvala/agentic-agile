#  Agentic AI Project Management Dashboard

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
*   **Replication Strategy (Single-Leader):** A Project Management tool requires Strong Consistency; if a manager deletes a task, it must vanish instantly for all users. We specifically avoid **Multi-Leader** architectures to prevent "Eventual Consistency" anomalies (such as deleted projects being brought back to life via Last Write Wins conflict resolution). We also avoid **Leaderless** architectures (which prioritize High Availability over Consistency) because a Kanban board cannot tolerate returning outdated task statuses via Quorum reads. All writes are routed to a Single Leader to guarantee absolute data integrity.
*   **Partitioning Strategy (Project-Based Sharding):** If the database grows too massive for a single cluster, we partition the data. Instead of randomly sharding by `task_id` (which requires slow Scatter-Gather network joins to load a single board), we utilize **Project-Based Partitioning** hashed by `project_id`. This guarantees that 100% of a company's projects, tasks, and users live on the exact same physical database shard, ensuring immediate query responses and strict data isolation.

### 4. Scaling the Compute (Machine Learning)
*   **The Bottleneck:** Node.js is Single-Threaded (Event Loop). Running local machine learning inference (like our `Xenova` semantic overlap checker) directly on the main Node.js process blocks the Event Loop, causing the entire server to freeze for all other users while the math computes.
*   **The Solution:** The heavy reasoning AI is already externalized to Google Gemini's highly scalable APIs. To scale the local ML embeddings, the `Xenova` pipeline is extracted into a **dedicated, stateless Python or Node.js Microservice** (or AWS Lambda). The main server simply makes an asynchronous network call to this microservice, ensuring its single thread remains 100% free to handle other live user requests.

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
    *Note: Never commit your actual `.env` file to version control. It is already included in the `.gitignore`.*
4.  **Push Database Schema**
    Run `npx drizzle-kit push` to sync your local models to your PostgreSQL database.
5.  **Run the Application**
    *   **Backend:** `node server.js`
    *   **Frontend:** `cd frontend && npm run dev`


