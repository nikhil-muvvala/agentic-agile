import { db } from "../db/index.js";
import { usersTable } from "../models/User.js";
import { eq } from "drizzle-orm";

export const updateMySkills = async (req, res) => {
    try {
        const userId = req.user.id;
        const { skills } = req.body;

        if (!Array.isArray(skills)) {
            return res.status(400).json({ message: "Skills must be an array of strings." });
        }

        const [updatedUser] = await db
            .update(usersTable)
            .set({ skills: JSON.stringify(skills) })
            .where(eq(usersTable.id, userId))
            .returning();

        return res.status(200).json({ message: "Skills updated successfully", skills: updatedUser.skills });
    } catch (err) {
        console.error("Error updating skills:", err);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const getMySkills = async (req, res) => {
    try {
        const userId = req.user.id;
        const [user] = await db.select({ skills: usersTable.skills }).from(usersTable).where(eq(usersTable.id, userId));
        
        return res.status(200).json({ skills: user?.skills || [] });
    } catch (err) {
        console.error("Error fetching skills:", err);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const updateMyProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { name } = req.body;

        if (!name || name.trim().length === 0) {
            return res.status(400).json({ message: "Name cannot be empty." });
        }

        const [updatedUser] = await db
            .update(usersTable)
            .set({ name: name.trim() })
            .where(eq(usersTable.id, userId))
            .returning({ id: usersTable.id, name: usersTable.name, email: usersTable.email });

        return res.status(200).json({ message: "Profile updated successfully", user: updatedUser });
    } catch (err) {
        console.error("Error updating profile:", err);
        return res.status(500).json({ message: "Internal server error" });
    }
};
