# EPIC: Panel Interviews & Native Video Intelligence

**Objective:** Upgrade the platform's standard 1-on-1 human interview framework into a robust, native real-time "Panel Interview" engine. This EPIC dictates the implementation of seamless multi-participant video interfaces (powered natively within IQMela), automated meeting recording, AI transcription with speaker diarization ("who said what"), and multi-interviewer scheduling capable of housing up to 6 panelists.

**Design Philosophy:** Experience must be "premium, modern, creative, and seamless" (Tesla/Google Tier UX). Glassmorphic overlays, pristine video grids, and intuitive collaborative note-taking without feeling bloated.

---

## Story 1: Database & Relational Restructuring
Currently, an `Interview` has exactly one `interviewerId`. We need to support up to 6 internal staff per session.
- **Task 1.1:** Modify `schema.prisma`. Replace `interviewerId` with a new `InterviewPanelist` join table storing the relations between an `Interview` and multiple `User` (Staff) records.
- **Task 1.2:** Map permissions to ensure anyone listed in the Panelist relation is authorized to view the candidate details, join the room, and submit their independent `InterviewFeedback` scorecards.
- **Task 1.3:** Create a robust migration script and refactor the existing backend endpoints (e.g., `schedule-actions.ts` from the previous epic) to ingest an array of `interviewerIds`.

## Story 2: Native Video Infrastructure (LiveKit)
Ditch external generic links (Zoom/Google Meet) for a deeply integrated, white-labeled video experience.
- **Task 2.1:** Solidify `src/lib/livekit.ts` to provision secure access tokens (`AccessToken`) linked strictly to the Prisma `candidateId` or `panelistId`.
- **Task 2.2:** Build the `/interview/[id]/live` candidate-facing and interviewer-facing unified Room UI using `@livekit/components-react`.
- **Task 2.3:** Implement a sleek "Dynamic Grid" layout that gracefully scales depending on if there are 2, 3, or 7 people in the room (max 1 candidate + 6 panelists). Include modern micro-animations for active speaker highlights and microphone muting states.

## Story 3: Recording & Telemetry (LiveKit Egress)
Interviews must be securely recorded and archived for subsequent organizational review.
- **Task 3.1:** Deploy a LiveKit Egress pipeline config so that the moment the first Panelist hits "Start Recording", the room's compositor begins writing the mp4 and wav files to AWS S3 (or equivalent storage provider).
- **Task 3.2:** Introduce an overarching `RecordingStatus` to the `Interview` model.
- **Task 3.3:** Build the UI indicators (Flashing red "Recording" badges) that broadcast globally across the LiveKit data-channel to all clients in the room to ensure strict compliance and transparent candidate experience.

## Story 4: Live Transcription & Smart Note Sync ("Who Said What")
Provide the panelists with a superhuman collaborative advantage during the call.
- **Task 4.1:** Utilize AssemblyAI, Deepgram, or the existing DeepSeek pipeline to ingest the audio streams and generate real-time (or immediate post-call) speech-to-text transcripts featuring strict Speaker Diarization.
- **Task 4.2:** Build a collaborative `Notepad` UI anchored to the sidebar of the Video Room. This allows the 6 panelists to silently type synchronized private notes (shared only amongst the panelists) while viewing the candidate.
- **Task 4.3:** Format the "Who Said What" conversational transcript seamlessly into the `/org-admin/reviews` dashboard so Org Admins can literally "Ctrl + F" the entire interview conversation when making hiring decisions.

## Story 5: Premium Panel Scheduling UI Experience
Provide the Recruiters/Hiring Managers with an elegant way to actually orchestrate these complex multi-user events.
- **Task 5.1:** Upgrade the `InterviewScheduler.tsx` Modal. Convert the single interviewer dropdown into a visually rich "Multi-Select Panel Token Input" (like adding email tags), capping the logic at 6 internal users.
- **Task 5.2:** Ensure that mapping logic properly dispatches Resend Calendar Invites to *all* panelists concurrently.
- **Task 5.3:** Refactor the Candidate Dashboard (`/candidate/dashboard/page.tsx`) so the interface dynamically displays "Interview with Sarah, Mike, and Emily" instead of the currently hardcoded singular string.

---

### Non-Functional Requirements & UX
*   **Video Fidelity:** 720p minimum bitrate defaults to aggressively optimize performance for users on lower bandwidth ensuring the candidate doesn't "freeze" during critical questions.
*   **Aesthetic Rules:** 
    *   No hard borders around video tiles; utilize floating rounded-2xl glass panels with heavy blur (`backdrop-blur-xl`).
    *   Dark mode bias for the video room to mimic a cinema/premium theater feel which directs focus completely onto the candidate's stream. 
*   **Resiliency:** Ensure the `livekit` token handler automatically renews dropped sessions if an interviewer briefly loses Wi-Fi connection without crashing the React layout.
