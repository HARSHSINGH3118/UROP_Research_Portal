import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { UserModel } from "../models/user.model";
import { PaperModel } from "../models/paper.model";
import { EventModel } from "../models/event.model";
import { ReviewModel } from "../models/review.model";
import { AssignmentModel } from "../models/assignment.model";
import mongoose from "mongoose";

export const adminRouter = Router();

/* Protect all routes for coordinator/admin */
adminRouter.use(requireAuth(["coordinator", "admin"]));

/* 1️⃣ List all users */
adminRouter.get("/users", async (_req, res) => {
  const users = await UserModel.find().select("-password").sort({ createdAt: -1 });
  res.json({ ok: true, users });
});

/* 2️⃣ List all papers */
adminRouter.get("/papers", async (_req, res) => {
  const papers = await PaperModel.find()
    .populate("publisher", "name email roles")
    .sort({ createdAt: -1 });
  res.json({ ok: true, papers });
});

/* 3️⃣ Approve or reject a paper */
adminRouter.patch("/papers/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // "approved" or "rejected"
  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({ ok: false, message: "Invalid status" });
  }

  const paper = await PaperModel.findByIdAndUpdate(
    id,
    { adminStatus: status },
    { new: true }
  );
  if (!paper) return res.status(404).json({ ok: false, message: "Paper not found" });
  res.json({ ok: true, paper });
});

/* =======================================================================================
 * 4️⃣ Coordinator Stats Dashboard
 * - Overall stats + optional per-event stats (?eventId=...)
 * ======================================================================================= */
adminRouter.get("/stats", async (req, res) => {
  try {
    const { eventId } = req.query as { eventId?: string };

    // Overall summary
    const [totalEvents, totalPapers, totalReviews, totalUsers] = await Promise.all([
      EventModel.countDocuments(),
      PaperModel.countDocuments(),
      ReviewModel.countDocuments(),
      UserModel.countDocuments()
    ]);

    const recentEvents = await EventModel.find().sort({ createdAt: -1 }).limit(5).select("title date");
    const recentPapers = await PaperModel.find()
      .populate("publisher", "name email")
      .populate("eventId", "title")
      .sort({ createdAt: -1 })
      .limit(5)
      .select("title track");

    const response: any = {
      ok: true,
      summary: {
        totalUsers,
        totalEvents,
        totalPapers,
        totalReviews
      },
      recentEvents,
      recentPapers
    };

    // Optional: event-specific stats
    if (eventId && mongoose.isValidObjectId(eventId)) {
      const eventObjId = new mongoose.Types.ObjectId(eventId);
      const [eventExists, paperIds] = await Promise.all([
        EventModel.exists({ _id: eventObjId }),
        PaperModel.find({ eventId: eventObjId }).distinct("_id")
      ]);

      if (eventExists) {
        const [
          eventPaperCount,
          selectedCount,
          rejectedCount,
          pendingCount,
          assignmentCount,
          reviewerDistinct,
          reviewCount,
          trackBreakdown
        ] = await Promise.all([
          PaperModel.countDocuments({ eventId: eventObjId }),
          PaperModel.countDocuments({ eventId: eventObjId, resultStatus: "selected" }),
          PaperModel.countDocuments({ eventId: eventObjId, resultStatus: "rejected" }),
          PaperModel.countDocuments({ eventId: eventObjId, resultStatus: { $in: [null, "submitted"] } }),
          AssignmentModel.countDocuments({ eventId: eventObjId }),
          AssignmentModel.distinct("reviewerId", { eventId: eventObjId }),
          ReviewModel.countDocuments({ paper: { $in: paperIds } }),
          PaperModel.aggregate([
            { $match: { eventId: eventObjId } },
            { $group: { _id: "$track", count: { $sum: 1 } } },
            { $project: { _id: 0, track: "$_id", count: 1 } }
          ])
        ]);

        response.eventStats = {
          eventId,
          papers: {
            total: eventPaperCount,
            selected: selectedCount,
            rejected: rejectedCount,
            pending: pendingCount
          },
          assignments: {
            total: assignmentCount,
            reviewersAssigned: Array.isArray(reviewerDistinct) ? reviewerDistinct.length : 0
          },
          reviews: {
            total: reviewCount
          },
          trackBreakdown
        };
      }
    }

    res.json(response);
  } catch (err: any) {
    res.status(400).json({ ok: false, message: err.message });
  }
});
