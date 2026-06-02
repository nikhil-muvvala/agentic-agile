import 'dotenv/config';
import { aiClient } from './config/ai.js';
import { db } from './db/index.js';
import { projectKnowledgeTable } from './models/index.js';
import { eq, and, sql } from 'drizzle-orm';

async function main() {
    try {
        const question = 'hi';
        const history = [];
        
        console.log("Embedding question...");
        const embedResponse = await aiClient.models.embedContent({
            model: 'gemini-embedding-2',
            config: { outputDimensionality: 768 },
            contents: question,
        });
        const queryVector = embedResponse.embeddings[0].values;
        
        console.log("Vector generated. Dimensions:", queryVector.length);
        console.log("Querying DB...");
        
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
                eq(projectKnowledgeTable.projectId, 4),
                sql`${similaritySQL} > 0.75`
            )
        )
        .limit(3);
        
        console.log("DB Memories:", memories);
        
        const systemPrompt = "hi";
        const chatSession = aiClient.chats.create({
            model: "gemini-2.5-flash",
            systemInstruction: systemPrompt,
            history: history
        });

        console.log("Generating response...");
        const response = await chatSession.sendMessage({ message: question });
        console.log("Response:", response.text);
    } catch(e) {
        console.error('CRASHED', e);
    }
}
main();
