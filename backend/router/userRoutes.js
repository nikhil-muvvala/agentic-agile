import express from "express";
import { updateMySkills, getMySkills, updateMyProfile } from "../controller/userController.js";
import { validateJsonWebToken } from "../middlewares/validateJsonWebToken.js";

const router = express.Router();

router.put("/me", validateJsonWebToken, updateMyProfile);
router.put("/me/skills", validateJsonWebToken, updateMySkills);
router.get("/me/skills", validateJsonWebToken, getMySkills);

export default router;
