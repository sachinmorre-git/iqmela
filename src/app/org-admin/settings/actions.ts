"use server"

import { auth } from "@clerk/nextjs/server"

export async function testAiProviderAction() {
  try {
    const { userId } = await auth()
    if (!userId) return { success: false, error: "Unauthorized" }

    const { hiringAi } = await import("@/lib/ai")
    
    // A tiny test prompt mapping to CandidateSummaryResult for simplicity
    const mockData = {
      candidateName: "Test User",
      skills: ["React"],
      experienceYears: 1,
      location: "Local",
      summary: "Test",
      companies: []
    } as any;

    const res = await hiringAi.generateCandidateSummary(mockData);

    return { 
      success: true, 
      provider: hiringAi.providerName,
      message: "AI connection successful!",
      dataPreview: res.headline
    }
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to connect to AI Provider" }
  }
}
