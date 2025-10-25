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

      // Start cron jobs once the server is up
      import("./utils/cron")
        .then(() => logger.info("⏰ Cron jobs initialized"))
        .catch((err) => logger.error({ err }, "Failed to start cron jobs"));
    });
  } catch (err) {
    logger.error({ err }, "Startup error");
    process.exit(1);
  }
}

main();
