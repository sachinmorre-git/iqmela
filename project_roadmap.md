
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