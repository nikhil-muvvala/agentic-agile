import { GoogleGenAI } from '@google/genai';
import { db } from "../../db/index.js";
import { tasksTable } from "../../models/tasks.js";
import { eq } from "drizzle-orm";

const aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const suggestAssignee = async function(req, res) {
    try {
        const projectId = parseInt(req.params.projectId);
        const { title, description, members } = req.body;

        if (!title || !members || members.length === 0) {
            return res.status(400).json({ message: "Task title and team members are required" });
        }

        // Fetch all tasks for the project to analyze workloads
        const allTasks = await db.select().from(tasksTable).where(eq(tasksTable.projectId, projectId));

        // Build a rich profile for each member including their current workload and history
        const memberProfiles = members.map(m => {
            const memberTasks = allTasks.filter(t => t.assigneeId === m.user.id);
            const activeCount = memberTasks.filter(t => t.status !== 'done').length;
            const doneCount = memberTasks.filter(t => t.status === 'done').length;
            
            // Get their last 3 tasks to understand what they usually work on
            const recentTaskTitles = memberTasks.slice(-3).map(t => t.title).join(", ");

            return `ID: ${m.user.id} | Name: ${m.user.name} | Role: ${m.role} | Active Workload: ${activeCount} tasks | Completed: ${doneCount} tasks | Recent Experience: [${recentTaskTitles || 'None'}]`;
        });

        const membersListString = memberProfiles.join("\n");

        const prompt = `
        You are an expert Agile Engineering Manager.
        Your job is to assign a new task to the BEST person on the team.
        You must consider:
        1. Their Role (does it fit the task?).
        2. Their Recent Experience (have they done similar tasks?).
        3. Their Active Workload (do NOT assign to someone who is overloaded with 5+ active tasks if someone else can do it).

        New Task Title: ${title}
        New Task Description: ${description || 'No description provided.'}

        Available Team Members and their Profiles:
        ${membersListString}

        Return ONLY the integer ID of the best team member for this task. Do not include any text, words, or explanations. If no one fits perfectly, just pick the project admin or the first person.
        `;

        const aiResponse = await aiClient.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                temperature: 0.1, 
            }
        });

        let textResult = "";
        if (typeof aiResponse.text === 'function') {
            textResult = aiResponse.text();
        } else {
            textResult = aiResponse.text;
        }
        
        textResult = textResult.trim();
        const suggestedId = parseInt(textResult);

        if (isNaN(suggestedId)) {
            // Fallback
            return res.status(200).json({ assigneeId: members[0].user.id }); 
        }

        return res.status(200).json({ assigneeId: suggestedId });

    } catch (err) {
        console.error("Suggest Assignee Error:", err);
        return res.status(500).json({ message: "Failed to generate AI suggestion" });
    }
};
