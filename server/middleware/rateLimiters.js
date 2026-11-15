import { rateLimit } from "express-rate-limit";

// SIRF automated tests ke liye: server ko DISABLE_RATE_LIMIT=true ke saath chalao.
// Production me ye kabhi set nahi karna.
const skip = () => process.env.DISABLE_RATE_LIMIT === "true";

// login, register, password reset: brute force rokne ke liye
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true, // sirf failed attempts gine jayenge
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { message: "Too many attempts. Please try again later." },
});

// poori API ke liye
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { message: "Too many requests. Please slow down." },
});