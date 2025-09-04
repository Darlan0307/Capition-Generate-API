import { Router } from "express";
import passportConfig from "../lib/passport";
import { TokenService } from "../services";

export const routerAuth = Router();

const frontendUrl = process.env.FRONTEND_URL || "http://localhost:8080";

const tokenService = new TokenService(process.env.JWT_SECRET!);

function getCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? ("none" as const) : ("lax" as const),
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
    path: "/",
  };
}

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

      res.cookie("auth-token", token, getCookieOptions());

      res.redirect(`${frontendUrl}/`);
    } catch (error) {
      console.error("Erro ao gerar token Google:", error);
      res.redirect(`${frontendUrl}/`);
    }
  }
);

routerAuth.get("/auth/logout", (req, res) => {
  res.clearCookie("auth-token", getCookieOptions());

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
