import cron from "node-cron";
import { db } from "../db/index.js";
import { projectsTable } from "../models/index.js";
import { evaluateAtRiskTasks } from "../utils/healthAgent.js";

/**
 * Initializes all background Cron Jobs
 */
export const initCronJobs = () => {
    // Run every day at Midnight (12:00 AM)
    cron.schedule("0 0 * * *", async () => {
        console.log("⏰ [Cron] Waking up Project Health Advisor at Midnight...");
        try {
            // Fetch all active projects
            const projects = await db.select().from(projectsTable);
            
            for (const project of projects) {
                // Let the AI evaluate tasks in this project and notify the admin
                await evaluateAtRiskTasks(project.id);
            }
            
            console.log("⏰ [Cron] Project Health survey completed.");
        } catch (error) {
            console.error("⏰ [Cron] Error running project health script:", error);
        }
    });

    console.log("🤖 AI Project Advisor Cron Job initialized (Scheduled for Midnight daily).");
};
