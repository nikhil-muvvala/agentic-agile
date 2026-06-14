import { db } from "../db/index.js";
import { projectsTable } from "../models/index.js";
import { evaluateAtRiskTasks } from "../utils/healthAgent.js";
import boss from "../config/queue.js";

/**
 * Initializes all Background Queues & Workers
 */
export const initQueue = async () => {
    // 0. Ensure the queue exists before scheduling or working on it (Required for pg-boss v9+)
    await boss.createQueue("ai-health-check");

    // 1. Define the Worker (What happens when a job is grabbed)
    await boss.work("ai-health-check", async (job) => {
        console.log(`⏰ [pg-boss] Waking up to process AI-Health-Check (Job ID: ${job.id})...`);
        try {
            // Fetch all active projects
            const projects = await db.select().from(projectsTable);
            
            for (const project of projects) {
                // Let the AI evaluate tasks in this project and notify the admin
                await evaluateAtRiskTasks(project.id);
            }
            
            console.log("⏰ [pg-boss] Project Health survey completed successfully.");
        } catch (error) {
            console.error("⏰ [pg-boss] Error running project health script:", error);
            throw error; // Let pg-boss know the job failed so it can retry
        }
    });

    // 2. Schedule the Cron Job (The Alarm Clock)
    // "0 0 * * *" runs at exactly Midnight. 
    // pg-boss saves this schedule permanently in the database.
    await boss.schedule("ai-health-check", "0 0 * * *");

    console.log("🤖 AI Project Advisor Queue initialized (pg-boss listening).");
};
