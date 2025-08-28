import { NextFunction, Request, Response } from "express";
import multer from "multer";

export const handleMulterErrors = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({
        errorMessage: "O arquivo excede o limite de tamanho permitido.",
      });
      return;
    }
    res.status(400).json({ errorMessage: err.message });
    return;
  }
  res.status(500).json({ errorMessage: "Erro interno no sistema." });
  return;
};
