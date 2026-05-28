import express from "express";
import { register } from "../controller/auth/register.js";
import { login } from "../controller/auth/login.js";
import { validateJsonWebToken } from "../middlewares/validateJsonWebToken.js";
import { currentUser } from "../controller/auth/current-user.js";
import { changePassword } from "../controller/auth/change-password.js";
import { refreshAccessToken } from "../controller/auth/refreshToken.js";
import { logout } from "../controller/auth/logout.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", validateJsonWebToken, logout);
router.get("/current-user", validateJsonWebToken, currentUser);
router.patch("/change-password", validateJsonWebToken, changePassword);
router.post("/refresh-token", refreshAccessToken);

export default router;