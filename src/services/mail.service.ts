import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,     // your Gmail address
    pass: process.env.MAIL_PASS      // app-specific password
  }
});

export async function sendMail({
  to,
  subject,
  html,
  attachments
}: {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer }[];
}) {
  try {
    await transporter.sendMail({
      from: `"Research Portal" <${process.env.MAIL_USER}>`,
      to,
      subject,
      html,
      attachments
    });
    console.log(` Mail sent → ${to}`);
    return true;
  } catch (err) {
    console.error(" Mail error:", err);
    return false;
  }
}
