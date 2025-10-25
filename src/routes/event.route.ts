import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import mongoose from "mongoose";
import * as XLSX from "xlsx"; // ← NEW (for Excel export)

import { requireAuth } from "../middlewares/auth.middleware";
import { EventModel } from "../models/event.model";
import { PaperModel } from "../models/paper.model";
import { AssignmentModel } from "../models/assignment.model";
import { ReviewModel } from "../models/review.model";
import { enqueueInsightJob } from "../services/insight.service";
import { UserModel } from "../models/user.model";

export const eventRouter = Router();

/* =======================================================================================
 * Storage setup
 * ======================================================================================= */
const EVENTS_DIR = path.join(process.cwd(), "src", "uploads", "events");
if (!fs.existsSync(EVENTS_DIR)) fs.mkdirSync(EVENTS_DIR, { recursive: true });

const BANNERS_STORAGE = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, EVENTS_DIR),
  filename: (_req, file, cb) =>
    cb(null, Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname))
});
const uploadBanner = multer({ storage: BANNERS_STORAGE });

const PAPERS_DIR = path.join(process.cwd(), "src", "uploads");
if (!fs.existsSync(PAPERS_DIR)) fs.mkdirSync(PAPERS_DIR, { recursive: true });

const PAPERS_STORAGE = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, PAPERS_DIR),
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const allowedPaperExt = new Set([".pdf", ".docx", ".doc", ".txt"]);
const uploadPaper = multer({
  storage: PAPERS_STORAGE,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedPaperExt.has(ext)) return cb(null, true);
    cb(new Error("Invalid file type. Allowed: PDF/DOCX/DOC/TXT"));
  }
});

/* =======================================================================================
 * Coordinator: Create / List / Delete events
 * ======================================================================================= */

// Create event (Coordinator) — supports optional reviewDeadline
eventRouter.post(
  "/create",
  requireAuth(["coordinator"]),
  uploadBanner.single("banner"),
  async (req, res) => {
    try {
      const { title, description, date, reviewDeadline } = req.body;
      if (!title || !description || !date) {
        return res.status(400).json({ ok: false, message: "Missing title/description/date" });
      }

      const event = await EventModel.create({
        title,
        description,
        date,
        reviewDeadline, // ← NEW (optional)
        bannerUrl: req.file?.path,
        createdBy: (req as any).user.userId
      });

      res.status(201).json({ ok: true, event });
    } catch (err: any) {
      res.status(400).json({ ok: false, message: err.message });
    }
  }
);

// List all events (public)
eventRouter.get("/", async (_req, res) => {
  const events = await EventModel.find().sort({ date: 1 });
  res.json({ ok: true, events });
});

// Delete event (Coordinator)
eventRouter.delete("/:eventId", requireAuth(["coordinator"]), async (req, res) => {
  await EventModel.findByIdAndDelete(req.params.eventId);
  res.json({ ok: true });
});

/* =======================================================================================
 * Author: Submit paper to specific event & list own papers for that event
 * ======================================================================================= */

// Submit paper under an event
// POST /api/events/:eventId/submit  (multipart/form-data)
eventRouter.post(
  "/:eventId/submit",
  requireAuth(["author"]),
  uploadPaper.single("file"),
  async (req, res) => {
    try {
      const { eventId } = req.params;
      const { title, track } = req.body;

      if (!req.file) return res.status(400).json({ ok: false, message: "No file" });
      if (!title || !track) {
        return res.status(400).json({ ok: false, message: "Missing title/track" });
      }

      // Ensure event exists
      const event = await EventModel.findById(eventId);
      if (!event) return res.status(404).json({ ok: false, message: "Event not found" });

      // Create paper linked to event
      const paper = await PaperModel.create({
        title,
        track,
        fileUrl: req.file.path,
        publisher: (req as any).user.userId,
        eventId
      });

      // Trigger AI insights (non-blocking)
      enqueueInsightJob(paper._id.toString(), paper.fileUrl).catch(() => {});

      res.status(201).json({ ok: true, paper });
    } catch (err: any) {
      res.status(400).json({ ok: false, message: err.message });
    }
  }
);

// Get current author's papers for an event
// GET /api/events/:eventId/my-papers
eventRouter.get("/:eventId/my-papers", requireAuth(["author"]), async (req, res) => {
  const { eventId } = req.params;
  const authorId = (req as any).user.userId;

  const papers = await PaperModel.find({ eventId, publisher: authorId })
    .populate("eventId", "title date reviewDeadline") // ← include reviewDeadline
    .sort({ createdAt: -1 });

  res.json({ ok: true, papers });
});

/* =======================================================================================
 * Coordinator: Assign event papers to reviewers
 * ======================================================================================= */

// Assign specific papers to a reviewer for this event
// POST /api/events/:eventId/assign
// Body: { reviewerId: string, paperIds: string[] }
eventRouter.post("/:eventId/assign", requireAuth(["coordinator"]), async (req, res) => {
  try {
    const { eventId } = req.params;
    const { reviewerId, paperIds } = req.body as { reviewerId: string; paperIds: string[] };

    if (!reviewerId || !Array.isArray(paperIds) || paperIds.length === 0) {
      return res.status(400).json({ ok: false, message: "Missing reviewerId/paperIds" });
    }
    if (!mongoose.isValidObjectId(reviewerId)) {
      return res.status(400).json({ ok: false, message: "Invalid reviewerId" });
    }

    // Validate event
    const event = await EventModel.findById(eventId);
    if (!event) return res.status(404).json({ ok: false, message: "Event not found" });

    // Validate reviewer exists
    const reviewer = await UserModel.findById(reviewerId).select("roles name email");
    if (!reviewer) return res.status(404).json({ ok: false, message: "Reviewer not found" });

    // Validate that all papers belong to this event
    const count = await PaperModel.countDocuments({ _id: { $in: paperIds }, eventId });
    if (count !== paperIds.length) {
      return res.status(400).json({ ok: false, message: "One or more papers do not belong to this event" });
    }

    // Create assignments (ignore duplicates due to unique index)
    let created = 0, skipped = 0;
    for (const pid of paperIds) {
      try {
        await AssignmentModel.create({
          eventId: new mongoose.Types.ObjectId(eventId),
          paperId: new mongoose.Types.ObjectId(pid),
          reviewerId: new mongoose.Types.ObjectId(reviewerId),
          assignedBy: new mongoose.Types.ObjectId((req as any).user.userId)
        });
        created += 1;
      } catch {
        skipped += 1; // E11000 duplicate key
      }
    }

    res.status(201).json({ ok: true, created, skipped });
  } catch (err: any) {
    res.status(400).json({ ok: false, message: err.message });
  }
});

// Coordinator view assignments for an event (by reviewer)
// GET /api/events/:eventId/assignments?reviewerId=...
eventRouter.get("/:eventId/assignments", requireAuth(["coordinator"]), async (req, res) => {
  const { eventId } = req.params;
  const { reviewerId } = req.query as { reviewerId?: string };

  const filter: any = { eventId };
  if (reviewerId) filter.reviewerId = reviewerId;

  const assigns = await AssignmentModel.find(filter)
    .populate("paperId")
    .populate("reviewerId", "name email roles")
    .sort({ createdAt: -1 });

  res.json({ ok: true, assignments: assigns });
});

/* =======================================================================================
 * Reviewer: See assigned papers for an event (+progress counts)
 * ======================================================================================= */

// GET /api/events/:eventId/assigned
// Returns: assigned papers + progress { totalAssigned, reviewedCount, pendingCount }
eventRouter.get("/:eventId/assigned", requireAuth(["reviewer"]), async (req, res) => {
  const { eventId } = req.params;
  const reviewerId = (req as any).user.userId;

  const assignments = await AssignmentModel.find({ eventId, reviewerId })
    .populate({
      path: "paperId",
      populate: [
        { path: "publisher", select: "name email roles" },
        { path: "eventId", select: "title date reviewDeadline" } // ← include reviewDeadline
      ]
    })
    .sort({ createdAt: -1 });

  const paperIds = assignments.map(a => (a.paperId as any)?._id).filter(Boolean) as any[];

  const reviews = await ReviewModel.find({
    reviewer: reviewerId,
    paper: { $in: paperIds }
  }).select("paper");

  const reviewedSet = new Set(reviews.map(r => r.paper.toString()));

  const items = assignments.map(a => {
    const paper: any = a.paperId;
    return {
      assignmentId: a._id,
      paperId: paper?._id,
      title: paper?.title,
      track: paper?.track,
      fileUrl: paper?.fileUrl,
      insights: paper?.insights ?? [],
      publisher: paper?.publisher,    // { name, email, roles }
      event: paper?.eventId,          // { title, date, reviewDeadline }
      assignedAt: a.assignedAt,
      reviewed: paper ? reviewedSet.has(paper._id.toString()) : false
    };
  });

  const totalAssigned = items.length;
  const reviewedCount = items.filter(i => i.reviewed).length;
  const pendingCount = totalAssigned - reviewedCount;

  res.json({
    ok: true,
    summary: { totalAssigned, reviewedCount, pendingCount },
    items
  });
});

/* =======================================================================================
 * Reviewer: Create/Update review comments for an assigned paper in an event
 * ======================================================================================= */

// POST /api/events/:eventId/reviews/:paperId
// Body: { comments: string, insights?: string[] }
eventRouter.post("/:eventId/reviews/:paperId", requireAuth(["reviewer"]), async (req, res) => {
  try {
    const { eventId, paperId } = req.params;
    const reviewerId = (req as any).user.userId;
    const { comments, insights } = req.body;

    if (!comments) return res.status(400).json({ ok: false, message: "comments required" });

    // Ensure paper belongs to this event
    const paper = await PaperModel.findOne({ _id: paperId, eventId });
    if (!paper) return res.status(404).json({ ok: false, message: "Paper not found in this event" });

    // Ensure reviewer is assigned to this paper for this event
    const assigned = await AssignmentModel.findOne({ eventId, paperId, reviewerId });
    if (!assigned) return res.status(403).json({ ok: false, message: "Not assigned to this paper" });

    // Upsert one review per (paper, reviewer)
    const review = await ReviewModel.findOneAndUpdate(
      { paper: paperId, reviewer: reviewerId },
      {
        $set: {
          comments,
          insights: Array.isArray(insights) ? insights : []
        }
      },
      { new: true, upsert: true }
    );

    res.status(201).json({ ok: true, review });
  } catch (err: any) {
    res.status(400).json({ ok: false, message: err.message });
  }
});

/* =======================================================================================
 * Reviewer/Coordinator: Set paper result (selected / rejected)
 * ======================================================================================= */

// PATCH /api/events/:eventId/papers/:paperId/decision
// Body: { resultStatus: "selected" | "rejected" }
eventRouter.patch("/:eventId/papers/:paperId/decision", requireAuth(["reviewer", "coordinator"]), async (req, res) => {
  try {
    const { eventId, paperId } = req.params;
    const { resultStatus } = req.body as { resultStatus: "selected" | "rejected" };
    const user = (req as any).user as { userId: string; roles: string[] };

    if (!["selected", "rejected"].includes(resultStatus)) {
      return res.status(400).json({ ok: false, message: "Invalid resultStatus" });
    }

    // Ensure paper belongs to event
    const paper = await PaperModel.findOne({ _id: paperId, eventId });
    if (!paper) return res.status(404).json({ ok: false, message: "Paper not found in this event" });

    // If reviewer (not coordinator), enforce assignment
    const isCoordinator = Array.isArray(user.roles) && user.roles.includes("coordinator");
    if (!isCoordinator) {
      const assigned = await AssignmentModel.findOne({ eventId, paperId, reviewerId: user.userId });
      if (!assigned) return res.status(403).json({ ok: false, message: "Not assigned to this paper" });
    }

    // Update paper.resultStatus
    const updated = await PaperModel.findByIdAndUpdate(
      paperId,
      { resultStatus },
      { new: true }
    )
      .populate("publisher", "name email roles")
      .populate("eventId", "title date reviewDeadline"); // ← include reviewDeadline

    // Also persist decision on the review row for traceability (upsert)
    if (!isCoordinator) {
      await ReviewModel.findOneAndUpdate(
        { paper: paperId, reviewer: user.userId },
        { $set: { decision: resultStatus } },
        { upsert: true, new: true }
      );
    }

    res.json({ ok: true, paper: updated });
  } catch (err: any) {
    res.status(400).json({ ok: false, message: err.message });
  }
});

/* =======================================================================================
 * Phase 4 additions:
 * - Accepted preview (JSON) and export (.xlsx)
 * - Reminders preview per reviewer (no emails here)
 * ======================================================================================= */

// Accepted list (JSON) — fields: reviewerName, track, authorEmail, contactNumber
eventRouter.get("/:eventId/accepted", requireAuth(["coordinator"]), async (req, res) => {
  const { eventId } = req.params;

  const papers = await PaperModel.find({ eventId, resultStatus: "selected" })
    .select("track publisher title")
    .populate("publisher", "name email contactNumber");

  const paperIds = papers.map(p => p._id);
  const reviews = await ReviewModel.find({ paper: { $in: paperIds }, decision: "selected" })
    .populate("reviewer", "name email")
    .sort({ updatedAt: -1 });

  const latestByPaper: Record<string, any> = {};
  for (const r of reviews) {
    const k = r.paper.toString();
    if (!latestByPaper[k]) latestByPaper[k] = r;
  }

  const rows = papers.map(p => {
    const rr = latestByPaper[p._id.toString()];
    const reviewerName = rr?.reviewer ? rr.reviewer.name : "Coordinator override";
    const author: any = p.publisher;
    return {
      reviewerName,
      track: p.track,
      authorEmail: author?.email ?? "",
      contactNumber: author?.contactNumber ?? ""
    };
  });

  res.json({ ok: true, count: rows.length, rows });
});

// Accepted export (Excel)
eventRouter.get("/:eventId/accepted.xlsx", requireAuth(["coordinator"]), async (req, res) => {
  const { eventId } = req.params;

  const papers = await PaperModel.find({ eventId, resultStatus: "selected" })
    .select("track publisher title")
    .populate("publisher", "name email contactNumber");

  const paperIds = papers.map(p => p._id);
  const reviews = await ReviewModel.find({ paper: { $in: paperIds }, decision: "selected" })
    .populate("reviewer", "name email")
    .sort({ updatedAt: -1 });

  const latestByPaper: Record<string, any> = {};
  for (const r of reviews) {
    const k = r.paper.toString();
    if (!latestByPaper[k]) latestByPaper[k] = r;
  }

  const rows = papers.map(p => {
    const rr = latestByPaper[p._id.toString()];
    const reviewerName = rr?.reviewer ? rr.reviewer.name : "Coordinator override";
    const author: any = p.publisher;
    return {
      reviewerName,
      track: p.track,
      authorEmail: author?.email ?? "",
      contactNumber: author?.contactNumber ?? ""
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows, {
    header: ["reviewerName", "track", "authorEmail", "contactNumber"]
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Accepted");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="accepted-${eventId}.xlsx"`);
  return res.status(200).send(buffer);
});

// Reminders preview (who is pending reviews)
eventRouter.get("/:eventId/reviewers/pending", requireAuth(["coordinator"]), async (req, res) => {
  const { eventId } = req.params;

  const event = await EventModel.findById(eventId).select("title date reviewDeadline");
  if (!event) return res.status(404).json({ ok: false, message: "Event not found" });

  const assigns = await AssignmentModel.find({ eventId })
    .populate("reviewerId", "name email")
    .select("reviewerId paperId");

  // Map reviewer -> assigned papers
  const map = new Map<string, { reviewer: any; papers: string[] }>();
  for (const a of assigns) {
    const rid = (a.reviewerId as any)?._id?.toString();
    if (!rid) continue;
    const entry = map.get(rid) || { reviewer: a.reviewerId, papers: [] };
    entry.papers.push((a.paperId as any).toString());
    map.set(rid, entry);
  }

  const allPaperIds = Array.from(new Set(assigns.map(a => a.paperId.toString())));
  const allReviewerIds = Array.from(map.keys()).map(id => new mongoose.Types.ObjectId(id));

  const reviews = await ReviewModel.find({
    reviewer: { $in: allReviewerIds },
    paper: { $in: allPaperIds }
  }).select("paper reviewer");

  const reviewedByReviewer = new Map<string, Set<string>>();
  for (const r of reviews) {
    const rid = r.reviewer.toString();
    const set = reviewedByReviewer.get(rid) || new Set<string>();
    set.add(r.paper.toString());
    reviewedByReviewer.set(rid, set);
  }

  const items = Array.from(map.values()).map(v => {
    const rid = (v.reviewer as any)._id.toString();
    const reviewedSet = reviewedByReviewer.get(rid) || new Set<string>();
    const totalAssigned = v.papers.length;
    const reviewedCount = v.papers.filter(p => reviewedSet.has(p)).length;
    const pendingCount = totalAssigned - reviewedCount;
    return {
      reviewerId: rid,
      reviewerName: (v.reviewer as any).name,
      reviewerEmail: (v.reviewer as any).email,
      totalAssigned,
      reviewedCount,
      pendingCount
    };
  });

  const summary = {
    totalReviewers: items.length,
    totalAssigned: items.reduce((s, i) => s + i.totalAssigned, 0),
    totalReviewed: items.reduce((s, i) => s + i.reviewedCount, 0),
    totalPending: items.reduce((s, i) => s + i.pendingCount, 0)
  };

  const deadlineDaysLeft =
    event.reviewDeadline ? Math.ceil((new Date(event.reviewDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  res.json({
    ok: true,
    event: { title: event.title, date: event.date, reviewDeadline: event.reviewDeadline, deadlineDaysLeft },
    summary,
    items
  });
});
