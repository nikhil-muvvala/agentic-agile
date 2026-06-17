import { instrument } from "@socket.io/admin-ui";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";

let io;

export const initSocket = (server) => {
  // 1. Initialize Socket.IO with CORS settings
  io = new Server(server, {
    cors: {
      origin: [process.env.FRONTEND_URL || "http://localhost:5173", "https://admin.socket.io"], // Dynamically accept local or deployed frontend
      methods: ["GET", "POST", "PATCH", "DELETE"],
      credentials: true
    }
  });
  // 2. Instrument for Admin UI
  instrument(io, {
    auth: false
  });
  // 2. Middleware: Authenticate every socket connection using JWT
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error("Authentication error: No token provided"));
      }

      // Verify the token
      const decoded = jwt.verify(token, process.env.SECRET_KEY);
      
      // Attach the user info to the socket object so we know who is connected
      socket.user = decoded; 
      next();
    } catch (err) {
      next(new Error("Authentication error: Invalid token"));
    }
  });

  // 3. Handle Connection Events
  io.on("connection", (socket) => {
    console.log(`✅ User Connected to WebSockets: ${socket.user.name} (${socket.id})`);
    socket.join(`user_${socket.user.id}`);
    // Listen for a custom event from the frontend telling us which project they opened
    socket.on("join_project_room", (projectId) => {
      const roomName = `project_${projectId}`;
      socket.join(roomName);
      console.log(`User ${socket.user.name} joined room: ${roomName}`);
    });

    socket.on("leave_project_room", (projectId) => {
      const roomName = `project_${projectId}`;
      socket.leave(roomName);
      console.log(`User ${socket.user.name} left room: ${roomName}`);
    });

    socket.on("disconnect", () => {
      console.log(`❌ User Disconnected: ${socket.user.name} (${socket.id})`);
    });
  });

  return io;
};

// Export a helper function so our controllers can emit events
export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io is not initialized!");
  }
  return io;
};

