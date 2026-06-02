import { aiClient } from "../../config/ai.js";
import { db } from "../../db/index.js";
import { projectKnowledgeTable } from "../../models/index.js";
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
                sql`${similaritySQL} > 0.60`
            )
        )
        .orderBy(sql`${projectKnowledgeTable.embedding} <=> ${JSON.stringify(queryVector)}`)
        .limit(3);

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

        // 4. Construct the RAG Prompt
        const systemPrompt = `You are the AI Project Brain for this Agile Workspace.
Your job is to answer the user's question using ONLY the provided project memories below.
If the memories are insufficient or you do not know the answer, say so honestly. Do not hallucinate or make up technical decisions.

IMPORTANT: Respond directly to the user in a friendly, conversational tone using plain text or Markdown. DO NOT output JSON.

Memories Retrieved:
${memoryContext}`;

        // 5. Generate Response with Short-Term History
        const chatSession = aiClient.chats.create({
            model: "gemini-2.5-flash-lite",
            config: {
                systemInstruction: systemPrompt
            },
            history: history.map(msg => ({
                role: msg.role,
                parts: [{ text: msg.text }]
            }))
        });

        const response = await chatSession.sendMessage({ message: question });

        return res.status(200).json({ 
            answer: response.text,
            sources: memories.map(m => ({ type: m.memoryType, id: m.sourceId }))
        });

    } catch (err) {
        console.error("[Project Brain Error]", err);
        return res.status(500).json({ message: "Failed to process RAG query" });
    }
};
