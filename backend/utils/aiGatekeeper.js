import { pipeline, cos_sim } from '@xenova/transformers';

/**
 * Singleton pattern to ensure the ML model is only loaded into memory once.
 * Loading the model the first time takes a few seconds, but subsequent calls are instant.
 */
class PipelineSingleton {
    static task = 'feature-extraction';
    // We use MiniLM as it is the industry standard for fast, high-quality semantic search
    static model = 'Xenova/all-MiniLM-L6-v2';
    static instance = null;

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            console.log("🤖 Loading Local Machine Learning Model into memory...");
            this.instance = await pipeline(this.task, this.model, { progress_callback });
            console.log("✅ Local ML Model loaded successfully!");
        }
        return this.instance;
    }
}

/**
 * Analyzes a new task against a list of existing tasks using pure semantic meaning (Embeddings).
 * Returns an array of tasks that have a cosine similarity > 0.4
 * 
 * @param {Object} newTask - The task just created (contains title and description)
 * @param {Array} existingTasks - Array of objects: { id, title, description, status }
 * @returns {Promise<Array>} - The filtered list of highly related tasks
 */
export async function analyzeSemanticOverlap(newTask, existingTasks) {
    try {
        if (!existingTasks || existingTasks.length === 0) return [];

        // 1. Get the ML Model
        const extractor = await PipelineSingleton.getInstance();

        // Helper function to create a Weighted Vector
        const createWeightedVector = async (title, description) => {
            // 1. Get the title vector
            const titleOutput = await extractor(title, { pooling: 'mean', normalize: true });
            const titleVector = titleOutput.tolist()[0];

            // 2. If no description, just return the title vector
            if (!description || description.trim() === '') {
                return titleVector;
            }

            // 3. Get the description vector
            const descOutput = await extractor(description, { pooling: 'mean', normalize: true });
            const descVector = descOutput.tolist()[0];

            // 4. Mathematical Weighting: 70% Title, 30% Description
            const TITLE_WEIGHT = 0.70;
            const DESC_WEIGHT = 0.30;

            const combinedVector = titleVector.map((val, i) => {
                return (val * TITLE_WEIGHT) + (descVector[i] * DESC_WEIGHT);
            });

            // 5. L2 Normalization (Re-normalize the combined vector to unit length)
            const magnitude = Math.sqrt(combinedVector.reduce((sum, val) => sum + (val * val), 0));
            const normalizedVector = combinedVector.map(val => val / magnitude);

            return normalizedVector;
        };

        // 2. Generate the Weighted Embedding Vector for the NEW task
        const newVector = await createWeightedVector(newTask.title, newTask.description);

        // 3. Compare it against all existing tasks
        const relatedTasks = [];

        for (const task of existingTasks) {
            // Generate the Weighted Embedding Vector for the existing task
            const existingVector = await createWeightedVector(task.title, task.description);

            // Calculate Cosine Similarity (1.0 = identical, 0.0 = completely unrelated)
            const similarity = cos_sim(newVector, existingVector);
            
            // Tier 1 Gatekeeper Threshold: Only pass tasks that are mathematically related
            if (similarity > 0.4) {
                relatedTasks.push({
                    ...task,
                    similarityScore: similarity.toFixed(3)
                });
            }
        }

        // Sort by highest similarity first
        return relatedTasks.sort((a, b) => b.similarityScore - a.similarityScore);

    } catch (error) {
        console.error("❌ Gatekeeper ML Error:", error);
        return []; // Fail gracefully, don't break the app
    }
}
