import express, { Express } from "express";
import cors from "cors";
import { prismaDB } from "./lib";
import { handleMulterErrors } from "./middlewares";
import { WHISPER_MODEL } from "./configs";
import { isProcessing, routerCaption } from "./routes";
import fs from "fs";
// import session from "express-session";
// import cookieParser from "cookie-parser";
// import passportConfig from "@shared/passport";

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
        origin: process.env.FRONTEND_URL || "http://localhost:4000",
        credentials: true,
      })
    );

    // this.app.use(cookieParser());

    // this.app.use(
    //   session({
    //     secret: process.env.AUTH_SECRET!,
    //     resave: false,
    //     saveUninitialized: false,
    //     cookie: {
    //       secure: process.env.NODE_ENV === "production",
    //       maxAge: 24 * 60 * 60 * 1000,
    //     },
    //   })
    // );
    // this.app.use(passportConfig.initialize());
    // this.app.use(passportConfig.session());

    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(handleMulterErrors);
  }

  private loadRoutes(): void {
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

    this.app.use(routerCaption);
  }
}
