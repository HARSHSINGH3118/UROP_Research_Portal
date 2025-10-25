import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { AssignmentModel } from "../models/assignment.model";
import { sendReviewerReminders, sendAcceptedReportToCoordinator, generateAcceptedExcel } from "../services/report.service";
import fs from "fs";

export const debugRouter = Router();

/* =======================================================================================
 * 1️⃣ Existing: Coordinator/admin can view all reviewer-paper assignments
 * ======================================================================================= */
debugRouter.get("/assignments", requireAuth(["coordinator", "admin"]), async (_req, res) => {
  try {
    const assignments = await AssignmentModel.find()
      .populate("eventId", "title")
      .populate("paperId", "title")
      .populate("reviewerId", "name email roles")
      .sort({ createdAt: -1 });

    res.json({ ok: true, count: assignments.length, assignments });
  } catch (err: any) {
    res.status(400).json({ ok: false, message: err.message });
  }
});

/* =======================================================================================
 * 2️⃣ New: Manual mail testing routes
 * ======================================================================================= */

// 🔹 Trigger reviewer reminder emails manually
debugRouter.post("/mail/reminders", requireAuth(["coordinator", "admin"]), async (_req, res) => {
  try {
    await sendReviewerReminders();
    res.json({ ok: true, message: "Reviewer reminder mails triggered successfully" });
  } catch (err: any) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// 🔹 Trigger accepted paper report mail manually
debugRouter.post("/mail/report", requireAuth(["coordinator", "admin"]), async (_req, res) => {
  try {
    await sendAcceptedReportToCoordinator();
    res.json({ ok: true, message: "Accepted report mail sent successfully" });
  } catch (err: any) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// 🔹 Generate accepted papers Excel (for debugging)
debugRouter.get("/accepted/:eventId", requireAuth(["coordinator", "admin"]), async (req, res) => {
  try {
    const { eventId } = req.params;
    const buffer = await generateAcceptedExcel(eventId);
    const filePath = `Accepted-${eventId}.xlsx`;

    fs.writeFileSync(filePath, buffer);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=${filePath}`);
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

/* =======================================================================================
 * 3️⃣ Existing: whoami test
 * ======================================================================================= */
debugRouter.get("/whoami", requireAuth(), (req, res) => {
  res.json({ ok: true, user: (req as any).user });
});
