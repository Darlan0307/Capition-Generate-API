import { Request, Response, NextFunction } from "express";
import { logger } from "../lib";

interface ApiError extends Error {
  status?: number;
}

export function errorHandler(
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  logger.error(err);

  const status = err.status || 500;
  const errorMessage = err.message || "Internal server error";

  res.status(status).json({
    success: false,
    errorMessage,
  });
}
