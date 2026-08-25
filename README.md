# Jidanao Learning Hub

Production-oriented React + Firebase LMS foundation for Jidanao Elementary School (Grades 3–6).

## Included
- Public landing page with lesson/game catalog and filters
- One login page with Firebase Email/Password Authentication
- Student self-registration; admin-created teacher accounts via secure Cloud Function
- Role-protected routes for student, teacher and administrator
- Teacher lesson drafting and Firebase Storage uploads
- Secure AI lesson generator and lesson-scoped learning assistant through Firebase Functions + OpenAI
- Student progress tracking, educational game scoring, browser text-to-speech narration, PDF certificates
- Admin account management and analytics
- Realtime Database and Storage rules
- Responsive/mobile UI and accessibility basics

## Setup
1. `npm install`
2. Copy `.env.example` to `.env` and enter your Firebase web app configuration.
3. In Firebase Authentication, enable Email/Password.
4. Create Realtime Database and Storage.
5. Install Firebase CLI and authenticate: `firebase login`.
6. Initialize/associate the project: `firebase use --add`.
7. Install function dependencies: `cd functions && npm install && cd ..`.
8. Store the server-side AI key: `firebase functions:secrets:set OPENAI_API_KEY`.
9. Deploy rules/functions: `firebase deploy --only database,storage,functions`.
10. Create the first administrator user in Firebase Auth, then write `/users/<uid>` with `{ uid, name, email, role: "admin", status: "active" }` once from the Firebase Console. Do not expose an admin-creation route publicly.
11. Run locally: `npm run dev`.
12. Production build: `npm run build`; deploy with `firebase deploy --only hosting`.

## Security notes
- Firebase web configuration is not treated as a server secret; authorization is enforced by database/storage rules and Functions role checks.
- OpenAI credentials remain server-side in Firebase Functions secrets.
- AI output is saved as a draft and requires teacher approval before publication.
- For minors, collect only necessary data, define retention/deletion procedures, conduct school/privacy review, and obtain any consent/authorization required by applicable policy/law.

## Phase 4 object detection
Camera access is implemented with `getUserMedia`. For production object counting, add a reviewed on-device object-detection model (for example MediaPipe Tasks Vision) and validate it in classroom lighting/device conditions before enabling scoring. The current game intentionally does not invent detection results.
