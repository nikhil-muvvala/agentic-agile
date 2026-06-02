import 'dotenv/config';
import { db } from './db/index.js';
import { sql } from 'drizzle-orm';

async function main() {
    try {
        console.log("Enabling pgvector extension...");
        await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector;`);
        console.log("Successfully enabled pgvector!");
        process.exit(0);
    } catch (err) {
        console.error("Error enabling pgvector:", err);
        process.exit(1);
    }
}
main();
