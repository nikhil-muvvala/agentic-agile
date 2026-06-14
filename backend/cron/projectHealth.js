import { db } from "../db/index.js";
import { projectsTable } from "../models/index.js";
import { evaluateAtRiskTasks } from "../utils/healthAgent.js";
import boss from "../config/queue.js";

/**
 * Initializes all Background Queues & Workers
 */
export const initQueue = async () => {
    // 0. Ensure both queues exist
    await boss.createQueue("ai-health-check");
    await boss.createQueue("evaluate-project");

    // ---------------------------------------------------------
    // 1. THE PRODUCER (The Midnight Alarm Clock)
    // ---------------------------------------------------------
    await boss.work("ai-health-check", async (job) => {
        console.log(`⏰ [pg-boss Producer] Midnight Alarm! Fetching projects to evaluate...`);
        try {
            // Fetch all active projects
            const projects = await db.select().from(projectsTable);
            
            for (const project of projects) {
                // Do NOT hit the AI. Instead, push it into the Token Bucket waiting line.
                await boss.send("evaluate-project", { projectId: project.id });
                console.log(`📨 Queued project ${project.id} for AI evaluation.`);
            }
            
            console.log("⏰ [pg-boss Producer] Successfully queued all projects for evaluation.");
        } catch (error) {
            console.error("⏰ [pg-boss Producer] Error fetching projects:", error);
            throw error; 
        }
    });

    // ---------------------------------------------------------
    // 2. THE CONSUMER (The Token Bucket Rate Limiter)
    // ---------------------------------------------------------
    // We restrict this worker to only process ONE job at a time.
    await boss.work("evaluate-project", { teamSize: 1, teamConcurrency: 1 }, async (job) => {
        const { projectId } = job.data;
        console.log(`🤖 [pg-boss Consumer] Evaluating Project ID: ${projectId}...`);
        
        try {
            await evaluateAtRiskTasks(projectId);
            console.log(`✅ [pg-boss Consumer] Finished Project ID: ${projectId}.`);
            
            // THE RATE LIMITER: Force an 8-second delay before this worker is allowed 
            // to grab the next job from the queue. (~7.5 jobs per 60 seconds)
            await new Promise(resolve => setTimeout(resolve, 8000));
        } catch (error) {
            console.error(`🚨 [pg-boss Consumer] Error evaluating Project ID: ${projectId}:`, error);
            throw error; 
        }
    });

    // ---------------------------------------------------------
    // 3. THE SCHEDULE
    // ---------------------------------------------------------
    // Fire the Producer every day at Midnight.
    await boss.schedule("ai-health-check", "0 0 * * *");

    console.log("🤖 AI Project Advisor Queue initialized (Producer & Consumer listening).");
};
