import { db } from "../../db/index.js";
import { usersTable } from "../../models/index.js";
import { eq } from "drizzle-orm";

export const logout = async (req, res) => {
    try {
        const userId = req.user.id; 
        
        // Clear the refresh token in the database
        await db.update(usersTable)
            .set({ refreshToken: null })
            .where(eq(usersTable.id, userId));

        return res.status(200).json({ success: true, message: "Logged out successfully" });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};
