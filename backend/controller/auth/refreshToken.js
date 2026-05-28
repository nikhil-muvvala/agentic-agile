import jwt from "jsonwebtoken";
import { db } from "../../db/index.js";
import { usersTable } from "../../models/User.js";
import { eq, and } from "drizzle-orm";
import { webToken } from "../../utils/accesstoken.js";

export const refreshAccessToken = async function (req, res) {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ message: "Refresh token is required" });
    }

    // Verify the refresh token
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET_KEY);
    
    // Check if the user exists and the refresh token matches what's in the database
    const users = await db.select().from(usersTable).where(
        and(
            eq(usersTable.id, decoded.id),
            eq(usersTable.refreshToken, refreshToken)
        )
    );

    if (users.length === 0) {
      return res.status(401).json({ message: "Invalid refresh token or token has been revoked" });
    }

    const user = users[0];

    // Generate a new short-lived access token
    const newAccessToken = webToken({ id: user.id, name: user.name, email: user.email });

    return res.status(200).json({ accessToken: newAccessToken });
  } catch (err) {
    return res.status(401).json({ message: err.message });
  }
};
