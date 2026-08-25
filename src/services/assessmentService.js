import {
  get,
  onValue,
  push,
  ref,
  runTransaction,
  set,
  update,
} from "firebase/database";
import { auth, database } from "../firebase/firebaseConfig";
import { classFields, teacherCanAccessClass } from "../data/schoolClasses";

export const QUESTION_TYPES = Object.freeze([
  { value: "multiple-choice", label: "Multiple choice" },
  { value: "checkboxes", label: "Checkboxes" },
  { value: "true-false", label: "True or false" },
  { value: "short-answer", label: "Short answer" },
  { value: "paragraph", label: "Paragraph (teacher review)" },
]);

export const GRADING_PERIODS = Object.freeze([
  "1st Grading Period",
  "2nd Grading Period",
  "3rd Grading Period",
  "4th Grading Period",
]);

function clean(value) {
  return JSON.parse(JSON.stringify(value));
}

function number(value, fallback = 0) {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function questionId() {
  return `question-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createQuestion(type = "multiple-choice") {
  const base = {
    id: questionId(),
    type,
    prompt: "",
    description: "",
    required: true,
    points: 1,
  };
  if (type === "multiple-choice") return { ...base, options: ["Option 1", "Option 2"], answerIndex: 0 };
  if (type === "checkboxes") return { ...base, options: ["Option 1", "Option 2"], correctAnswers: [0] };
  if (type === "true-false") return { ...base, options: ["True", "False"], answerIndex: 0 };
  if (type === "short-answer") return { ...base, acceptedAnswers: [""] };
  return { ...base, manualReview: true };
}

function normalizeQuestion(question, index) {
  const allowedTypes = new Set(QUESTION_TYPES.map((item) => item.value));
  const type = allowedTypes.has(question?.type) ? question.type : "multiple-choice";
  const result = {
    id: String(question?.id || `question-${index + 1}`),
    type,
    prompt: String(question?.prompt || "").trim(),
    description: String(question?.description || "").trim(),
    required: question?.required !== false,
    points: Math.max(0, Math.min(100, number(question?.points, 1))),
  };

  if (["multiple-choice", "checkboxes", "true-false"].includes(type)) {
    result.options = type === "true-false"
      ? ["True", "False"]
      : (Array.isArray(question?.options) ? question.options : [])
        .map((option) => String(option || "").trim())
        .filter(Boolean)
        .slice(0, 12);
  }
  if (["multiple-choice", "true-false"].includes(type)) {
    result.answerIndex = Math.max(0, Math.min(result.options.length - 1, number(question?.answerIndex)));
  }
  if (type === "checkboxes") {
    result.correctAnswers = [...new Set((question?.correctAnswers || [])
      .map((value) => number(value, -1))
      .filter((value) => value >= 0 && value < result.options.length))];
  }
  if (type === "short-answer") {
    result.acceptedAnswers = (Array.isArray(question?.acceptedAnswers) ? question.acceptedAnswers : [question?.acceptedAnswer])
      .map((answer) => String(answer || "").trim())
      .filter(Boolean)
      .slice(0, 10);
    result.caseSensitive = Boolean(question?.caseSensitive);
  }
  if (type === "paragraph") result.manualReview = true;
  return result;
}

function validateQuiz(quiz, publishing = false) {
  const title = String(quiz?.title || "").trim();
  if (!title) throw new Error("Add a quiz title before saving.");
  if (!quiz?.grade || !quiz?.section) throw new Error("Select an assigned Grade and Section.");
  const questions = (Array.isArray(quiz?.questions) ? quiz.questions : []).map(normalizeQuestion);
  if (!questions.length) throw new Error("Add at least one question.");
  if (publishing) {
    questions.forEach((question, index) => {
      if (!question.prompt) throw new Error(`Question ${index + 1} needs a question title.`);
      if (["multiple-choice", "checkboxes"].includes(question.type) && question.options.length < 2) {
        throw new Error(`Question ${index + 1} needs at least two answer options.`);
      }
      if (question.type === "checkboxes" && !question.correctAnswers.length) {
        throw new Error(`Select at least one correct answer for question ${index + 1}.`);
      }
      if (question.type === "short-answer" && !question.acceptedAnswers.length) {
        throw new Error(`Add an accepted answer for question ${index + 1}.`);
      }
    });
  }
  return questions;
}

async function activeTeacherProfile(teacherId) {
  const snapshot = await get(ref(database, `users/${teacherId}`));
  const profile = snapshot.exists() ? snapshot.val() : null;
  if (!profile || profile.role !== "teacher" || profile.status !== "active") {
    throw new Error("An active teacher account is required.");
  }
  return profile;
}

function publishedQuizRecord(record) {
  return clean({
    ...record,
    status: "published",
    publishedAt: record.publishedAt || Date.now(),
  });
}

export async function saveTeacherQuiz(teacherId, quiz, status = "draft") {
  if (!teacherId) throw new Error("Sign in again before saving the quiz.");
  if (!["draft", "published", "closed"].includes(status)) throw new Error("Invalid quiz status.");
  const profile = await activeTeacherProfile(teacherId);
  if (!teacherCanAccessClass(profile, quiz.grade, quiz.section)) {
    throw new Error("This Grade and Section is outside your administrator-assigned teaching scope.");
  }
  const targetClass = classFields(quiz.grade, quiz.section);
  const questions = validateQuiz(quiz, status === "published");
  const now = Date.now();
  const id = quiz.id || push(ref(database, "quizBank")).key;
  if (!id) throw new Error("A quiz ID could not be created.");

  let createdAt = now;
  if (quiz.id) {
    const existing = await get(ref(database, `quizBank/${quiz.id}`));
    if (!existing.exists() || existing.val().teacherId !== teacherId) {
      throw new Error("This quiz does not belong to your teacher account.");
    }
    createdAt = number(existing.val().createdAt, now);
  }

  const record = clean({
    id,
    teacherId,
    teacherName: profile.name || profile.email || "Jidanao Teacher",
    title: String(quiz.title || "").trim(),
    description: String(quiz.description || "").trim(),
    subject: String(quiz.subject || "General").trim(),
    gradingPeriod: String(quiz.gradingPeriod || GRADING_PERIODS[0]),
    schoolYear: String(quiz.schoolYear || "2026-2027").trim(),
    ...targetClass,
    status,
    questions,
    totalPoints: questions.reduce((sum, question) => sum + number(question.points), 0),
    settings: {
      collectEmail: true,
      shuffleQuestions: Boolean(quiz.settings?.shuffleQuestions),
      showScore: quiz.settings?.showScore !== false,
      showCorrectAnswers: Boolean(quiz.settings?.showCorrectAnswers),
      maxAttempts: Math.max(1, Math.min(5, number(quiz.settings?.maxAttempts, 1))),
      dueAt: String(quiz.settings?.dueAt || ""),
    },
    createdAt,
    updatedAt: now,
    ...(status === "published" ? { publishedAt: number(quiz.publishedAt, now) } : {}),
  });

  const changes = { [`quizBank/${id}`]: record };
  changes[`publishedQuizzes/${targetClass.classKey}/${id}`] = status === "published"
    ? publishedQuizRecord(record)
    : null;
  await update(ref(database), changes);
  return record;
}

export async function getTeacherQuiz(teacherId, quizId) {
  const snapshot = await get(ref(database, `quizBank/${quizId}`));
  if (!snapshot.exists()) throw new Error("Quiz not found.");
  const quiz = snapshot.val();
  if (quiz.teacherId !== teacherId) throw new Error("This quiz belongs to another teacher.");
  return { id: quizId, ...quiz };
}

export async function setTeacherQuizStatus(teacherId, quizId, status) {
  const quiz = await getTeacherQuiz(teacherId, quizId);
  return saveTeacherQuiz(teacherId, quiz, status);
}

export async function deleteTeacherQuiz(teacherId, quizId) {
  const quiz = await getTeacherQuiz(teacherId, quizId);
  await update(ref(database), {
    [`quizBank/${quizId}`]: null,
    [`publishedQuizzes/${quiz.classKey}/${quizId}`]: null,
  });
}

export function subscribePublishedQuizzes(classKey, onData, onError) {
  if (!classKey) {
    onData([]);
    return () => {};
  }
  return onValue(
    ref(database, `publishedQuizzes/${classKey}`),
    (snapshot) => onData(snapshot.exists()
      ? Object.entries(snapshot.val()).map(([id, quiz]) => ({ id, ...quiz }))
        .filter((quiz) => quiz.status === "published")
        .sort((a, b) => number(b.publishedAt) - number(a.publishedAt))
      : []),
    onError,
  );
}

export async function getPublishedQuiz(classKey, quizId) {
  const snapshot = await get(ref(database, `publishedQuizzes/${classKey}/${quizId}`));
  if (!snapshot.exists() || snapshot.val().status !== "published") throw new Error("This quiz is not available for your class.");
  return { id: quizId, ...snapshot.val() };
}

export async function getStudentQuizAttempts(quizId, studentUid) {
  const snapshot = await get(ref(database, `quizAttempts/${quizId}/${studentUid}`));
  return snapshot.exists()
    ? Object.entries(snapshot.val()).map(([id, value]) => ({ id, ...value })).sort((a, b) => number(b.submittedAt) - number(a.submittedAt))
    : [];
}

function normalizedText(value, caseSensitive = false) {
  const result = String(value ?? "").trim().replace(/\s+/g, " ");
  return caseSensitive ? result : result.toLowerCase();
}

function gradeQuestion(question, answer) {
  const points = number(question.points);
  if (question.type === "paragraph") return { earned: 0, correct: null, manual: true };
  if (question.type === "checkboxes") {
    const actual = [...new Set(Array.isArray(answer) ? answer.map(Number) : [])].sort((a, b) => a - b);
    const expected = [...new Set(question.correctAnswers || [])].map(Number).sort((a, b) => a - b);
    const correct = actual.length === expected.length && actual.every((value, index) => value === expected[index]);
    return { earned: correct ? points : 0, correct, manual: false };
  }
  if (["multiple-choice", "true-false"].includes(question.type)) {
    const correct = Number(answer) === Number(question.answerIndex);
    return { earned: correct ? points : 0, correct, manual: false };
  }
  const actual = normalizedText(answer, question.caseSensitive);
  const correct = (question.acceptedAnswers || []).some((expected) => normalizedText(expected, question.caseSensitive) === actual);
  return { earned: correct ? points : 0, correct, manual: false };
}

export async function submitQuizAttempt(quiz, answers) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Sign in again before submitting.");
  const profileSnapshot = await get(ref(database, `users/${currentUser.uid}`));
  const profile = profileSnapshot.exists() ? profileSnapshot.val() : null;
  if (!profile || profile.role !== "student" || profile.status !== "active" || profile.classKey !== quiz.classKey) {
    throw new Error("This quiz is not assigned to your class.");
  }
  const attempts = await getStudentQuizAttempts(quiz.id, currentUser.uid);
  const maxAttempts = number(quiz.settings?.maxAttempts, 1);
  if (attempts.length >= maxAttempts) throw new Error("You have already used all allowed attempts.");
  if (quiz.settings?.dueAt && Date.now() > new Date(quiz.settings.dueAt).getTime()) throw new Error("The due date for this quiz has passed.");

  const questions = quiz.questions || [];
  const missingRequired = questions.find((question) => question.required && (
    answers?.[question.id] === undefined
    || answers?.[question.id] === ""
    || (Array.isArray(answers?.[question.id]) && !answers[question.id].length)
  ));
  if (missingRequired) throw new Error("Answer every required question before submitting.");

  const grading = questions.map((question) => ({ questionId: question.id, ...gradeQuestion(question, answers?.[question.id]) }));
  const autoScore = grading.reduce((sum, result) => sum + result.earned, 0);
  const maxPoints = questions.reduce((sum, question) => sum + number(question.points), 0);
  const manualReviewRequired = grading.some((result) => result.manual);
  const scorePercent = maxPoints ? Math.round((autoScore / maxPoints) * 100) : 0;
  const now = Date.now();
  const attemptRef = push(ref(database, `quizAttempts/${quiz.id}/${currentUser.uid}`));
  const attempt = clean({
    id: attemptRef.key,
    quizId: quiz.id,
    quizTitle: quiz.title,
    studentUid: currentUser.uid,
    studentName: profile.name || currentUser.email || "Student",
    studentEmail: profile.email || currentUser.email || "",
    grade: profile.gradeLevel,
    section: profile.section,
    classKey: profile.classKey,
    answers,
    grading,
    autoScore,
    finalScore: autoScore,
    maxPoints,
    scorePercent,
    manualReviewRequired,
    status: manualReviewRequired ? "needs-review" : "graded",
    submittedAt: now,
  });
  await set(attemptRef, attempt);

  await runTransaction(ref(database, `progress/${currentUser.uid}`), (value) => {
    const root = value || {};
    const prior = root.quiz?.[quiz.id] || {};
    const summary = root.summary || {};
    const activityId = `quiz-${quiz.id}-${now}`;
    return {
      ...root,
      quiz: {
        ...(root.quiz || {}),
        [quiz.id]: {
          title: quiz.title,
          subject: quiz.subject,
          attempts: number(prior.attempts) + 1,
          latestScore: scorePercent,
          bestScore: Math.max(number(prior.bestScore), scorePercent),
          lastAttemptAt: now,
          status: manualReviewRequired ? "needs-review" : "graded",
        },
      },
      activity: {
        ...(root.activity || {}),
        [activityId]: {
          eventType: "standalone_quiz",
          contentType: "quiz",
          contentId: quiz.id,
          title: quiz.title,
          subject: quiz.subject,
          grade: profile.gradeLevel,
          status: manualReviewRequired ? "Submitted for review" : `Quiz ${scorePercent}%`,
          score: scorePercent,
          timestamp: now,
        },
      },
      summary: {
        ...summary,
        totalCorrectAnswers: number(summary.totalCorrectAnswers) + grading.filter((item) => item.correct).length,
        totalQuestions: number(summary.totalQuestions) + grading.filter((item) => !item.manual).length,
        bestQuizScore: Math.max(number(summary.bestQuizScore), scorePercent),
        updatedAt: now,
      },
    };
  });
  return attempt;
}

export async function getQuizAttemptsForTeacher(teacherId, quizId) {
  await getTeacherQuiz(teacherId, quizId);
  const snapshot = await get(ref(database, `quizAttempts/${quizId}`));
  if (!snapshot.exists()) return [];
  return Object.values(snapshot.val()).flatMap((studentAttempts) => Object.entries(studentAttempts || {})
    .map(([id, attempt]) => ({ id, ...attempt })))
    .sort((a, b) => number(b.submittedAt) - number(a.submittedAt));
}

export async function reviewQuizAttempt(teacherId, quizId, studentUid, attemptId, finalScore, feedback = "") {
  await getTeacherQuiz(teacherId, quizId);
  const attemptSnapshot = await get(ref(database, `quizAttempts/${quizId}/${studentUid}/${attemptId}`));
  if (!attemptSnapshot.exists()) throw new Error("Quiz response not found.");
  const attempt = attemptSnapshot.val();
  const score = Math.max(0, Math.min(number(attempt.maxPoints), number(finalScore)));
  await update(ref(database, `quizAttempts/${quizId}/${studentUid}/${attemptId}`), {
    finalScore: score,
    scorePercent: attempt.maxPoints ? Math.round((score / attempt.maxPoints) * 100) : 0,
    feedback: String(feedback || "").trim().slice(0, 1000),
    status: "reviewed",
    reviewedBy: teacherId,
    reviewedAt: Date.now(),
  });
}
