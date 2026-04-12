# IQMela Required AI Services Architecture

This document maps out the specific Google APIs, Cloud services, and pricing models required to power the IQMela platform's AI workflow.

---

## 1. Resume Processing & Analysis

### Bulk Resume & Field Extraction
* **Best Service**: **Gemini 2.5 Flash-Lite** (via Gemini Developer API) using JSON schema. Add **Document AI OCR** only if you expect heavily scanned/illegible image PDFs.
* **Why it fits**: Gemini easily reads standard PDFs and extracts data (names, emails, phone, LinkedIn, skills) directly into structured JSON. This replaces brittle Regex processing with highly scalable AI extraction.
* **Costing**: Token-based. Paid tier starts at **$0.10 input / $0.40 output per 1M tokens**. Batch API reduces costs by up to 50%. (Document AI OCR is per-page, e.g. $1.50/1k pages).
* **Recommendation**: Start default with **Gemini Flash-Lite** for all parsed resumes. Use Document AI strictly as a fallback.

### Resume-to-JD Matching and Ranking
* **Best Service**: **Gemini 2.5 Flash** for initial bulk ranking; **Gemini 2.5 Pro** for top-candidate tie-breaks.
* **Why it fits**: Flash handles bulk comparisons fast at scale. Pro excels at complex reasoning and deep multi-variable analysis when picking finalists.
* **Costing**: Flash: **$0.30 input / $2.50 output per 1M tokens**. Pro: **$1.25 input / $10 output per 1M tokens**.
* **Recommendation**: Create a composite workflow—use Flash for scoring *all* applicants, and Pro for surfacing the Top 10.

---

## 2. Platform Preparation & Communication

### JD Analysis & Rubric Generation
* **Best Service**: **Gemini 2.5 Flash** or **Gemini 2.5 Pro**
* **Why it fits**: Perfectly suited for expanding a standard Job Description into dedicated scoring criteria, grading rubrics, and technical interview questions.
* **Costing**: Standard Gemini token pricing.
* **Recommendation**: **Strong yes**. Build this directly into the Org Admin dashboard.

### Invite Emails & Recruiter Communication
* **Best Service**: **Gemini 2.5 Flash-Lite**
* **Why it fits**: Email copywriting and summarizing recruiter notes do not require expensive heavy reasoning. 
* **Costing**: Flash-Lite token pricing (lowest tier).
* **Recommendation**: Highly viable for draft generation. 

---

## 3. Live Interview & Audio Processing

### Transcription (Speech-to-Text)
* **Best Service**: **Google Cloud Speech-to-Text**
* **Why it fits**: Purpose-built for transcription, offering superior reliability, speaker diarization, and latency compared to general LLM transcribers.
* **Costing**: **Per second of audio**. Google Cloud tier includes 60 minutes/month free.
* **Recommendation**: Use this exclusively for transcribing candidate audio streams.

### Voice Synthesis (Text-to-Speech)
* **Best Service**: **Gemini 2.5 Flash TTS** (for LLM persona) or **Cloud TTS / Chirp 3 HD** (for standard synthesis).
* **Why it fits**: Gemini TTS is excellent for dynamic, conversational bot voices. Cloud TTS is better for static, predictable UI announcements.
* **Costing**: Gemini: **$10 per 1M audio tokens out**. Cloud TTS: **$30 per 1M characters** (beyond free tier).
* **Recommendation**: Start with Gemini TTS for the AI Interviewer personality.

### Interview Analysis & Scoring
* **Best Service**: **Speech-to-Text + Gemini 2.5 Flash/Pro**
* **Why it fits**: By stacking a dedicated transcription engine with a reasoning engine, you achieve the highest fidelity transcript analysis, communication scoring, and post-interview summarization.
* **Costing**: Hybrid (Per second for STT + Per token for Gemini).
* **Recommendation**: This is the ultimate architecture for the core technical interviewing loop.

### Live AI Voice Copilot
* **Best Service**: **Gemini Live / Native Audio Models**
* **Why it fits**: Google's native multimodal audio framework provides ultra-low latency conversational capabilities directly from voice streams.
* **Costing**: Native audio tier: **$3.00 audio in / $12.00 audio out per 1M tokens**.
* **Recommendation**: Implement this later after the core asynchronous workflow stabilizes.

---

## 4. Advanced System Capabilities

### Semantic Candidate Search & Deduplication
* **Best Service**: **Gemini Embeddings** (Text Embeddings)
* **Why it fits**: Solves "find similar resumes" or "search by semantic skill clusters" without exact keyword matches. Also inherently useful for detecting near-duplicate submissions.
* **Costing**: Text embeddings are free tier eligible, then **$0.15 per 1M tokens**.
* **Recommendation**: Highly useful for "Talent Pool" features in V2.

### Fraud & Proctoring Telemetry
* **Best Service**: **Video Intelligence API + Speech-to-Text + Gemini** + Custom Heuristics.
* **Why it fits**: Google provides robust primitive analysis (object detection, gaze, speech pacing), but no out-of-the-box holistic "proctoring API".
* **Costing**: Video Intelligence is **$0.15 per minute** for object tracking/text detection.
* **Recommendation**: Google AI provides the layers; you must build the composite proctoring rules logic on top of it.

### Text Moderation & Abuse Checks
* **Best Service**: **Cloud Natural Language Text Moderation**
* **Why it fits**: Essential for blocking harmful language in generated questions, candidate submissions, or chat.
* **Costing**: **Per 100-character unit**.
* **Recommendation**: Enable when user-generated public content goes live.

### Avatar / Generation Video
* **Best Service**: **Veo 3.1 via Gemini API / Vertex AI**
* **Why it fits**: Google's video generation engine. While not a specialized "talking head avatar" platform, it's the strongest Google-native primitive for generating dynamic media.
* **Costing**: Paid per second (e.g. Veo 3.1 Fast at **$0.10/sec @ 720p**).
* **Recommendation**: Best for onboarding explainer videos or marketing, rather than real-time avatars.

---

## Useful References

* [Gemini Developer API Pricing](https://ai.google.dev/gemini-api/docs/pricing)
* [Gemini Structured Outputs](https://ai.google.dev/gemini-api/docs/structured-output)
* [Google Cloud Speech-to-Text Pricing](https://cloud.google.com/speech-to-text/pricing)
* [Google Cloud Text-to-Speech Pricing](https://cloud.google.com/text-to-speech/pricing)
* [Cloud Natural Language Pricing](https://cloud.google.com/natural-language/pricing)
* [Cloud Video Intelligence Pricing](https://cloud.google.com/video-intelligence/pricing)
