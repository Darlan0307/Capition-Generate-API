import { Router } from "express";
import passportConfig from "../lib/passport";
import { TokenService } from "../services";

export const routerAuth = Router();

const frontendUrl = process.env.FRONTEND_URL || "http://localhost:4000";

const tokenService = new TokenService(process.env.JWT_SECRET!);

routerAuth.get(
  "/auth/google",
  passportConfig.authenticate("google", { scope: ["profile", "email"] })
);

routerAuth.get(
  "/auth/google/callback",
  passportConfig.authenticate("google", {
    failureRedirect: `${frontendUrl}/`,
  }),
  async (req, res) => {
    try {
      const token = tokenService.generateAccessToken(req?.user?.id ?? "");

      res.cookie("auth-token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax", // Proteção CSRF
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/",
      });

      res.redirect(`${frontendUrl}/auth/me`);
    } catch (error) {
      console.error("Erro ao gerar token Google:", error);
      res.redirect(`${frontendUrl}/`);
    }
  }
);

routerAuth.get("/auth/logout", (req, res) => {
  res.clearCookie("auth-token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  req.logout((err) => {
    if (err) {
      return res.status(500).json({ errorMessage: "Logout error" });
    }
    res.status(200).json({ message: "Successful logout" });
  });
});

routerAuth.get("/auth/me", async (req, res) => {
  res.status(200).json(req.user);
});
