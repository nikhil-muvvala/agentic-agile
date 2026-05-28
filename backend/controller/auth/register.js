import { db } from "../../db/index.js";
import { usersTable } from "../../models/User.js";
import bcrypt from "bcrypt";
import { webToken, generateRefreshToken } from "../../utils/accesstoken.js";
import { eq } from "drizzle-orm";
import { validateUser } from "../../services/validateUser.js";

export const register = async function (req, res) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }
    const result = await validateUser(email);
    if (result.length!==0){
      return res.status(400).json({message : "Email already exists"});
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    const [user] = await db
      .insert(usersTable)
      .values({ name, email, password: hashedPassword })
      .returning({ id: usersTable.id });

    const token = webToken({ id: user.id, name, email });
    const refreshToken = generateRefreshToken({ id: user.id, email });
    
    await db.update(usersTable).set({ refreshToken }).where(eq(usersTable.id, user.id));
    
    return res.status(201).json({ accessToken: token, refreshToken });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};