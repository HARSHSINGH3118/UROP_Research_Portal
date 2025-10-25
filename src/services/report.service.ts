import * as XLSX from "xlsx";
import { PaperModel } from "../models/paper.model";
import { ReviewModel } from "../models/review.model";
import { AssignmentModel } from "../models/assignment.model";
import { EventModel } from "../models/event.model";
import { sendMail } from "./mail.service";

export async function generateAcceptedExcel(eventId: string) {
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

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Accepted");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

/* =======================================================================================
 * Reminder logic (used by cron)
 * ======================================================================================= */

export async function sendReviewerReminders() {
  const now = new Date();
  const upcoming = await EventModel.find({
    reviewDeadline: { $gte: now },
  }).select("title date reviewDeadline createdBy");

  for (const event of upcoming) {
    const assignments = await AssignmentModel.find({ eventId: event._id })
      .populate("reviewerId", "name email");

    const reviewed = await ReviewModel.find({
      paper: { $in: assignments.map(a => a.paperId) }
    });

    const reviewedSet = new Set(reviewed.map(r => r.reviewer.toString() + r.paper.toString()));

    const pending = assignments.filter(a => {
      const key = (a.reviewerId as any)?._id?.toString() + a.paperId.toString();
      return !reviewedSet.has(key);
    });

    // Group by reviewer
    const grouped: Record<string, { name: string; email: string; count: number }> = {};
    for (const p of pending) {
      const r: any = p.reviewerId;
      if (!r?._id) continue;
      if (!grouped[r._id]) grouped[r._id] = { name: r.name, email: r.email, count: 0 };
      grouped[r._id].count += 1;
    }

    const deadline = event.reviewDeadline?.toLocaleDateString() ?? "unknown";
    for (const r of Object.values(grouped)) {
      const html = `
        <p>Dear ${r.name},</p>
        <p>You still have <b>${r.count}</b> papers pending review for the event
        <b>${event.title}</b>.</p>
        <p>The review deadline is <b>${deadline}</b>.</p>
        <p>Please complete your reviews at the earliest.</p>
        <p>— Research Coordination Team</p>
      `;
      await sendMail({ to: r.email, subject: `Pending Reviews Reminder — ${event.title}`, html });
    }
  }
}

export async function sendAcceptedReportToCoordinator() {
  const events = await EventModel.find().select("title createdBy date");
  for (const event of events) {
    const acceptedCount = await PaperModel.countDocuments({ eventId: event._id, resultStatus: "selected" });
    if (acceptedCount === 0) continue;

    const buffer = await generateAcceptedExcel(event._id.toString());
    const html = `
      <p>Hello Coordinator,</p>
      <p>Attached is the latest accepted paper list for <b>${event.title}</b>.</p>
    `;
    await sendMail({
      to: process.env.COORDINATOR_EMAIL || "coordinator@example.com",
      subject: `Accepted Papers Report — ${event.title}`,
      html,
      attachments: [{ filename: `${event.title}-accepted.xlsx`, content: buffer }]
    });
  }
}
