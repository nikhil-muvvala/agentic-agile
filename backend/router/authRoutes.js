import express from "express";
import { validateJsonWebToken } from "../middlewares/validateJsonWebToken.js";
import { currentUser } from "../controller/auth/current-user.js";
import { refreshAccessToken } from "../controller/auth/refreshToken.js";
import { logout } from "../controller/auth/logout.js";
import { googleLogin } from "../controller/auth/googleAuth.js";
import { devLogin } from "../controller/auth/devLogin.js";

const router = express.Router();

router.post("/google", googleLogin);
router.post("/logout", validateJsonWebToken, logout);
router.get("/current-user", validateJsonWebToken, currentUser);
router.post("/refresh-token", refreshAccessToken);
router.post("/dev-login", devLogin);

export default router;