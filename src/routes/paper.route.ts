import { Router } from "express";
import multer from "multer";
import path from "path";
import { requireAuth } from "../middlewares/auth.middleware";
import { PaperModel } from "../models/paper.model";

export const paperRouter = Router();

// setup multer (local disk)
const storage = multer.diskStorage({
  destination: "src/uploads",
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Publisher uploads a paper
paperRouter.post(
  "/upload",
  requireAuth(["publisher"]),
  upload.single("file"),
  async (req, res) => {
    try {
      const { title, track } = req.body;
      if (!req.file) return res.status(400).json({ ok: false, message: "No file" });

      const paper = await PaperModel.create({
        title,
        track,
        fileUrl: req.file.path,
        publisher: (req as any).user.userId
      });

      res.status(201).json({ ok: true, paper });
    } catch (err: any) {
      res.status(400).json({ ok: false, message: err.message });
    }
  }
);

// Publisher sees their papers
paperRouter.get("/my", requireAuth(["publisher"]), async (req, res) => {
  const papers = await PaperModel.find({ publisher: (req as any).user.userId });
  res.json({ ok: true, papers });
});

// Reviewer: list by track
paperRouter.get("/track/:track", requireAuth(["reviewer"]), async (req, res) => {
  const { track } = req.params;
  const papers = await PaperModel.find({ track });
  res.json({ ok: true, papers });
});
