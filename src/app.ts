import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { healthRouter } from "./routes/health.route";
import { authRouter } from "./routes/auth.route";
import { paperRouter } from "./routes/paper.route";
import { reviewRouter } from "./routes/review.route";

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.use("/api/health", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/papers", paperRouter);
  app.use("/api/reviews", reviewRouter);

  // 404
  app.use((_req, res) => {
    res.status(404).json({ ok: false, message: "Not Found" });
  });

  return app;
};
