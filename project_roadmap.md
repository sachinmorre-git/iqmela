
## Project Roadmap (Execution Steps)

Step 1 — Initialize the project
-> Create a new interview platform project using Next.js App Router, TypeScript, and Tailwind CSS. Set up the base app so it runs successfully. Do not add features yet. Create a clean homepage with just a temporary title: "Interview Platform".

Step 2 — Add app layout
-> Create a clean global layout for the app with a top navbar and a centered content area. Keep the homepage content simple. Navbar should show the brand name "Interview Platform".

Step 3 — Add homepage hero
-> Improve the homepage by adding a premium hero section with a headline, short subheadline, and two CTA buttons: "Get Started" and "Book Demo". Keep it modern and clean.

Step 4 — Add homepage sections
-> Add three simple homepage sections below the hero: 1. platform features, 2. how it works, 3. final CTA. Use placeholder text for now.

Step 5 — Add footer
-> Add a clean footer to the global layout with product name, copyright text, and a few placeholder links.

Step 6 — Add dark mode toggle
-> Add dark mode and light mode support with a visible toggle in the navbar. Make sure the homepage works in both modes.

Step 7 — Add reusable button/card components
-> Create reusable UI components for Button and Card and refactor the homepage to use them.

Step 8 — Add loading skeletons
-> Create simple reusable loading skeleton components for cards and page sections. Add a demo section on the homepage showing skeleton examples.

Step 9 — Add 404 page
-> Create a custom 404 page matching the app branding.

Step 10 — Add error page
-> Create a global error UI for unexpected page errors, styled consistently with the app.

Step 11 — Add auth pages shell
-> Create frontend-only placeholder pages for /sign-in and /sign-up. Do not integrate real auth yet. Just build the UI shells.

Step 12 — Add role selection page
-> Create a frontend-only page at /select-role where the user can choose Candidate or Interviewer. Use cards or buttons.

Step 13 — Add candidate dashboard shell
-> Create a frontend-only candidate dashboard page at /candidate/dashboard with sidebar and top section. Use placeholder cards.

Step 14 — Add interviewer dashboard shell
-> Create a frontend-only interviewer dashboard page at /interviewer/dashboard with sidebar and top section. Use placeholder cards.

Step 15 — Add admin dashboard shell
-> Create a frontend-only admin dashboard page at /admin/dashboard with KPI cards and a simple summary layout.

Step 16 — Add candidate profile page
-> Create a candidate profile page with a form UI for full name, email, phone, skills, experience summary, timezone, and resume URL. Frontend only for now.

Step 17 — Add interviewer profile page
-> Create an interviewer profile page with a form UI for full name, title, department, bio, expertise tags, and timezone. Frontend only.

Step 18 — Add settings page
-> Create a generic settings page with tabs: Account, Notifications, Devices. Frontend only.

Step 19 — Add upcoming interviews UI
-> Create a reusable interview card component and show mock upcoming interviews on candidate and interviewer dashboards.

Step 20 — Add empty states
-> Create reusable empty state components and add them to pages where no interviews or no data exist.

Step 21 — Add Prisma setup
-> Set up Prisma in the project with PostgreSQL configuration placeholders. Do not create full business logic yet. Just initialize Prisma correctly.

Step 22 — Add user model
-> Create a basic Prisma User model with id, email, name, role, createdAt, and updatedAt.

Step 23 — Add profile models
-> Add CandidateProfile and InterviewerProfile models linked to User in the Prisma schema.

Step 24 — Add Interview model
-> Add an Interview model with fields: id, title, scheduledAt, durationMinutes, status, roomName, candidateId, interviewerId, createdAt, and updatedAt.

Step 25 — Add seeded mock data page
-> Create a temporary admin-only development page at /dev/data that reads a few records from the database and displays them in simple cards or JSON.

Step 26 — Add Clerk auth setup
-> Integrate Clerk authentication using the official Next.js App Router approach. Do only the base setup required to show sign-in and sign-up using Clerk components.

Step 27 — Protect dashboard routes
-> Protect the candidate, interviewer, and admin dashboard routes so unauthenticated users are redirected to sign-in.

Step 28 — Add post-login redirect
-> After login, redirect users temporarily to /select-role if no role is assigned. Otherwise redirect them to their role-specific dashboard.

Step 29 — Save selected role
-> Wire the /select-role page so selecting Candidate or Interviewer stores the role in the database for the current user.

Step 30 — Create profile record on role selection
-> When a user selects Candidate or Interviewer, automatically create the corresponding profile record if it does not already exist.

Step 31 — Add schedule interview page
-> Create an interviewer-only page at /interviewer/schedule with a form for title, date, time, duration, candidate selector, and notes.

Step 32 — Save scheduled interview to DB
-> Connect the schedule interview form to the database and save a new Interview record on submit.

Step 33 — Show candidate upcoming interviews from DB
-> Replace mock candidate upcoming interviews with real database-backed data for the logged-in candidate.

Step 34 — Show interviewer upcoming interviews from DB
-> Replace mock interviewer upcoming interviews with real database-backed data for the logged-in interviewer.

Step 35 — Add interview details page
-> Create a dynamic interview details page that shows title, schedule, participants, status, notes, and a join button.

Step 36 — Add cancel interview action
-> Add a cancel interview action with confirmation modal that updates the interview status in the database.

Step 37 — Add reschedule interview action
-> Add a reschedule action that allows changing the interview date and time and saves it to the database.

Step 38 — Add LiveKit config
-> Integrate LiveKit configuration into the project with environment variable placeholders only. Do not build the room UI yet.

Step 39 — Add token generation route
-> Create a secure server route that generates a LiveKit access token for an authorized interview participant. Do not build the final UI yet.

Step 40 — Add pre-join page shell
-> Create an interview pre-join page UI with a camera preview placeholder area, mic toggle, camera toggle, and join button. Do not connect actual media devices yet.

Step 41 — Connect real media permissions
-> Connect the pre-join page to actual browser camera and microphone permission checks and show a real local preview if allowed.

Step 42 — Add device selection
-> Add device selectors for camera, microphone, and speaker to the pre-join page.

Step 43 — Add room page shell
-> Create the actual interview room page layout with local video tile, remote video tile placeholder, top bar, and bottom controls. Do not complete the final LiveKit connection yet.

Step 44 — Connect room join flow
-> Connect the pre-join page join button to enter the actual LiveKit room and publish the local participant media.

Step 45 — Add second participant test flow
-> Make the room flow testable by two users in separate browser sessions so local and remote participant tiles both render when both users join the same interview.

Step 46 — Add leave, mute, camera controls
-> Add working controls for leave room, mute/unmute microphone, and camera on/off inside the live room.

Step 47 — Add waiting room guard
-> Allow only the assigned candidate and assigned interviewer to join a room for that interview. Unauthorized users should see an access denied screen.

Step 48 — Add interview timer
-> Add an interview timer to the live room showing elapsed time since join.

Step 49 — Add interviewer notes panel
-> Add a side panel visible only to the interviewer for taking private interview notes during the session. Persist notes to the database.

Step 50 — Add post-interview feedback form
-> After ending or leaving the interview, show a feedback form for the interviewer with rating, notes, recommendation, and summary fields. Save the feedback to the database.


# IQMela-v2 Org Admin Hiring Workflow Prompts

## Step 51 — Add Org Admin card to role selection

-> Extend the existing role selection page by adding a third option card for **Org Admin** alongside **Candidate** and **Interviewer**. Keep the design fully consistent with the current page and existing cards. Do not add any extra features beyond this visual addition.

## Step 52 — Add Org Admin role support in app logic

-> Add **Org Admin** as a valid application role in the shared role system. Update the role types, enums, and route logic only where necessary so the app safely recognizes this role. Do not create the dashboard yet.

## Step 53 — Persist Org Admin role selection

-> Update the role selection flow so that when a logged-in user chooses **Org Admin**, that role is persisted in the database using the same pattern already used for Candidate and Interviewer.

## Step 54 — Create Org Admin profile record

-> When a user selects **Org Admin**, automatically create the corresponding Org Admin profile record if it does not already exist. Follow the same creation pattern already used for the other profile types.

## Step 55 — Create Org Admin dashboard shell

-> Create a route-protected Org Admin dashboard at **/org-admin/dashboard** using the same design language as the existing dashboards. Add placeholder KPI cards for **Open Positions**, **Uploaded Resumes**, **Shortlisted Candidates**, and **Interview Invites Sent**.

## Step 56 — Add Org Admin sidebar navigation

-> Extend the Org Admin dashboard layout with a left sidebar navigation containing **Dashboard**, **Positions**, **Candidates**, **Resume Ranking**, **Invites**, and **Settings**. Links can point to real routes or safe placeholders where needed.

## Step 57 — Add Position model in Prisma

-> Add a new **Position** model to the Prisma schema with fields such as **id**, **title**, **department**, **location**, **employmentType**, **description**, **jdText**, **status**, **createdById**, **createdAt**, and **updatedAt**. Keep it aligned with the existing user model and Org Admin ownership pattern.

## Step 58 — Create Positions list page shell

-> Create an Org Admin positions page at **/org-admin/positions** that shows a table or card-based list of positions. Use a mock empty state for now if needed.

## Step 59 — Create Add Position page

-> Create an Add Position page at **/org-admin/positions/new** with a frontend-only form containing **title**, **department**, **location**, **employment type**, **status**, **short description**, and **JD text area**. Do not add save logic yet.

## Step 60 — Save new position to database

-> Connect the Add Position form to the database so a new **Position** record is created on submit. After successful creation, redirect to the positions list page or the position details page.

## Step 61 — Create Position details page

-> Create a database-backed position details page that displays **title**, **department**, **location**, **employment type**, **status**, **short description**, and **JD text**. Also include an action area reserved for future resume upload and ranking actions.

## Step 62 — Add edit position flow

-> Add an Edit Position page and update flow so Org Admin can edit an existing position and save the updated values back to the database.

## Step 63 — Add Position status handling

-> Add clear position status options such as **Draft**, **Open**, **Paused**, and **Closed**, and expose them in the create form, edit form, and details UI.

## Step 64 — Add Resume model in Prisma

-> Add a new **Resume** model to the Prisma schema linked to **Position**. Include fields such as **id**, **positionId**, **originalFileName**, **storagePath**, **mimeType**, **fileSize**, **uploadedAt**, **extractedText**, **parsingStatus**, **createdAt**, and **updatedAt**. Do not add ranking fields yet.

## Step 65 — Add upload resumes section to position details

-> On the Position Details page, add a visible **Upload Resumes** section with a drag-and-drop style upload area and a multi-file selection UI. This step is frontend only.

## Step 66 — Implement multi-file resume upload

-> Connect the resume upload UI so Org Admin can upload multiple resume files for a position. Store the files using the current local development-safe strategy or a configurable storage abstraction, and create corresponding Resume records in the database.

## Step 67 — Show uploaded resumes list for a position

-> Create a position-specific resumes list UI showing uploaded resumes with columns such as **file name**, **upload date**, **parsing status**, **extracted candidate name placeholder**, and **extracted email placeholder**.

## Step 68 — Add resume details page

-> Create a resume details page for a single uploaded resume showing **file metadata**, **associated position**, an **extracted text placeholder section**, an **extracted candidate details placeholder**, and a **ranking placeholder**.

## Step 69 — Add parsing status enum

-> Add a parsing status enum for resume processing with values such as **uploaded**, **queued**, **processing**, **completed**, and **failed**, and wire it into the Resume model and resume UI.

## Step 70 — Add extracted candidate fields to Resume

-> Extend the Resume model with extracted candidate fields such as **candidateName**, **candidateEmail**, **phoneNumber**, **linkedinUrl**, and **parsingNotes**. Keep all fields optional for now.

## Step 71 — Create text extraction service abstraction

-> Create a resume text extraction service abstraction with a clear interface and a mock or development-safe implementation. Structure it so real PDF and DOCX extraction can be swapped in later.

## Step 72 — Add manual “Extract Resume Text” action

-> On the resume details page, add a button called **Extract Resume Text** that runs the current extraction service and saves extracted text into the database for that resume.

## Step 73 — Show extracted text on resume page

-> Display the saved extracted resume text in a readable, scrollable section on the resume details page.

## Step 74 — Create candidate detail extraction service abstraction

-> Create a separate candidate detail extraction service responsible for extracting **name**, **email**, **phone**, and **LinkedIn** from the extracted resume text. Start with rule-based parsing and keep the service swappable for future LLM-based extraction.

## Step 75 — Add “Extract Candidate Details” action

-> Add a button on the resume details page called **Extract Candidate Details** that reads the extracted resume text and populates **candidateName**, **candidateEmail**, **phoneNumber**, and **linkedinUrl** in the database.

## Step 76 — Add AI extraction fields to Resume model

-> Upgrade the Resume model to support AI extraction and ranking. Add optional fields such as **candidateName**, **candidateEmail**, **phoneNumber**, **linkedinUrl**, **location**, **skillsJson**, **experienceYears**, **educationJson**, **companiesJson**, **extractionProvider**, **extractionConfidence**, **validationWarningsJson**, **matchScore**, **matchLabel**, **matchedSkillsJson**, **missingSkillsJson**, **rankingExplanation**, **notableStrengthsJson**, **possibleGapsJson**, **rankingStatus**, **rankedAt**, and **aiRawOutputJson**. Keep fields nullable where appropriate and preserve existing data.

## Step 77 — Create Gemini AI service abstraction

-> Create a clean AI service abstraction layer for resume processing using **Gemini** as the primary provider. Add service interfaces for **extractResumeStructuredData**, **rankResumeAgainstJD**, and **validateAndNormalizeResumeData**. Implement a Gemini provider placeholder and a mock fallback provider. Do not wire it to the UI yet.

## Step 78 — Add AI processing state to resumes

-> Add AI processing states to the resume workflow using values such as **uploaded**, **queued_for_ai**, **extracting**, **extracted**, **ranking**, **ranked**, and **failed**. Show this status in both the position resume list and the resume details page, without running real AI yet.

## Step 79 — Add Gemini environment variable support

-> Add safe environment-variable support and configuration loading for Gemini integration. Document the required Gemini environment variables for local development and deployment, but do not expose secrets in the UI and do not run real extraction yet.

## Step 80 — Implement real Gemini structured extraction service

-> Implement the first real Gemini-based structured extraction service for resumes. It should return strict structured JSON with fields such as **candidateName**, **candidateEmail**, **phoneNumber**, **linkedinUrl**, **location**, **skills**, **experienceYears**, **education**, **companies**, and **summary**. Use environment variables for Gemini configuration, keep a mock fallback when no API key is configured, keep the logic inside the service layer, and make parsing defensive and robust.

## Step 81 — Add “Run AI Extraction” button on resume details page

-> On the resume details page, add a button called **Run AI Extraction**. When clicked, it should use the configured AI provider, process the resume, save structured candidate data into the Resume record, save **extractionProvider**, **extractionConfidence**, and **aiRawOutputJson**, and update the AI processing status. If no Gemini API key is configured, use the fallback provider without crashing.

## Step 82 — Show structured extraction UI on resume details page

-> Improve the resume details page so the extracted AI fields are shown in a recruiter-friendly card-based layout. Display **candidate name**, **email**, **phone**, **LinkedIn**, **location**, **skills**, **experience years**, **education**, **companies**, **extraction provider**, **extraction confidence**, and **AI status**. Keep raw AI output hidden behind a collapsible debugging section.

## Step 83 — Add deterministic validation and normalization layer

-> Add a deterministic validation and normalization layer that runs after AI extraction. Validate and normalize **email format**, **phone format**, **LinkedIn URL shape**, **duplicate skills**, and **blank or suspicious values**. Save warnings into **validationWarningsJson** and show them on the resume details page. Do not block extraction; only flag issues.

## Step 84 — Refactor UI so bulk actions are primary on Position Details page

-> Refactor the Org Admin resume processing UX so the Position Details page becomes the primary control center for AI processing. Prominently add bulk action buttons for **Extract All Candidate Data** and **Rank All Candidates** above the resumes list. Keep any existing individual resume actions only as optional fallback or debug actions.

## Step 85 — Implement bulk extraction as the primary action

-> Implement **Extract All Candidate Data** on the Position Details page as the main extraction workflow. When clicked, it should process all resumes for that position, use the existing Gemini-based extraction pipeline when configured, use fallback mode when Gemini is not configured, save structured candidate data into each Resume record, update AI processing status, continue processing remaining resumes even if one fails, and save validation warnings where applicable.

## Step 86 — Show extracted summary columns in the position resume table

-> Enhance the position-specific resumes table so extraction results are directly visible after bulk extraction. Add visible columns or fields for **candidate name**, **email**, **phone**, **top skills preview**, **extraction confidence**, **AI processing status**, and a **validation warning indicator**.

## Step 87 — Add bulk extraction progress and summary feedback

-> Improve the bulk extraction UX on the Position Details page by showing a visible progress or summary result area after extraction. Include **total resumes processed**, **successful extractions**, **failed extractions**, and **resumes with warnings**.

## Step 88 — Implement bulk ranking as the primary action

-> Implement **Rank All Candidates** on the Position Details page as the main ranking workflow. When clicked, it should rank all resumes for that position that already have extracted candidate data, compare each resume against the position’s JD, use Gemini-based ranking when configured, use fallback heuristic ranking when Gemini is not configured, save ranking results for each resume, continue even if one resume fails, and update ranking status for each resume.

## Step 89 — Show ranking summary columns in the position resume table

-> Enhance the position-specific resumes table so ranking results are clearly visible without opening individual resumes. Add fields or columns for **match score**, **match label**, **matched skills preview**, **missing skills preview**, **ranking status**, and a **shortlist action**. Sort by highest match score first after ranking.

## Step 90 — Add position-level pipeline buttons and sequencing guards

-> Improve the Position Details workflow by adding clear sequencing and guard behavior. **Extract All Candidate Data** should be the first bulk action, **Rank All Candidates** should only be enabled when at least one resume has extracted data, the UI should show helper text if ranking is attempted before extraction, and the page should show last run timestamps or status summaries when available.

## Step 91 — Add a one-click full pipeline action

-> Add a new primary action on the Position Details page called **Run Full AI Pipeline**. When clicked, it should extract candidate data for all resumes in the position, validate and normalize the results, rank all candidates against the position JD, and refresh the table with final results. Continue processing even if some resumes fail, show a clear summary at the end, keep the separate bulk buttons too, and do not introduce background queues yet.

## Step 92 — Add batch shortlist controls from the position table

-> Add shortlist functionality directly into the position-level ranked resume table. Org Admin should be able to shortlist candidates and remove them from shortlist directly from the table. Shortlist state should be visually clear, recruiter notes should be supported either inline or through a lightweight modal, and all changes should persist to the database.

## Step 93 — Add recruiter override editing from the position table

-> Allow recruiter override editing directly from the position workflow for key candidate fields. From the position-level table or a lightweight modal, allow Org Admin to correct **candidate name**, **email**, **phone**, and **LinkedIn URL**. Use recruiter overrides in downstream shortlist and invite workflows, while keeping original AI values distinguishable in the UI.

## Step 94 — Add ranked review page optimized for all positions

-> Create or refactor the ranked candidates page so it acts as a secondary cross-position review screen while the Position Details page remains the primary action center. The ranked page should focus on filtering and reviewing already-ranked candidates across positions, with filters for **position**, **score range**, **shortlist state**, and **invite state**. Do not place bulk extraction or ranking buttons on this page.

## Step 95 — Add bulk invite draft creation from shortlisted candidates

-> From the position-level shortlisted candidates workflow, add bulk invite draft creation support. Org Admin should be able to select one or more shortlisted candidates from a position, click **Create Interview Invite Drafts**, create draft invite records for all selected candidates, use recruiter override email when available or AI extracted email otherwise, and see a success and failure summary after creation. Do not send invites yet.

## Step 96 — Add invites page with batch send workflow

-> Refine the invites page so it supports batch operations. Show both **invite drafts** and **sent invites**, allow selecting multiple draft invites, add a batch action to send selected invites, show invite status clearly, and preserve any existing single-invite actions while optimizing the page for Org Admin bulk workflow.

## Step 97 — Implement batch send invite action

-> Implement batch sending for selected invite drafts. When Org Admin selects multiple invite drafts and clicks send, use the existing mail service abstraction, send each invite, continue even if one fails, update each invite status individually, and show a batch summary with success and failure counts. Keep mock or logging mode support if real email is not configured.

## Step 98 — Add Org Admin activity summary for batch runs

-> Add an Org Admin activity summary panel that shows the latest batch workflow runs for a position, including **extraction run summary**, **ranking run summary**, **invite draft creation summary**, and **invite send summary**. Show counts, timestamps, and status outcomes on the Position Details page or Org Admin dashboard.

## Step 99 — Add audit trail for batch workflows

-> Add an audit trail for the batch-oriented Org Admin workflow. Track actions such as **bulk extraction started/completed**, **bulk ranking started/completed**, **full AI pipeline run**, **bulk shortlist updates**, **bulk invite draft creation**, and **bulk invite send**. Expose a simple readable activity log in the Org Admin interface.

## Step 100 — Finalize the Org Admin bulk hiring control center

-> Refine the Org Admin Position Details page and related review pages so the full hiring workflow is clearly optimized for bulk processing. The final experience should support: uploading resumes for a position, extracting all candidate data with one action, ranking all candidates with one action, running the full AI pipeline with one action, reviewing ranked candidates in a recruiter-friendly table, shortlisting candidates directly from the table, creating invite drafts in bulk, and sending invites in bulk. Make the primary actions prominent and ensure the Position Details page feels like a true hiring workflow control center.
