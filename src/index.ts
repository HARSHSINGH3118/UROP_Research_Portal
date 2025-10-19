import mongoose from "mongoose";
import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./lib/logger";

async function main() {
  try {
    await mongoose.connect(env.mongoUri);
    logger.info("MongoDB connected");

    const app = createApp();
    app.listen(env.port, () => {
      logger.info(`Server listening on http://localhost:${env.port}`);
    });
  } catch (err) {
    logger.error({ err }, "Startup error");
    process.exit(1);
  }
}

main();
