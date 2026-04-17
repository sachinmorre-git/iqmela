/**
 * Mock AI Interview Provider — deterministic, no API key required.
 * Used when AI_PROVIDER=mock or no API key is configured.
 */

import type {
  AiInterviewProvider,
  AiInterviewPlan,
  AiInterviewSummary,
  QuestionPlanContext,
  TranscriptTurn,
  FollowUpContext,
  FollowUpResult,
} from "../types";

const MOCK_QUESTIONS = {
  INTRO: [
    "Tell me a little about yourself and what drew you to this role.",
    "Can you walk me through your professional journey so far?",
  ],
  TECHNICAL: [
    "How would you approach debugging a performance issue in a production system?",
    "Describe your experience with version control and code review practices.",
    "What strategies do you use to ensure your code is maintainable long-term?",
    "Walk me through a technically complex problem you solved recently.",
  ],
  BEHAVIORAL: [
    "Tell me about a time you had to work under significant pressure. How did you manage it?",
    "Describe a situation where you disagreed with a teammate. How did you resolve it?",
    "Give me an example of a time you took initiative beyond your job description.",
  ],
  CLOSING: [
    "Do you have any questions for me about the role or the company?",
  ],
};

export class MockAiInterviewProvider implements AiInterviewProvider {
  readonly providerName = "mock";

  async generateQuestionPlan(context: QuestionPlanContext): Promise<AiInterviewPlan> {
    const counts = {
      intro: Math.min(context.questionCounts?.intro ?? 2, MOCK_QUESTIONS.INTRO.length),
      technical: Math.min(context.questionCounts?.technical ?? 4, MOCK_QUESTIONS.TECHNICAL.length),
      behavioral: Math.min(context.questionCounts?.behavioral ?? 3, MOCK_QUESTIONS.BEHAVIORAL.length),
    };

    const questions = [
      ...MOCK_QUESTIONS.INTRO.slice(0, counts.intro).map(q => ({
        category: "INTRO" as const,
        question: q,
        rationale: "Standard intro to warm up the candidate.",
      })),
      ...MOCK_QUESTIONS.TECHNICAL.slice(0, counts.technical).map(q => ({
        category: "TECHNICAL" as const,
        question: q,
        rationale: "Assessing technical depth.",
      })),
      ...MOCK_QUESTIONS.BEHAVIORAL.slice(0, counts.behavioral).map(q => ({
        category: "BEHAVIORAL" as const,
        question: q,
        rationale: "Assessing cultural fit and soft skills.",
      })),
      {
        category: "CLOSING" as const,
        question: MOCK_QUESTIONS.CLOSING[0],
        rationale: "Wrap up and give candidate a chance to ask questions.",
      },
    ];

    return {
      questions,
      usage: {
        provider: "mock",
        model: "mock-v1",
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
      },
    };
  }

  async scoreSession(
    _context: QuestionPlanContext,
    turns: TranscriptTurn[]
  ): Promise<AiInterviewSummary> {
    const perAnswer = turns.map((turn, i) => ({
      turnIndex: i,
      scoreRaw: 7,
      scoreFeedback: `Good response to the ${turn.category.toLowerCase()} question. Mock scoring is active — set AI_PROVIDER=gemini for real evaluation.`,
      strengths: ["Clear communication", "Relevant experience mentioned"],
      gaps: ["Could provide more concrete metrics"],
    }));

    const overallScore = 70;

    return {
      overallScore,
      recommendation: "HIRE",
      executiveSummary:
        "This is a mock evaluation. The candidate responded to all questions. Configure a real AI provider for genuine scoring.",
      perAnswer,
      usage: {
        provider: "mock",
        model: "mock-v1",
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
      },
    };
  }

  async evaluateFollowUp(_context: FollowUpContext): Promise<FollowUpResult> {
    // Mock provider never triggers follow-ups
    return {
      shouldFollowUp: false,
      usage: {
        provider: "mock",
        model: "mock-v1",
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
      },
    };
  }
}
