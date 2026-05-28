import jwt from "jsonwebtoken";
export const webToken = (payload) => {
  return jwt.sign(payload, process.env.SECRET_KEY, {
    expiresIn: "1h"
  });
};

export const generateRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.REFRESH_SECRET_KEY, {
    expiresIn: "7d"
  });
};