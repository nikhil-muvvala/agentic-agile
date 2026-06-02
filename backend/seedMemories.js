import 'dotenv/config';
import { ingestMemory } from './services/memoryIngestion.js';

async function seed() {
    const projectId = 1; // Testing on Project 1
    
    console.log("Seeding dummy memories for Project 1...");

    const dummyMemories = [
        {
            content: "Architectural Decision: We decided to use Redis for caching instead of Memcached. The primary reason was Redis's built-in persistence features and better support for complex data structures like Sets and Hashes.",
            type: "project_note",
            sourceId: 101
        },
        {
            content: "Task Completed: Migrate Authentication to JWT. We switched from session cookies to JSON Web Tokens (JWT) to allow our backend to horizontally scale completely statelessly.",
            type: "task_completion",
            sourceId: 102
        },
        {
            content: "Security Policy Update: All API routes must now implement Rate Limiting (maximum 100 requests per minute per IP) to prevent DDoS attacks. Implemented using express-rate-limit.",
            type: "project_note",
            sourceId: 103
        }
    ];

    for (const mem of dummyMemories) {
        await ingestMemory(projectId, mem.content, mem.type, mem.sourceId);
    }
    
    console.log("Seeding complete!");
    process.exit(0);
}

seed();
