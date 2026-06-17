import 'dotenv/config';
import { ingestMemory } from './services/memoryIngestion.js';
import { db } from './db/index.js';
import { tasksTable, projectsTable } from './models/index.js';
import { eq } from 'drizzle-orm';

async function seed() {
    console.log("Looking up Payment Gateway project...");
    
    // Find the project
    const projects = await db.select().from(projectsTable).where(eq(projectsTable.name, 'Payment Gateway Overhaul'));
    if (projects.length === 0) {
        console.error("Payment Gateway project not found!");
        process.exit(1);
    }
    
    const projectId = projects[0].id;
    console.log(`Found project ID: ${projectId}. Fetching tasks...`);

    // Fetch all tasks
    const tasks = await db.select().from(tasksTable).where(eq(tasksTable.projectId, projectId));
    
    console.log(`Found ${tasks.length} tasks. Generating ML Vector Embeddings...`);

    for (const task of tasks) {
        // Build a memory string that includes the assignee context
        const assigneeContext = task.assigneeId ? `Assigned to user ID ${task.assigneeId}.` : "Unassigned.";
        const memoryContent = `Task: ${task.title}. Description: ${task.description}. Status: ${task.status}. ${assigneeContext}`;
        
        console.log(`Ingesting: ${task.title}`);
        await ingestMemory(projectId, memoryContent, "task_completion", task.id);
    }
    
    console.log("Vector Embeddings complete! AI now has semantic memory of this project.");
    process.exit(0);
}

seed();
