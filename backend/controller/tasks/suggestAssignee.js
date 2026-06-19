import { GoogleGenAI } from '@google/genai';
import { db } from "../../db/index.js";
import { tasksTable, projectMembers, usersTable, taskCompletionsTable } from "../../models/index.js";
import { eq, and, ne, gt, inArray, desc } from "drizzle-orm";
import { createWeightedVector } from "../../utils/aiGatekeeper.js";
import { cos_sim } from '@xenova/transformers';

const aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const suggestAssignee = async function(req, res) {
    try {
        const projectId = parseInt(req.params.projectId);
        const { title, description } = req.body;

        if (!title) {
            return res.status(400).json({ message: "Task title is required" });
        }

        // 1. Fetch project members
        const members = await db.select({ userId: projectMembers.userId })
            .from(projectMembers)
            .where(eq(projectMembers.projectId, projectId));
        
        const memberIds = members.map(m => m.userId);
        if (memberIds.length === 0) {
            return res.status(400).json({ message: "No members in this project." });
        }

        // 2. Xenova Semantic Search for Historical Experts
        const newVector = await createWeightedVector(title, description);
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
        const recentCompletions = await db.select()
            .from(taskCompletionsTable)
            .where(
                and(
                    gt(taskCompletionsTable.completedAt, sixMonthsAgo),
                    inArray(taskCompletionsTable.assigneeId, memberIds)
                )
            )
            .orderBy(desc(taskCompletionsTable.completedAt))
            .limit(200);

        const userScores = {};
        for (const completion of recentCompletions) {
            const sim = cos_sim(newVector, completion.vector);
            if (sim > 0.3) {
                if (!userScores[completion.assigneeId]) {
                    userScores[completion.assigneeId] = { weightedScore: 0, count: 0, totalDays: 0 };
                }
                // Exponentially reward high similarity (e.g. 0.9^3 = 0.729 vs 0.4^3 = 0.064)
                userScores[completion.assigneeId].weightedScore += Math.pow(sim, 3);
                userScores[completion.assigneeId].count += 1;
                userScores[completion.assigneeId].totalDays += completion.daysToComplete;
            }
        }

        let rankedExperts = Object.keys(userScores).map(uid => {
            const stats = userScores[uid];
            return {
                userId: parseInt(uid),
                similarTasks: stats.count,
                weightedScore: Number(stats.weightedScore.toFixed(3)),
                avgDaysToComplete: Number((stats.totalDays / stats.count).toFixed(2))
            };
        }).sort((a, b) => b.weightedScore - a.weightedScore).slice(0, 5);

        let contextData = "";

        // 3. Eager Retrieval: Capacity vs Skills
        if (rankedExperts.length > 0) {
            const uids = rankedExperts.map(e => e.userId);
            const capacities = [];
            const [allActiveTasks, allCompletions] = await Promise.all([
                db.select().from(tasksTable).where(
                    and(
                        eq(tasksTable.projectId, projectId),
                        inArray(tasksTable.assigneeId, uids),
                        ne(tasksTable.status, 'done')
                    )
                ),
                db.select({ assigneeId: taskCompletionsTable.assigneeId, days: taskCompletionsTable.daysToComplete })
                    .from(taskCompletionsTable)
                    .where(inArray(taskCompletionsTable.assigneeId, uids))
            ]);

            let baselineVelocity = 2.0;
            if (allCompletions.length > 0) {
                const totalDays = allCompletions.reduce((sum, c) => sum + c.days, 0);
                baselineVelocity = totalDays / allCompletions.length;
            }

            for (const uid of uids) {
                const activeTasks = allActiveTasks.filter(t => t.assigneeId === uid);
                const blockedTasksCount = activeTasks.filter(t => t.status === 'blocked').length;
                const effectiveLoad = activeTasks.length - blockedTasksCount;
                const completions = allCompletions.filter(c => c.assigneeId === uid);
                
                let avgVelocity = baselineVelocity; 
                if (completions.length > 0) {
                    const total = completions.reduce((sum, c) => sum + c.days, 0);
                    avgVelocity = total / completions.length;
                }
                const estimatedDaysUntilFree = Number((effectiveLoad * avgVelocity).toFixed(1));
                capacities.push({ userId: uid, effectiveLoad, avgVelocity: Number(avgVelocity.toFixed(1)), estimatedDaysUntilFree });
            }

            contextData = `
            HISTORICAL EXPERTS FOUND!
            Experts data: ${JSON.stringify(rankedExperts)}
            Real Capacity data (estimatedDaysUntilFree): ${JSON.stringify(capacities)}
            `;
        } else {
            // Fallback to Skills
            const users = await db.select({ id: usersTable.id, skills: usersTable.skills })
                .from(usersTable)
                .where(inArray(usersTable.id, memberIds));
            
            const skillEvaluations = users.map(u => ({ userId: u.id, skillTags: u.skills || [] }));
            contextData = `
            NO HISTORICAL EXPERTS FOUND (New feature type).
            Please evaluate the following users based purely on their skill tags:
            Skill Evaluations: ${JSON.stringify(skillEvaluations)}
            `;
        }

        // 4. One-Shot LLM Call (GenAI)
        const prompt = `
        You are an elite Agile Engineering Manager.
        Your job is to assign a new task to the absolute best person on the team.
        New Task Title: ${title}
        New Task Description: ${description || 'No description provided.'}
        
        Here is the eagerly retrieved data about the team:
        ${contextData}

        You MUST evaluate expertise first, and then ensure they have the capacity to take it on.
        Return your final decision as a strict JSON object with EXACTLY this structure:
        {
          "recommendation": <integer ID>,
          "confidence": <number between 0.0 and 1.0>,
          "reasoning": "<1-2 sentence explanation>",
          "alternatives": [ { "userId": <integer>, "reason": "<string>" } ]
        }
        `;

        console.log(`[Suggest Assignee] Sending Eager Retrieval Prompt to Gemini...`);
        const response = await aiClient.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: "You are a JSON-only API. You must return valid JSON matching the requested structure.",
                temperature: 0.1, 
            }
        });

        let textResult = "";
        if (typeof response.text === 'function') {
            textResult = response.text();
        } else {
            textResult = response.text;
        }
        
        let cleanedText = textResult.trim();
        if (cleanedText.startsWith("\`\`\`json")) {
            cleanedText = cleanedText.replace(/^\`\`\`json/i, "").replace(/\`\`\`$/i, "").trim();
        } else if (cleanedText.startsWith("\`\`\`")) {
            cleanedText = cleanedText.replace(/^\`\`\`/i, "").replace(/\`\`\`$/i, "").trim();
        }
        
        const jsonOutput = JSON.parse(cleanedText);
        console.log(`[Suggest Assignee] GenAI Decision: Assigned to User ${jsonOutput.recommendation}`);
        
        return res.status(200).json({ 
            assigneeId: jsonOutput.recommendation,
            confidence: jsonOutput.confidence,
            reasoning: jsonOutput.reasoning,
            alternatives: jsonOutput.alternatives
        });

    } catch (err) {
        console.error("Suggest Assignee Error:", err);
        return res.status(500).json({ message: "Failed to generate AI suggestion" });
    }
};
