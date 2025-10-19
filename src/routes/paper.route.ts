// src/routes/paper.route.ts
import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { requireAuth } from "../middlewares/auth.middleware";
import { PaperModel } from "../models/paper.model";
import { enqueueInsightJob } from "../services/insight.service";
import { logger } from "../lib/logger";

export const paperRouter = Router();

/* ---------- uploads setup (local disk) ---------- */
const UPLOAD_DIR = path.join(process.cwd(), "src", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const allowed = new Set([".pdf", ".docx", ".doc", ".txt"]);
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.has(ext)) return cb(null, true);
    cb(new Error("Invalid file type. Allowed: PDF/DOCX/DOC/TXT"));
  }
});

/* ---------- Publisher uploads a paper ---------- */
paperRouter.post(
  "/upload",
  requireAuth(["publisher"]),
  upload.single("file"),
  async (req, res) => {
    try {
      const { title, track } = req.body;
      if (!req.file) return res.status(400).json({ ok: false, message: "No file" });
      if (!title || !track) return res.status(400).json({ ok: false, message: "Missing title/track" });

      const paper = await PaperModel.create({
        title,
        track,
        fileUrl: req.file.path,
        publisher: (req as any).user.userId
      });

      // fire-and-forget insights (don’t block response)
      enqueueInsightJob(paper._id.toString(), paper.fileUrl).catch((e) => {
        logger?.warn?.({ err: e, paperId: paper._id }, "enqueueInsightJob failed");
      });

      return res.status(201).json({ ok: true, paper });
    } catch (err: any) {
      return res.status(400).json({ ok: false, message: err.message || "Upload failed" });
    }
  }
);

/* ---------- Publisher: see their own papers ---------- */
paperRouter.get("/my", requireAuth(["publisher"]), async (req, res) => {
  const papers = await PaperModel.find({ publisher: (req as any).user.userId }).sort({ createdAt: -1 });
  return res.json({ ok: true, papers });
});

/* ---------- Reviewer: list by track ---------- */
/* Tip: if your track contains '/', call with AI%2FML (URL-encoded) */
paperRouter.get("/track/:track", requireAuth(["reviewer"]), async (req, res) => {
  const track = decodeURIComponent(req.params.track);
  const papers = await PaperModel.find({ track }).sort({ createdAt: -1 });
  return res.json({ ok: true, papers });
});
