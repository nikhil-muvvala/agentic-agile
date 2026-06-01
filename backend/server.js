import express from "express";
import http from "http";
import { initSocket } from "./config/socket.js";
import authRouter from "./router/authRoutes.js";
import projectRouter from "./router/projectManagementRoutes.js";
import teamRouter from "./router/teamMemberRoutes.js";
import taskRouter from "./router/taskRoutes.js";
import subtaskRouter from "./router/subtaskRoutes.js";
import noteRouter from "./router/noteRoutes.js";
import notificationRouter from "./router/notificationRoutes.js";
import userRouter from "./router/userRoutes.js";
import cors from "cors";
import { initCronJobs } from "./cron/projectHealth.js";

const app = express();
const server = http.createServer(app);
const PORT = 3000;

// Initialize Socket.io
initSocket(server);
app.use(cors());

// Initialize Background Cron Jobs
initCronJobs();

app.get("/api/v1/healthcheck", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Server is running"
    });
});
app.use(express.json());
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/projects", projectRouter);
app.use("/api/v1/projects", teamRouter);
app.use("/api/v1/tasks", taskRouter);
app.use("/api/v1/projects/:projectId/t/:taskId/subtasks", subtaskRouter);
app.use("/api/v1/projects/:projectId/notes", noteRouter);
app.use("/api/v1/notifications", notificationRouter);
app.use("/api/v1/users", userRouter);
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});