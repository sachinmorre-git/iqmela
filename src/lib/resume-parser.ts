/**
 * Common parameters required for any extraction engine.
 */
export interface ExtractionParams {
  /** The absolute or relative file path to the resume on disk/cloud */
  filePath: string;
  /** The MIME type of the file (e.g., application/pdf) */
  mimeType: string;
}

/**
 * Standardised output for the primary text extraction phase.
 */
export interface ExtractionResult {
  /** The raw text parsed from the document */
  text: string;
  /** Whether the extraction was successful */
  success: boolean;
  /** Optional error message if parsing failed */
  error?: string;
}

/**
 * Interface for the resume extraction service.
 * Allows cleanly swapping out implementations (e.g., pdf-parse, AWS Textract, LlamaParse).
 */
export interface ResumeExtractionService {
  extractText(params: ExtractionParams): Promise<ExtractionResult>;
}

/**
 * Mock implementation for development and testing.
 * Simulates a processing delay and returns a predefined dummy string 
 * formatted loosely like a resume.
 */
export class MockExtractionService implements ResumeExtractionService {
  async extractText(params: ExtractionParams): Promise<ExtractionResult> {
    console.log(`[MockExtractionService] Simulating text extraction for ${params.filePath} (${params.mimeType})...`);
    
    // Simulate processing delay (e.g., 2.5 seconds)
    await new Promise((resolve) => setTimeout(resolve, 2500));

    // Simulate failure for unsupported mock types (e.g., image-only files)
    if (params.mimeType.startsWith('image/')) {
      return {
        success: false,
        text: "",
        error: "Image OCR is not supported in the mock parser."
      };
    }

    const mockText = `JOHN DOE
San Francisco, CA | johndoe@example.com | (555) 123-4567 | linkedin.com/in/johndoe

SUMMARY
Experienced software engineer with 5+ years building scalable web applications.
Passionate about solving complex problems using modern architectural patterns.

EXPERIENCE
Senior Software Engineer - TechCorp Inc. (2020 - Present)
- Architected a microservices backend serving 10M+ daily active users using Node.js and PostgreSQL.
- Reduced API latency by 40% through Redis caching strategies.

Software Engineer - WebSolutions LLC (2018 - 2020)
- Developed responsive frontends using React and Next.js.
- Integrated third-party payment gateways and CI/CD pipelines.

EDUCATION
B.S. in Computer Science - State University (2014 - 2018)

SKILLS
JavaScript, TypeScript, React, Node.js, PostgreSQL, Docker, AWS, GraphQL`;

    return {
      success: true,
      text: mockText,
    };
  }
}

// Export a singleton instance of the abstraction,
// currently wired to the Mock layer for Step 71.
export const resumeParser: ResumeExtractionService = new MockExtractionService();
