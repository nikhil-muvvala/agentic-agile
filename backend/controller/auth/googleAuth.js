import { OAuth2Client } from 'google-auth-library';
import { validateUser } from '../../services/validateUser.js';
import { webToken, generateRefreshToken } from '../../utils/accesstoken.js';
import { db } from '../../db/index.js';
import { usersTable } from '../../models/User.js';
import { eq } from 'drizzle-orm';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ message: "Google credential token is required" });
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({ message: "Server misconfiguration: Missing GOOGLE_CLIENT_ID" });
    }

    // 1. Mathematically verify the Google JWT
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID, 
    });

    // 2. Extract verified payload
    const payload = ticket.getPayload();
    const { email, name } = payload;

    if (!email) {
      return res.status(400).json({ message: "Google token did not contain an email address" });
    }

    // 3. Check if user exists in our database
    const result = await validateUser(email);
    let user;

    if (result.length === 0) {
      // 4. User does not exist, create a new one. 
      const [newUser] = await db.insert(usersTable)
        .values({ 
          name: name || email.split('@')[0], 
          email 
        })
        .returning();
        
      user = newUser;
    } else {
      user = result[0];
    }

    // 5. Generate our own JWTs and log them in
    const token = webToken({ id: user.id, name: user.name, email: user.email });
    const refreshToken = generateRefreshToken({ id: user.id, email: user.email });
    
    // 6. Save the refresh token to the DB
    await db.update(usersTable).set({ refreshToken }).where(eq(usersTable.id, user.id));
    
    return res.status(200).json({ accessToken: token, refreshToken });

  } catch (error) {
    console.error("Google Auth Error:", error);
    return res.status(401).json({ message: "Invalid Google Token" });
  }
};
