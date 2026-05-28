import bcrypt from "bcrypt";
import { validateUser } from "../../services/validateUser.js";
import { webToken, generateRefreshToken } from "../../utils/accesstoken.js";
import { db } from "../../db/index.js";
import { usersTable } from "../../models/User.js";
import { eq } from "drizzle-orm";

export const login = async function (req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }
    const result = await validateUser(email);
    if(result.length===0){
      return res.status(400).json({message : "No email exists"});
    }
    const user = result[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Password is incorrect" });
    }
    const token = webToken({ id: user.id, name: user.name, email: user.email });
    const refreshToken = generateRefreshToken({ id: user.id, email: user.email });
    
    await db.update(usersTable).set({ refreshToken }).where(eq(usersTable.id, user.id));
    
    return res.status(200).json({ accessToken: token, refreshToken });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};