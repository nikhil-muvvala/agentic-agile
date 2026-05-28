import { validateUser } from "../../services/validateUser.js";
import { db } from "../../db/index.js";
import { usersTable } from "../../models/User.js";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";

export const changePassword = async function(req,res){
    try{ 
    const {oldPassword , newPassword} = req.body;
    const {email} = req.user;
    if(!oldPassword || !newPassword){
        return res.status(400).json({message : "old password and new password should npt be null"});
    }
    const [user]=await validateUser(email);
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
        return res.status(400).json({ message: "Password is incorrect" });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await db.update(usersTable).set({ password: hashedPassword }).where(eq(usersTable.email, email));
    return res.status(200).json({message:"Successfully updated"});
} catch(err){
    return res.status(400).json({ message: err.message });
}
}