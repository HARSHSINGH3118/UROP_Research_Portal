import cron from "node-cron";
import { sendReviewerReminders, sendAcceptedReportToCoordinator } from "../services/report.service";

// Every day at 9:00 AM
cron.schedule("0 9 * * *", async () => {
  console.log("Running daily cron jobs...");
  await sendReviewerReminders();
  await sendAcceptedReportToCoordinator();
  console.log("Daily cron completed");
});
