import rateLimit from "express-rate-limit";

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    errorMessage:
      "Too many requests from this IP address, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
