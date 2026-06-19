import { aiClient } from "../../config/ai.js";
import { db } from "../../db/index.js";
import { projectKnowledgeTable, projectMembers, usersTable, tasksTable } from "../../models/index.js";
import { eq, and, sql } from "drizzle-orm";

export const chatWithProject = async function(req, res) {
    try {
        const projectId = parseInt(req.params.projectId);
        const { question, history = [] } = req.body;

        if (!question) {
            return res.status(400).json({ message: "Question is required." });
        }

        console.log(`[Project Brain] User asked: "${question}"`);

        // 1. Embed the user's question
        const embedResponse = await aiClient.models.embedContent({
            model: 'gemini-embedding-2',
            config: { outputDimensionality: 768 },
            contents: question,
        });
        const queryVector = embedResponse.embeddings[0].values;

        // 2. Perform Cosine Similarity Search in pgvector
        // pgvector uses `<=>` for cosine distance. Similarity is `1 - distance`.
        // We only want results with a similarity > 0.75 to prevent hallucinations.
        const similaritySQL = sql`1 - (${projectKnowledgeTable.embedding} <=> ${JSON.stringify(queryVector)})`;

        const memories = await db.select({
            content: projectKnowledgeTable.content,
            createdAt: projectKnowledgeTable.createdAt,
            memoryType: projectKnowledgeTable.memoryType,
            sourceId: projectKnowledgeTable.sourceId,
            similarity: similaritySQL
        })
        .from(projectKnowledgeTable)
        .where(
            and(
                eq(projectKnowledgeTable.projectId, projectId),
                sql`${similaritySQL} > 0.35`
            )
        )
        .orderBy(sql`${projectKnowledgeTable.embedding} <=> ${JSON.stringify(queryVector)}`)
        .limit(8);

        console.log(`[Project Brain] Retrieved ${memories.length} relevant memories.`);

        // 3. Fail-Safe: If no memories found, tell the LLM explicitly.
        let memoryContext = "";
        if (memories.length === 0) {
            memoryContext = "No relevant project history found for this question.";
        } else {
            memoryContext = memories.map((m, index) => {
                const date = new Date(m.createdAt).toLocaleDateString();
                const simScore = Number(m.similarity).toFixed(2);
                return `Memory ${index + 1} (Similarity: ${simScore}, Date: ${date}, Source: ${m.memoryType} #${m.sourceId}):\n${m.content}`;
            }).join("\n\n");
        }

        // 4. Fetch Roster to map IDs to Names
        const roster = await db.select({
            id: usersTable.id,
            name: usersTable.name
        })
        .from(projectMembers)
        .leftJoin(usersTable, eq(projectMembers.userId, usersTable.id))
        .where(eq(projectMembers.projectId, projectId));
        
        const rosterMap = roster.map(m => `User ID ${m.id} = ${m.name}`).join(", ");

        // 5. Fetch "The Whiteboard" (Live Current State of Tasks)
        const currentTasks = await db.select({
            id: tasksTable.id,
            title: tasksTable.title,
            description: tasksTable.description,
            status: tasksTable.status,
            assigneeId: tasksTable.assigneeId
        })
        .from(tasksTable)
        .where(eq(tasksTable.projectId, projectId));
        
        const whiteboardContext = currentTasks.length > 0 
            ? currentTasks.map(t => `[Task ID: ${t.id}] "${t.title}" | Status: ${t.status} | Assigned to User ID: ${t.assigneeId || 'Unassigned'} | Desc: ${t.description || 'None'}`).join("\n")
            : "No active tasks in this project.";

        // 6. Construct the RAG Prompt
        const systemPrompt = `You are the AI Project Brain for this Agile Workspace.
Your job is to answer the user's question using the provided Current Task State (The Whiteboard) and Project Memories (The Diary) below.
If the data mentions a User ID, you MUST use their real name from this roster: [${rosterMap}].
If the data is insufficient or you do not know the answer, say so honestly. Do not hallucinate or make up technical decisions.

IMPORTANT: Respond directly to the user in a friendly, conversational tone using plain text or Markdown. DO NOT output JSON.

--- THE WHITEBOARD (Live Current State of all tasks) ---
${whiteboardContext}

--- THE DIARY (Historical Project Memories relevant to the question) ---
${memoryContext}`;

        // 5. Generate Response with Short-Term History
        const chatSession = aiClient.chats.create({
            model: "gemini-2.5-flash",
            config: {
                systemInstruction: systemPrompt
            },
            history: history.map(msg => ({
                role: msg.role,
                parts: [{ text: msg.text }]
            }))
        });

        const response = await chatSession.sendMessage({ message: question });

        // Deduplicate sources based on type and id
        const uniqueSources = [];
        const seenSources = new Set();
        memories.forEach(m => {
            const key = `${m.memoryType}-${m.sourceId}`;
            if (!seenSources.has(key)) {
                seenSources.add(key);
                uniqueSources.push({ type: m.memoryType, id: m.sourceId });
            }
        });

        // Add a generic source for the Live Whiteboard since we are injecting current tasks
        uniqueSources.unshift({ type: 'live_board', id: 'Live' });

        return res.status(200).json({ 
            answer: response.text,
            sources: uniqueSources
        });

    } catch (err) {
        console.error("[Project Brain Error]", err);
        return res.status(500).json({ message: "Failed to process RAG query" });
    }
};
