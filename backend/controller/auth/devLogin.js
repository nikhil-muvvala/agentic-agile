import { db } from '../../db/index.js';
import { usersTable } from '../../models/User.js';
import { webToken } from '../../utils/accesstoken.js';
import { eq } from 'drizzle-orm';

export const devLogin = async (req, res) => {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ message: "Forbidden" });
  }

  try {
    const email = "testuser@agenticagile.com";
    const name = "Test User";

    // Create or find user
    let [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    
    if (!user) {
      [user] = await db.insert(usersTable).values({ name, email, password: "testpassword" }).returning();
    }

    const token = webToken({ id: user.id, name: user.name, email: user.email });
    
    return res.status(200).json({ 
      message: "Dev Login Successful", 
      accessToken: token 
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server Error" });
  }
};
