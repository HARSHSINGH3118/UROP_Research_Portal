import { Router } from "express";
import multer from "multer";
import path from "path";
import { requireAuth } from "../middlewares/auth.middleware";
import { EventModel } from "../models/event.model";

export const eventRouter = Router();
const storage = multer.diskStorage({
  destination: "src/uploads/events",
  filename: (_req, file, cb) =>
    cb(null, Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname))
});
const upload = multer({ storage });

/* Admin or Publisher creates event */
eventRouter.post(
  "/create",
  requireAuth(["admin", "publisher"]),
  upload.single("banner"),
  async (req, res) => {
    try {
      const { title, description, date } = req.body;
      const event = await EventModel.create({
        title,
        description,
        date,
        bannerUrl: req.file?.path,
        createdBy: (req as any).user.userId
      });
      res.status(201).json({ ok: true, event });
    } catch (err: any) {
      res.status(400).json({ ok: false, message: err.message });
    }
  }
);

/* Anyone can see all events */
eventRouter.get("/", async (_req, res) => {
  const events = await EventModel.find().sort({ date: 1 });
  res.json({ ok: true, events });
});

/* Admin can delete event */
eventRouter.delete("/:id", requireAuth(["admin"]), async (req, res) => {
  await EventModel.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});
