// src/services/insight.service.ts
import fs from "fs";
import path from "path";
import PDFParser from "pdf2json";
import OpenAI from "openai";
import { PaperModel } from "../models/paper.model";
import { logger } from "../lib/logger";
import { env } from "../config/env";

/**
 * Extracts plain text from a PDF file using pdf2json.
 * Safe for Node (no DOM dependencies).
 */
async function extractTextFromPDF(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const pdfParser = new PDFParser();

      pdfParser.on("pdfParser_dataError", (err) => reject(err.parserError));
      pdfParser.on("pdfParser_dataReady", (pdfData) => {
        const texts = pdfData.Pages.flatMap((page: any) =>
          page.Texts.map((t: any) =>
            decodeURIComponent(t.R.map((r: any) => r.T).join(""))
          )
        );
        resolve(texts.join(" ").slice(0, 6000)); // limit ~6 KB
      });

      pdfParser.loadPDF(filePath);
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Background-like async job for generating AI insights from uploaded papers.
 * Works without Redis; uses GPT-4o-mini via OpenAI API.
 */
export async function enqueueInsightJob(paperId: string, fileUrl: string) {
  try {
    // mark paper as processing
    await PaperModel.findByIdAndUpdate(paperId, { status: "processing" }).catch(() => {});
    const absolutePath = path.isAbsolute(fileUrl) ? fileUrl : path.resolve(process.cwd(), fileUrl);

    // delay slightly so the upload response returns immediately
    setTimeout(async () => {
      const client = new OpenAI({ apiKey: env.openaiKey });

      try {
        // 🔹 extract readable text
        let extractedText = "";
        if (absolutePath.toLowerCase().endsWith(".pdf")) {
          extractedText = await extractTextFromPDF(absolutePath);
        } else {
          const buffer = fs.readFileSync(absolutePath);
          extractedText = buffer.toString("utf8").slice(0, 6000);
        }

        // 🔹 generate insights with GPT-4o-mini
        const prompt =
          "Read the following research paper text and provide 3–5 concise bullet-point insights summarizing its ideas and methods.";

        const completion = await client.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: prompt },
            { role: "user", content: extractedText }
          ],
          max_tokens: 300,
          temperature: 0.4
        });

        const summaryText = completion.choices[0].message.content || "";
        const insights = summaryText
          .split(/\n|•|-/)
          .map((l) => l.trim())
          .filter(Boolean);

        // 🔹 store insights in MongoDB
        await PaperModel.findByIdAndUpdate(
          paperId,
          { insights, status: "reviewed" },
          { new: true }
        );

        logger.info({ paperId }, "AI insights generated successfully");
      } catch (err) {
        logger.error({ err, paperId }, "AI insight generation failed");
        await PaperModel.findByIdAndUpdate(paperId, { status: "submitted" }).catch(() => {});
      }
    }, 200);
  } catch (err) {
    logger.warn({ err, paperId }, "enqueueInsightJob failed early");
  }
}
