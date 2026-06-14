import { PgBoss } from "pg-boss";
import dotenv from "dotenv";

dotenv.config();

// Initialize pg-boss with the existing PostgreSQL connection string
const boss = new PgBoss(process.env.DATABASE_URL);

boss.on("error", (error) => {
    console.error("🚨 [pg-boss] Unexpected error in background queue:", error);
});

export default boss;
