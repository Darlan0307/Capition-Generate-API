import { Request, Response, NextFunction, RequestHandler } from "express";
import { TokenService } from "../services";
import { PrismaUserRepository } from "../repository";
import { User } from "../@types/user";

const PUBLIC_ROUTES = {
  exact: ["/", "/health", "/formats", "/auth/google", "/auth/google/callback"],
};

export function createAuthMiddleware(): RequestHandler {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (PUBLIC_ROUTES.exact.includes(req.path)) {
      next();
      return;
    }

    const tokenService = new TokenService(process.env.JWT_SECRET!);
    const userRepository = new PrismaUserRepository();

    try {
      const token = req.cookies["auth-token"];

      if (!token) {
        res.status(403).json({ errorMessage: "You are not authenticated" });
        return;
      }

      const decoded = tokenService.verifyToken(token);

      if (!decoded) {
        res.status(403).json({ errorMessage: "Invalid token" });
        return;
      }

      req.userId = decoded.userId;

      req.user = (await userRepository.get(req.userId)) as User;

      next();
    } catch (error) {
      res.status(403).json({
        errorMessage: "Error verifying token" + JSON.stringify(error, null, 2),
      });
      return;
    }
  };
}
