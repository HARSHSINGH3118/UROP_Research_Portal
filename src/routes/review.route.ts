import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { ReviewModel } from "../models/review.model";

export const reviewRouter = Router();

// Reviewer posts a review
reviewRouter.post("/:paperId", requireAuth(["reviewer"]), async (req, res) => {
  try {
    const { paperId } = req.params;
    const { comments, insights } = req.body;

    const review = await ReviewModel.create({
      paper: paperId,
      reviewer: (req as any).user.userId,
      comments,
      insights
    });

    res.status(201).json({ ok: true, review });
  } catch (err: any) {
    res.status(400).json({ ok: false, message: err.message });
  }
});

// Get reviews for a paper
reviewRouter.get("/:paperId", requireAuth(), async (req, res) => {
  const { paperId } = req.params;
  const reviews = await ReviewModel.find({ paper: paperId }).populate("reviewer", "name email");
  res.json({ ok: true, reviews });
});
