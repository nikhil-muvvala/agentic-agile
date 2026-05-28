import { GoogleGenAI } from '@google/genai';
import { db } from '../../db/index.js';
import { tasksTable } from '../../models/tasks.js';
import { eq, ne, and } from 'drizzle-orm';
import { analyzeSemanticOverlap } from '../../utils/aiGatekeeper.js';
import { getIO } from '../../config/socket.js';
import { createNotification } from '../../services/addNotification.js';

const aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });


export async function runAiAdvisorInBackground(newTask, projectId, userId) {
    try {
        // 1. Fetch all other tasks in the project to compare against
        const existingTasks = await db.select({
            id: tasksTable.id,
            title: tasksTable.title,
            description: tasksTable.description,
            status: tasksTable.status
        })
        .from(tasksTable)
        .where(
            and(
                eq(tasksTable.projectId, projectId),
                ne(tasksTable.id, newTask.id) // Exclude the new task itself
            )
        );

        if (existingTasks.length === 0) return;

        // 2. TIER 1: The Zero-Cost Local Machine Learning Gatekeeper
        // Only returns tasks that have a high semantic overlap (> 0.4) with the new task
        const highlyRelatedTasks = await analyzeSemanticOverlap(newTask, existingTasks);

        // If the Gatekeeper found no semantic overlap, STOP silently. Zero API cost used.
        if (highlyRelatedTasks.length === 0) {
            console.log(`[AI Advisor] Tier 1 Gatekeeper: No semantic overlap found for '${newTask.title}'. Stopping silently.`);
            return;
        }

        console.log(`[AI Advisor] Tier 1 Gatekeeper passed! Found ${highlyRelatedTasks.length} related tasks. Proceeding to Tier 2 (Gemini)...`);

        // 3. TIER 2: The Agentic Brain (Gemini)
        // We only send the 2 or 3 highly related tasks to Gemini, saving massive token costs.
        const prompt = `You are a highly analytical Agile Project Manager.
A user just created a new task titled: "${newTask.title}"
Description: "${newTask.description || 'No description'}"

Our local semantic search engine flagged the following existing tasks as highly related:
${JSON.stringify(highlyRelatedTasks, null, 2)}

Analyze this data and determine if the NEW task is a TRUE DUPLICATE of an existing task, or if it has a STRICT FUNCTIONAL DEPENDENCY on an existing task.

CRITICAL RULES:
1. Do NOT flag tasks as duplicates or dependencies just because they share similar names, keywords, or sequential numbers (e.g., "module 1", "module 2", "Part A", "Part B", "User API", "Product API" are inherently distinct and do NOT depend on each other).
2. A strict dependency means the new task fundamentally cannot be started without the existing task being finished (e.g., "Write DB queries" depends on "Design DB schema").
3. If it is just two separate but related tasks (like "Build login UI" and "Build signup UI", or "module 1" and "module 2"), return "NONE".
4. If it is neither a true duplicate nor a strict functional dependency, you MUST return exactly "NONE".

If you do find a true duplicate or strict dependency, write a 1-sentence alert for the manager. 
TONE RULES: Be extremely direct and authoritative. Do NOT use passive phrases like "I noticed", "you may want to", or "consider". Give a clear, professional command. Do not output markdown or JSON, just the raw text.

Example Output (Duplicate):
"Task '1st module' is a duplicate of 'module 1'. Please delete or merge the new task."

Example Output (Dependency):
"Task 'Deploy Web' strictly depends on 'Build Auth' (currently To Do). Link these tasks to ensure correct execution order."`;

        const response = await aiClient.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                temperature: 0.2 // Low temperature for factual, professional text
            }
        });

        let textResponse = "";
        if (typeof response.text === 'function') {
            textResponse = response.text();
        } else {
            textResponse = response.text;
        }
        
        textResponse = textResponse.trim();

        // If Gemini says NONE, there's no problem.
        if (textResponse.toUpperCase() === "NONE") {
            console.log(`[AI Advisor] Tier 2: Gemini analyzed but found no actionable issues.`);
            return;
        }

        // 4. TIER 3: Alert the User via WebSockets AND standard Notifications
        console.log(`[AI Advisor] Alerting User: ${textResponse}`);
        
        // Emits the slide-in popup!
        getIO().to(`user_${userId}`).emit("ai_advisor_alert", {
            message: textResponse
        });

        // Also saves it to the database so it appears in the Notification Bell dropdown!
        // We pass userId as senderId to satisfy the NOT NULL constraint in the DB.
        await createNotification(userId, userId, "💡 AI Advisor: " + textResponse);

    } catch (error) {
        console.error("❌ Background AI Advisor Error:", error);
    }
}
