import { GoogleGenAI } from '@google/genai';

const aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const predictDeadline = async function(req, res) {
    try {
        const { title, description } = req.body;

        if (!title) {
            return res.status(400).json({ message: "Task title is required to predict deadline" });
        }

        const prompt = `
        You are an expert Agile Project Manager.
        Analyze the following task and predict how many days it should take to complete for a standard software team.
        Consider complexity, testing, and potential roadblocks.

        Task Title: ${title}
        Task Description: ${description || 'No description provided.'}

        Return ONLY a single integer representing the number of days. Do not include any text, words, or explanations. If it takes less than a day, return 1.
        `;

        const aiResponse = await aiClient.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                temperature: 0.2, // Low temperature for consistent predictions
            }
        });

        let textResult = "";
        if (typeof aiResponse.text === 'function') {
            textResult = aiResponse.text() || "";
        } else {
            textResult = aiResponse.text || "";
        }
        
        textResult = textResult.trim();
        if (textResult.startsWith("```")) {
            textResult = textResult.replace(/^```[a-z]*\n/i, "").replace(/\n```$/i, "").trim();
        }
        
        const predictedDays = parseInt(textResult, 10);

        if (isNaN(predictedDays)) {
            // Fallback in case Gemini returns text by mistake
            return res.status(200).json({ predictedDays: 3 }); 
        }

        return res.status(200).json({ predictedDays });

    } catch (err) {
        console.error("Predict Deadline Error:", err);
        return res.status(500).json({ message: "Failed to generate AI prediction" });
    }
};
