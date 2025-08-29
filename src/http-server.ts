import express, { Express } from "express";
import cors from "cors";
import { prismaDB } from "./lib";
import { createAuthMiddleware, handleMulterErrors } from "./middlewares";
import { WHISPER_MODEL } from "./configs";
import { isProcessing, routerAuth, routerCaption } from "./routes";
import fs from "fs";
import session from "express-session";
import cookieParser from "cookie-parser";
import passportConfig from "./lib/passport";

export default class HttpServer {
  private app: Express;

  constructor() {
    this.app = express();
  }

  async createApp(): Promise<Express> {
    await prismaDB.$connect();

    this.loadMiddlewares();
    this.loadRoutes();
    return this.app;
  }

  async stop(): Promise<void> {
    await prismaDB.$disconnect();
  }

  private loadMiddlewares(): void {
    this.app.use(
      cors({
        origin: process.env.FRONTEND_URL || "http://localhost:5000",
        credentials: true,
      })
    );

    this.app.use(cookieParser());

    this.app.use(
      session({
        secret: process.env.AUTH_SECRET!,
        resave: false,
        saveUninitialized: false,
        cookie: {
          secure: process.env.NODE_ENV === "production",
          maxAge: 24 * 60 * 60 * 1000,
        },
      })
    );
    this.app.use(passportConfig.initialize());
    this.app.use(passportConfig.session());

    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(createAuthMiddleware());
  }

  private loadRoutes(): void {
    this.app.get("/", (_, res) => {
      res.json({
        message: "API Caption - Gerador de legendas",
      });
    });

    this.app.get("/health", (_, res) => {
      const memUsage = process.memoryUsage();
      res.json({
        ok: true,
        model_loaded: fs.existsSync(WHISPER_MODEL),
        processing: isProcessing,
        memory: {
          rss: Math.round(memUsage.rss / 1024 / 1024) + "MB",
          heap: Math.round(memUsage.heapUsed / 1024 / 1024) + "MB",
          external: Math.round(memUsage.external / 1024 / 1024) + "MB",
        },
      });
    });

    this.app.use(routerAuth);
    this.app.use(routerCaption);
    this.app.use(handleMulterErrors);
  }
}
