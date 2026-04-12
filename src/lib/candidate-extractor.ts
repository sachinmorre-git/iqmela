/**
 * Extracted candidate core data derived from raw resume text.
 */
export interface CandidateData {
  /** The extracted full name of the candidate */
  candidateName: string | null;
  /** The extracted primary email address */
  candidateEmail: string | null;
  /** The extracted phone number */
  phoneNumber: string | null;
  /** The extracted LinkedIn profile URL */
  linkedinUrl: string | null;
}

/**
 * Interface for the candidate detail extraction service.
 * Built to be cleanly swapped from a Rule-Based approach to an LLM approach in the future.
 */
export interface CandidateExtractionService {
  /**
   * Parses unstructured raw text and attempts to return structured candidate metadata.
   */
  extractDetails(text: string): Promise<CandidateData>;
}

/**
 * Fast, rule-based fallback extraction service.
 * Uses heuristics and Regular Expressions to greedily locate standard patterns.
 * Highly cost-effective for first-pass parsing prior to LLM fallback.
 */
export class RuleBasedCandidateExtractor implements CandidateExtractionService {
  async extractDetails(text: string): Promise<CandidateData> {
    console.log("[RuleBasedCandidateExtractor] Analyzing raw text for entities...");

    // 1. Email (Standard RFC 5322 regex fragment)
    const emailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i);
    const candidateEmail = emailMatch ? emailMatch[1].trim() : null;

    // 2. Phone Number (Supports common US/International formats loosely)
    const phoneMatch = text.match(/(\+?\d{1,3}[\s-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
    const phoneNumber = phoneMatch ? phoneMatch[0].trim() : null;

    // 3. LinkedIn URL (Greedy match for common linkedin structures)
    const linkedinMatch = text.match(/(https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+)/i)
                       || text.match(/linkedin\.com\/in\/[a-zA-Z0-9_-]+/i);
    const linkedinUrl = linkedinMatch 
      ? (linkedinMatch[0].startsWith('http') ? linkedinMatch[0] : `https://${linkedinMatch[0]}`) 
      : null;

    // 4. Name extraction via heuristics 
    // Usually the name is one of the first few isolated, non-attribute lines in a resume.
    let candidateName: string | null = null;
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    // Scan the first 5 lines
    for (let i = 0; i < Math.min(5, lines.length); i++) {
        const line = lines[i];
        const lowerLine = line.toLowerCase();
        
        // Exclude lines with obvious non-name attributes
        if (!line.includes('@') && 
            !line.includes('http') && 
            !lowerLine.includes('resume') && 
            !lowerLine.includes('cv') &&
            !lowerLine.includes('curriculum')) {
              
            const words = line.split(/\s+/);
            // Names are usually 2 to 4 words
            if (words.length >= 2 && words.length <= 4) {
               // We assume the first matching line is the name
               candidateName = line;
               break;
            }
        }
    }

    // Simulate async processing (e.g. if we swapped to an LLM api later, this stays async)
    await new Promise(resolve => setTimeout(resolve, 300));

    return {
      candidateName,
      candidateEmail,
      phoneNumber,
      linkedinUrl,
    };
  }
}

// Export a singleton instance, wired to the RuleBased fallback for Step 74.
export const candidateExtractor: CandidateExtractionService = new RuleBasedCandidateExtractor();
