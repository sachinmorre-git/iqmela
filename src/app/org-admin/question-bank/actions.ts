"use server";

import { prisma } from "@/lib/prisma";
import { getCallerPermissions } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";

// ── Types ────────────────────────────────────────────────────────────────────

export type QuestionType = "CODING" | "PLAIN_TEXT" | "MCQ_SINGLE" | "MCQ_MULTI" | "FILE_BASED";

export interface McqOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface QuestionFormData {
  type: QuestionType;
  title: string;
  description: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  category?: string;
  tags?: string[];
  // Coding
  language?: string;
  starterCode?: string;
  sampleInput?: string;
  expectedOutput?: string;
  // MCQ
  options?: McqOption[];
  explanation?: string;
  // File-based (handled separately via FormData)
}

// ── List Questions ───────────────────────────────────────────────────────────

export async function listQuestionsAction(filters?: {
  type?: string;
  difficulty?: string;
  category?: string;
  search?: string;
}) {
  const perms = await getCallerPermissions();
  if (!perms?.orgId) return { success: false as const, error: "Unauthorized" };

  const where: any = { organizationId: perms.orgId };
  if (filters?.type) where.type = filters.type;
  if (filters?.difficulty) where.difficulty = filters.difficulty;
  if (filters?.category) where.category = filters.category;
  if (filters?.search) {
    where.OR = [
      { title: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const questions = await prisma.interviewQuestion.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true, type: true, title: true, difficulty: true,
      category: true, tags: true, usageCount: true, createdAt: true,
      isFromSeedBank: true, language: true, attachmentName: true,
      options: true,
    },
  });

  return { success: true as const, data: questions };
}

// ── Create Question ──────────────────────────────────────────────────────────

export async function createQuestionAction(data: QuestionFormData) {
  const perms = await getCallerPermissions();
  if (!perms?.orgId || !perms.userId) return { success: false as const, error: "Unauthorized" };
  if (!data.title.trim()) return { success: false as const, error: "Title is required" };
  if (!data.description.trim()) return { success: false as const, error: "Description is required" };

  // MCQ validation
  if ((data.type === "MCQ_SINGLE" || data.type === "MCQ_MULTI") && (!data.options || data.options.length < 2)) {
    return { success: false as const, error: "MCQ questions need at least 2 options" };
  }
  if (data.type === "MCQ_SINGLE" && data.options && data.options.filter(o => o.isCorrect).length !== 1) {
    return { success: false as const, error: "Single-choice MCQ must have exactly 1 correct answer" };
  }
  if (data.type === "MCQ_MULTI" && data.options && data.options.filter(o => o.isCorrect).length < 1) {
    return { success: false as const, error: "Multi-choice MCQ must have at least 1 correct answer" };
  }

  const question = await prisma.interviewQuestion.create({
    data: {
      organizationId: perms.orgId,
      createdById: perms.userId,
      type: data.type,
      title: data.title.trim(),
      description: data.description.trim(),
      difficulty: data.difficulty,
      category: data.category?.trim() || null,
      tags: data.tags || [],
      language: data.language || null,
      starterCode: data.starterCode || null,
      sampleInput: data.sampleInput || null,
      expectedOutput: data.expectedOutput || null,
      options: data.options ? JSON.parse(JSON.stringify(data.options)) : undefined,
      explanation: data.explanation || null,
    },
  });

  revalidatePath("/org-admin/question-bank");
  return { success: true as const, id: question.id };
}

// ── Upload Attachment (for FILE_BASED questions) ─────────────────────────────

export async function uploadQuestionAttachmentAction(
  questionId: string,
  formData: FormData
) {
  const perms = await getCallerPermissions();
  if (!perms?.orgId) return { success: false as const, error: "Unauthorized" };

  const file = formData.get("file") as File;
  if (!file) return { success: false as const, error: "No file provided" };

  // 10MB limit
  if (file.size > 10 * 1024 * 1024) {
    return { success: false as const, error: "File must be under 10MB" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const blobPath = `questions/${perms.orgId}/${questionId}/${safeName}`;

  const { url } = await put(blobPath, buffer, {
    access: "public",
    contentType: file.type || "application/octet-stream",
  });

  await prisma.interviewQuestion.update({
    where: { id: questionId },
    data: { attachmentUrl: url, attachmentName: file.name },
  });

  revalidatePath("/org-admin/question-bank");
  return { success: true as const, url };
}

// ── Delete Question ──────────────────────────────────────────────────────────

export async function deleteQuestionAction(questionId: string) {
  const perms = await getCallerPermissions();
  if (!perms?.orgId) return { success: false as const, error: "Unauthorized" };

  await prisma.interviewQuestion.deleteMany({
    where: { id: questionId, organizationId: perms.orgId },
  });

  revalidatePath("/org-admin/question-bank");
  return { success: true as const };
}

// ── Get Single Question ──────────────────────────────────────────────────────

export async function getQuestionAction(questionId: string) {
  const perms = await getCallerPermissions();
  if (!perms?.orgId) return { success: false as const, error: "Unauthorized" };

  const question = await prisma.interviewQuestion.findFirst({
    where: { id: questionId, organizationId: perms.orgId },
  });

  if (!question) return { success: false as const, error: "Not found" };
  return { success: true as const, data: question };
}

// ── AI Generate Question ─────────────────────────────────────────────────────

export async function aiGenerateQuestionAction(params: {
  role: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  type: QuestionType;
  techStack?: string;
  count?: number;
}) {
  const perms = await getCallerPermissions();
  if (!perms?.orgId || !perms.userId) return { success: false as const, error: "Unauthorized" };

  const { aiConfig } = await import("@/lib/ai/config");

  if (!aiConfig.isReady) {
    return {
      success: false as const,
      error: "AI is not configured. Set DEEPSEEK_API_KEY or GEMINI_API_KEY in environment variables.",
    };
  }

  const count = Math.min(Math.max(params.count ?? 1, 1), 10);

  const typeInstructions: Record<QuestionType, string> = {
    CODING: "coding problem(s) with starter code template, sample input, and expected output",
    PLAIN_TEXT: "open-ended technical question(s) with a rubric for evaluation",
    MCQ_SINGLE: "multiple-choice question(s) with 4 options (exactly 1 correct) and an explanation",
    MCQ_MULTI: "multiple-choice question(s) with 4-6 options (2-3 correct) and an explanation",
    FILE_BASED: "data analysis problem(s) that reference a dataset (describe the dataset structure)",
  };

  const prompt = `You are a senior technical interviewer. Generate exactly ${count} unique ${typeInstructions[params.type]} for a ${params.role} position.

Difficulty: ${params.difficulty}
${params.techStack ? `Technology Stack: ${params.techStack}` : ""}

RULES:
- Make each question practical and real-world, NOT textbook or generic
- No "FizzBuzz", "Hello World", or trivially simple problems
- Each question must be UNIQUE — different topics, scenarios, and skills tested
- Base them on realistic scenarios that would occur in the role
- Include edge cases and follow-up discussion points
- For CODING: provide starter code with function signature and comments

Return VALID JSON only with a "questions" array containing exactly ${count} objects:
{
  "questions": [
    {
      "title": "...",
      "description": "... (markdown formatted, include examples)",
      "category": "...",
      "tags": ["...", "..."],
      ${params.type === "CODING" ? '"language": "javascript", "starterCode": "...", "sampleInput": "...", "expectedOutput": "...",' : ""}
      ${params.type.startsWith("MCQ") ? '"options": [{"id":"a","text":"...","isCorrect":false},{"id":"b","text":"...","isCorrect":true},...], "explanation": "...",' : ""}
      "followUpQuestions": ["...", "..."]
    }
  ]
}`;

  try {
    let rawContent: string;

    if (aiConfig.provider === "gemini") {
      // ── Gemini path (native SDK) ──
      const { GoogleGenAI, Type } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: aiConfig.gemini.apiKey ?? "" });

      const response = await ai.models.generateContent({
        model: aiConfig.gemini.model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.85,
        },
      });

      rawContent = response.text ?? "{}";
    } else {
      // ── DeepSeek path (OpenAI-compatible SDK) ──
      const { default: OpenAI } = await import("openai");
      const client = new OpenAI({
        baseURL: aiConfig.deepseek.baseUrl,
        apiKey: aiConfig.deepseek.apiKey ?? "",
      });

      const response = await client.chat.completions.create({
        model: aiConfig.deepseek.chatModel,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.85,
        max_tokens: count * 1500,
      });

      rawContent = response.choices[0]?.message?.content ?? "{}";
    }

    // Parse — handle markdown wrapping
    let cleaned = rawContent.trim();
    const mdMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (mdMatch?.[1]) cleaned = mdMatch[1].trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }

    const parsed = JSON.parse(cleaned);
    const questions = parsed.questions || (parsed.title ? [parsed] : []);
    return { success: true as const, data: questions };
  } catch (err) {
    console.error("[QuestionBank] AI generation failed:", err);
    return { success: false as const, error: "AI generation failed. Please try again." };
  }
}
