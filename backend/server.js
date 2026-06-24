import express from "express";
import http from "http";
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
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
import { initQueue } from "./cron/projectHealth.js";
import boss from "./config/queue.js";

const app = express();
const server = http.createServer(app);
const PORT = 3000;

// Initialize Socket.io
initSocket(server);
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true
}));


app.get("/api/v1/healthcheck", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Server is running"
    });
});
app.use(express.json());

// it converts the generated swagger.yaml from openapi to json and stored in this swaggerDocument
const swaggerDocument = YAML.load('./swagger.yaml');

swaggerDocument.servers = [{ url: 'http://localhost:3000/api/v1', description: 'Local Development Server' }];
// Adding Authorize button for JWT Token
swaggerDocument.components = swaggerDocument.components || {};
swaggerDocument.components.securitySchemes = {
  bearerAuth: {
    type: 'http', // it means http header
    scheme: 'bearer', // with authorization : starts with bearer
    bearerFormat: 'JWT'
  }
};
swaggerDocument.security = [{ bearerAuth: [] }]; // al endpoints are locked with bearerAuth 

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/projects", projectRouter);
app.use("/api/v1/projects", teamRouter);
app.use("/api/v1/tasks", taskRouter);
app.use("/api/v1/projects/:projectId/t/:taskId/subtasks", subtaskRouter);
app.use("/api/v1/projects/:projectId/notes", noteRouter);
app.use("/api/v1/notifications", notificationRouter);
app.use("/api/v1/users", userRouter);
const startServer = async () => {
    try {
        // 1. Start pg-boss (Creates the tables automatically if missing)
        await boss.start();
        console.log("🐘 [pg-boss] Database queue started successfully.");
        
        // 2. Initialize our Queues & Workers
        await initQueue();
        
        // 3. Start listening for HTTP requests
        server.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
};

startServer();