import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { UserModel } from "../models/user.model";
import { PaperModel } from "../models/paper.model";

export const adminRouter = Router();

/* ---------- Protect all routes ---------- */
adminRouter.use(requireAuth(["admin"]));

/* ---------- 1️⃣ List all users ---------- */
adminRouter.get("/users", async (_req, res) => {
  const users = await UserModel.find().select("-password").sort({ createdAt: -1 });
  res.json({ ok: true, users });
});

/* ---------- 2️⃣ List all papers ---------- */
adminRouter.get("/papers", async (_req, res) => {
  const papers = await PaperModel.find()
    .populate("publisher", "name email role")
    .sort({ createdAt: -1 });
  res.json({ ok: true, papers });
});

/* ---------- 3️⃣ Approve or reject a paper ---------- */
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
