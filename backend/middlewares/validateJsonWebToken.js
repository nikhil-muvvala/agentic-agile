import jwt from "jsonwebtoken";
export const validateJsonWebToken = function (req, res, next) {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
        return res.status(400).json({ message: "Please enter token" });
    }
    try {
        const decoded = jwt.verify(token, process.env.SECRET_KEY, { algorithms: ['HS256'] });
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(400).json({ message: err.message });
    }
}