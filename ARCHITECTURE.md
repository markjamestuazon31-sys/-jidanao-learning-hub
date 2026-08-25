# Jidanao Learning Hub — System Architecture

## 1. Objectives
The LMS is designed as a school-managed academic platform for Grades 3–6, combining teacher-authored lessons, quizzes, multimedia, educational games, progress tracking, grading, reports, certificates, and teacher-controlled AI assistance. The trust model is important: AI may draft learning content, but a teacher must review the result before it is published to learners.

## 2. Architecture

### Client
React + Vite single-page application with responsive layouts, role-aware navigation, protected routes, student/teacher/admin dashboards, lesson reader, educational games, browser speech synthesis, and PDF certificate generation.

### Firebase platform
- Firebase Authentication: single Email/Password login for all roles.
- Realtime Database: user profiles, lessons, games, quiz bank, progress, grades, certificates, and academic settings.
- Cloud Storage: teacher-uploaded lesson materials.
- Cloud Functions: privileged teacher account creation and all OpenAI requests.
- Firebase Hosting: SPA hosting with rewrite to index.html.

### AI boundary
API keys never enter the browser. The browser calls authenticated Firebase callable functions. The function verifies the current role against the database, calls OpenAI, and returns structured content. AI-generated lessons enter the LMS as `draft`, not `published`.

## 3. Database structure

```text
users/{uid}
  uid, name, email, role, gradeLevel?, status, createdAt

lessons/{lessonId}
  teacherId, title, grade, subject, description, content
  learningObjectives[], activities[], quiz[], games[]
  attachment?, aiGenerated?, status[draft|published|archived]
  createdAt, updatedAt

games/{gameId}
  teacherId, title, grade, subject, description, instructions
  levels{}, scoring{}, status, createdAt, updatedAt

quizBank/{quizId}
  teacherId, grade, subject, competency, gradingPeriod
  questions{}, createdAt, updatedAt

progress/{studentUid}/lesson/{lessonId}
  percent, completed, completedAt, updatedAt

progress/{studentUid}/game/{gameId}
  score, level, lastPlayedAt, updatedAt

grades/{studentUid}/{schoolYear}/{gradingPeriod}/{subject}
  activities, quizzes, performanceTasks, exam, finalGrade

certificates/{studentUid}/{certificateId}
  title, milestoneType, issuedAt, issuedBy, verificationCode

academicSettings
  schoolYear, gradingPeriods, gradeLevels, subjects
```

Indexes in `database.rules.json` cover common public catalog and administration queries.

## 4. User flow

### Visitor
Landing page → filter/view featured public metadata → click lesson/game → if unauthenticated, redirect to one Login page → after authentication, return to requested resource.

### Student
Self-register → role automatically fixed as `student` → student dashboard → assigned/published lesson or game → progress update → grades/milestones → certificate PDF after qualifying milestone.

### Teacher
Admin-created account → teacher dashboard → create/upload a lesson or open AI Lesson Studio → submit competency + lesson notes → secure AI function generates original structured draft → teacher reviews → approves into draft workspace → teacher publishes after review → monitor progress/grade learners.

### Administrator
Secure admin account → create teacher accounts through a privileged Cloud Function → manage users/settings → view school analytics and reports.

## 5. UI wireframe

### Public home
Sticky school header + seal → blue educational hero → featured lessons/games → filters/library → benefit cards. Mobile collapses the sidebar into a drawer.

### Teacher dashboard
Summary stat cards → prominent AI Studio action → lesson drafting form → upload control → monitoring navigation.

### Student dashboard
Progress stats → circular progress visualization → achievement/certificate panel → learning library and games.

### Admin dashboard
Account statistics → teacher creation form → recent users table → enrollment analytics.

## 6. Technical issues and mitigations

1. **Role escalation** — Never trust a role supplied by the browser. Database rules prevent a student from changing their own role; teacher creation is server-side.
2. **Admin bootstrap** — The first administrator should be created out-of-band by an authorized project owner; no public `create admin` endpoint is included.
3. **AI key leakage** — OpenAI requests are server-side and use Firebase Functions secrets.
4. **AI hallucination/curriculum mismatch** — AI output is always a draft; teacher review is mandatory. Future work should add curriculum competency identifiers and validation rubrics.
5. **Minors and privacy** — Minimize collected personal data, define retention/deletion procedures, obtain school/legal approval, and implement consent/notice requirements applicable to the school.
6. **Realtime Database fan-out and analytics** — As reporting complexity grows, consider exporting analytics to BigQuery or migrating high-complexity report queries to Firestore/Cloud SQL.
7. **Large uploads** — Use Cloud Storage, not Realtime Database. Current rules cap teacher uploads at 25 MB.
8. **Camera reliability** — `getUserMedia` requires HTTPS and permission. Object detection should run on-device where possible and must be validated across low-end phones, lighting, occlusion and classroom backgrounds.
9. **Accessibility** — Maintain semantic labels, keyboard focus, readable contrast, responsive typography, captions/transcripts for multimedia, and reduced-motion support.
10. **Offline/low-connectivity** — A later PWA phase can cache lesson shells and queued progress writes; avoid assuming constant broadband.

## 7. Development phases

### Phase 1 — Authentication + Public Home + Database
Implemented foundation: Firebase Auth, student registration, role-protected routes, public catalog, database/storage rules, responsive shell.

### Phase 2 — Teacher Dashboard + AI Lesson Generator
Implemented foundation: lesson drafts/uploads, secure callable AI lesson generation, teacher approval into draft state, privileged teacher account creation.

### Phase 3 — Student Dashboard + Learning Modules
Implemented foundation: authenticated lesson reader, narration, progress tracking, lesson-scoped AI assistant, milestone certificate generation.

### Phase 4 — Games + Camera Learning
Implemented game scoring/progress and secure camera access. Production object detection is intentionally not faked; enable it only after adding and validating a real on-device model such as MediaPipe Tasks Vision.

### Phase 5 — Reports + Certificates + Analytics
Implemented base PDF certificate generation and admin enrollment analytics. Full grading-period report-card templates should be finalized against the school’s official grading policy and report format before release.

### Phase 6 — Testing + Deployment
Run Firebase Emulator Suite tests for auth/rules/functions, browser/mobile QA, accessibility checks, security review, backup/restore test, then deploy Hosting/Database/Storage/Functions.

## 8. Recommended QA gates
- Unit tests for grade calculations and quiz scoring.
- Firebase Rules emulator tests for every role/path.
- Function tests for unauthenticated, wrong-role and valid-role calls.
- E2E flows: visitor→login→return, student registration, teacher draft, admin teacher creation, lesson completion, certificate generation.
- Cross-browser testing: Chrome/Edge/Firefox/Safari and Android/iOS browsers.
- Camera permission denied/revoked/no-device cases.
- Accessibility: keyboard-only, screen reader landmarks, contrast, zoom 200%, reduced motion.
- Security: no API secrets in Vite bundle, deny-by-default rules, upload size/type controls, rate limits/App Check before production.
