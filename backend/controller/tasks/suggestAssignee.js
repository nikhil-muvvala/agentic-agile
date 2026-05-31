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

        const prompt = `
        You are an elite Agile Engineering Manager.
        Your job is to assign a new task to the absolute best person on the team based on HISTORICAL EXPERTISE and REAL CAPACITY.
        New Task Title: ${title}
        New Task Description: ${description || 'No description provided.'}
        
        You have 3 tools:
        1. find_historical_experts: USE THIS FIRST. It searches our semantic Memory Bank for team members who have completed similar tasks in the past 6 months.
        2. get_real_capacity: Use this to check the 'estimatedDaysUntilFree' for the top experts you found.
        3. get_skill_confidence: ONLY use this if historical data is thin or you need a tie-breaker. It matches user skill tags against the task.

        You MUST evaluate expertise first, and then ensure they have the capacity to take it on.
        If 'find_historical_experts' returns no experts, you MUST use the 'allProjectMemberIds' it provides to check their skills and real capacity, and assign the task to the person with the highest skill overlap or the most free capacity.
        Return your final decision as a strict JSON object with EXACTLY this structure:
        {
          "recommendation": <integer ID>,
          "confidence": <number between 0.0 and 1.0>,
          "reasoning": "<1-2 sentence explanation>",
          "alternatives": [ { "userId": <integer>, "reason": "<string>" } ]
        }
        `;

        const chat = aiClient.chats.create({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction: "You are a JSON-only API. You must return valid JSON matching the requested structure.",
                tools: [{
                    functionDeclarations: [
                        {
                            name: "find_historical_experts",
                            description: "Searches past completed tasks semantically similar to the new task. Returns ranked experts and a list of allProjectMemberIds."
                        },
                        {
                            name: "get_real_capacity",
                            description: "Returns the real capacity (Days Until Free) for a list of users, factoring in their active tasks, blocked tasks, and average historical velocity.",
                            parameters: {
                                type: "OBJECT",
                                properties: {
                                    userIds: { 
                                        type: "ARRAY", 
                                        items: { type: "INTEGER" } 
                                    }
                                },
                                required: ["userIds"]
                            }
                        },
                        {
                            name: "get_skill_confidence",
                            description: "Evaluates raw skill tags against the task requirements for a list of users. Use if they have no historical completions.",
                            parameters: {
                                type: "OBJECT",
                                properties: {
                                    userIds: { 
                                        type: "ARRAY", 
                                        items: { type: "INTEGER" } 
                                    }
                                },
                                required: ["userIds"]
                            }
                        }
                    ]
                }],
                temperature: 0.1, 
            }
        });

        let response = await chat.sendMessage({ message: prompt });
        let loopCount = 0;

        // Pre-compute the new task vector so both tools can use it
        const newVector = await createWeightedVector(title, description);

        // The Agentic Execution Loop
        while (response.functionCalls && response.functionCalls.length > 0 && loopCount < 5) {
            loopCount++;
            console.log(`[Agent] Turn ${loopCount}: Received ${response.functionCalls.length} function call(s).`);
            
            const functionResponses = await Promise.all(response.functionCalls.map(async (call) => {
                let apiResponse = {};

                if (call.name === 'find_historical_experts') {
                    // Fetch project member IDs first to ensure we only search current team members
                    const members = await db.select({ userId: projectMembers.userId })
                        .from(projectMembers)
                        .where(eq(projectMembers.projectId, projectId));
                    
                    const memberIds = members.map(m => m.userId);

                    if (memberIds.length === 0) {
                        return { functionResponse: { name: call.name, response: { experts: [], allProjectMemberIds: [] } } };
                    }

                    // 2. Fetch last 6 months of completions (LIMIT 200) for project members only
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

                    // 3. Calculate Cosine Similarity
                    const userScores = {};
                    
                    for (const completion of recentCompletions) {
                        const sim = cos_sim(newVector, completion.vector);
                        if (sim > 0.3) {
                            if (!userScores[completion.assigneeId]) {
                                userScores[completion.assigneeId] = { totalSim: 0, count: 0, totalDays: 0 };
                            }
                            userScores[completion.assigneeId].totalSim += sim;
                            userScores[completion.assigneeId].count += 1;
                            userScores[completion.assigneeId].totalDays += completion.daysToComplete;
                        }
                    }

                    // 4. Format Output
                    const rankedExperts = Object.keys(userScores).map(uid => {
                        const stats = userScores[uid];
                        return {
                            userId: parseInt(uid),
                            similarTasks: stats.count,
                            avgSimilarity: Number((stats.totalSim / stats.count).toFixed(2)),
                            avgDaysToComplete: Number((stats.totalDays / stats.count).toFixed(2))
                        };
                    }).sort((a, b) => b.avgSimilarity - a.avgSimilarity).slice(0, 5);

                    apiResponse = { experts: rankedExperts, allProjectMemberIds: memberIds };
                    console.log(`[Agent] Tool: find_historical_experts -> Found ${rankedExperts.length} experts out of ${memberIds.length} members.`);
                } 
                else if (call.name === 'get_real_capacity') {
                    const uids = call.args.userIds;
                    const capacities = [];

                    if (!uids || uids.length === 0) {
                        return { functionResponse: { name: call.name, response: { capacities: [] } } };
                    }

                    // Two queries total, preventing the N+1 bug
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
                        // Group active tasks in memory
                        const activeTasks = allActiveTasks.filter(t => t.assigneeId === uid);
                        const blockedTasksCount = activeTasks.filter(t => t.status === 'blocked').length;
                        const effectiveLoad = activeTasks.length - blockedTasksCount;

                        // Group completions in memory
                        const completions = allCompletions.filter(c => c.assigneeId === uid);
                        
                        let avgVelocity = baselineVelocity; // Dynamic Team Baseline!
                        if (completions.length > 0) {
                            const total = completions.reduce((sum, c) => sum + c.days, 0);
                            avgVelocity = total / completions.length;
                        }

                        // The Math: How many days until they clear their effective desk?
                        const estimatedDaysUntilFree = Number((effectiveLoad * avgVelocity).toFixed(1));

                        capacities.push({
                            userId: uid,
                            activeTasks: activeTasks.length,
                            blockedTasks: blockedTasksCount,
                            effectiveLoad,
                            avgVelocity: Number(avgVelocity.toFixed(1)),
                            estimatedDaysUntilFree
                        });
                    }

                    apiResponse = { capacities };
                    console.log(`[Agent] Tool: get_real_capacity -> Analyzed ${capacities.length} users.`);
                }
                else if (call.name === 'get_skill_confidence') {
                    const uids = call.args.userIds;
                    
                    if (!uids || uids.length === 0) {
                        return { functionResponse: { name: call.name, response: { skillEvaluations: [] } } };
                    }

                    // Bulk fetch users
                    const users = await db.select({ id: usersTable.id, skills: usersTable.skills })
                        .from(usersTable)
                        .where(inArray(usersTable.id, uids));
                    
                    const skillEvaluations = [];

                    for (const uid of uids) {
                        const user = users.find(u => u.id === uid);
                        const userSkills = user?.skills || [];

                        skillEvaluations.push({
                            userId: uid,
                            skillTags: userSkills
                        });
                    }

                    apiResponse = { skillEvaluations };
                    console.log(`[Agent] Tool: get_skill_confidence -> Provided raw skills for ${skillEvaluations.length} users.`);
                }

                return {
                    functionResponse: {
                        name: call.name,
                        response: apiResponse
                    }
                };
            }));

            // Send all parallel responses back to Gemini
            response = await chat.sendMessage({
                message: functionResponses
            });
        }

        let textResult = "";
        if (typeof response.text === 'function') {
            textResult = response.text();
        } else {
            textResult = response.text;
        }
        
        let cleanedText = textResult.trim();
        if (cleanedText.startsWith("```json")) {
            cleanedText = cleanedText.replace(/^```json/i, "").replace(/```$/i, "").trim();
        } else if (cleanedText.startsWith("```")) {
            cleanedText = cleanedText.replace(/^```/i, "").replace(/```$/i, "").trim();
        }
        
        // At this point, cleanedText should be strict JSON
        const jsonOutput = JSON.parse(cleanedText);
        
        console.log(`[Agent] Final Decision: Assigned to User ${jsonOutput.recommendation}`);
        
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
