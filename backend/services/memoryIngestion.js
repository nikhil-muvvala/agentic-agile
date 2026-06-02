import { aiClient } from "../config/ai.js";
import { db } from "../db/index.js";
import { projectKnowledgeTable } from "../models/index.js";

/**
 * Helper function to semantically chunk text.
 * Prevents "averaging blur" by breaking long descriptions into ~400 character chunks.
 */
function chunkText(text, maxChars = 400) {
    if (!text) return [];
    
    // Split by paragraphs first
    const paragraphs = text.split(/\n\s*\n/);
    const chunks = [];
    
    for (const p of paragraphs) {
        if (p.trim().length === 0) continue;
        
        // If a paragraph is too long, split by sentences
        if (p.length > maxChars) {
            const sentences = p.split(/(?<=[.!?])\s+/);
            let currentChunk = "";
            
            for (const sentence of sentences) {
                if (currentChunk.length + sentence.length > maxChars && currentChunk.length > 0) {
                    chunks.push(currentChunk.trim());
                    currentChunk = sentence;
                } else {
                    currentChunk += " " + sentence;
                }
            }
            if (currentChunk.trim().length > 0) {
                chunks.push(currentChunk.trim());
            }
        } else {
            chunks.push(p.trim());
        }
    }
    return chunks;
}

/**
 * Ingests a new memory into the pgvector database.
 */
export const ingestMemory = async (projectId, content, memoryType, sourceId) => {
    try {
        console.log(`[Memory Ingestion] Processing new '${memoryType}' for project ${projectId}...`);
        
        const chunks = chunkText(content);
        if (chunks.length === 0) {
            console.log(`[Memory Ingestion] No valid text content to embed. Skipping.`);
            return;
        }

        // Generate embeddings for all chunks concurrently
        const vectorPromises = chunks.map(async (chunkText) => {
            const response = await aiClient.models.embedContent({
                model: 'gemini-embedding-2',
                config: { outputDimensionality: 768 },
                contents: chunkText,
            });
            return {
                content: chunkText,
                embedding: response.embeddings[0].values
            };
        });

        const embeddedChunks = await Promise.all(vectorPromises);

        // Insert into database
        const insertPayload = embeddedChunks.map(ec => ({
            projectId,
            content: ec.content,
            embedding: ec.embedding,
            memoryType,
            sourceId
        }));

        await db.insert(projectKnowledgeTable).values(insertPayload);
        
        console.log(`[Memory Ingestion] Successfully ingested ${chunks.length} chunks into Project Knowledge Vault.`);
    } catch (error) {
        console.error(`[Memory Ingestion] Failed to ingest memory:`, error);
    }
};
