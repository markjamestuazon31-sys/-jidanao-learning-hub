import { getDatabase } from "firebase-admin/database";
import { HttpsError } from "firebase-functions/v2/https";
import { gradeLessonQuiz } from "./src/learningContent.js";
import { normalizeGradeLevel, requireLearningContent } from "./security.js";

const MAX_ACTIVITY_EVENTS = 80;
const LESSON_STEPS = Object.freeze({
  overview: 10,
  learn: 30,
  examples: 50,
  practice: 70,
  quiz: 90,
  challenge: 99,
});

const GRADE_REWARDS = Object.freeze({
  "Grade 3": { lessonXp: 120, gameXp: 80 },
  "Grade 4": { lessonXp: 135, gameXp: 90 },
  "Grade 5": { lessonXp: 150, gameXp: 100 },
  "Grade 6": { lessonXp: 170, gameXp: 115 },
});

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cleanObject(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeSubjectMap(subjects) {
  if (!subjects || typeof subjects !== "object") return {};
  return Object.fromEntries(
    Object.entries(subjects).filter(([, enabled]) => Boolean(enabled)),
  );
}

function normalizeActivityMap(activity) {
  if (!activity || typeof activity !== "object") return {};
  return Object.fromEntries(
    Object.entries(activity).filter(([, event]) => event && typeof event === "object"),
  );
}

function appendActivityEvent(activity, eventId, event) {
  const next = {
    ...normalizeActivityMap(activity),
    [eventId]: cleanObject(event),
  };

  return Object.fromEntries(
    Object.entries(next)
      .sort(([, a], [, b]) => safeNumber(b.timestamp) - safeNumber(a.timestamp))
      .slice(0, MAX_ACTIVITY_EVENTS),
  );
}

function dateKey(timestamp = Date.now()) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function previousDateKey(timestamp = Date.now()) {
  const date = new Date(timestamp);
  date.setDate(date.getDate() - 1);
  return dateKey(date.getTime());
}

function updateStreak(summary, now) {
  const today = dateKey(now);
  if (summary.lastActiveDate === today) return summary;
  const currentStreak = summary.lastActiveDate === previousDateKey(now)
    ? safeNumber(summary.currentStreak) + 1
    : 1;
  return {
    ...summary,
    currentStreak,
    longestStreak: Math.max(safeNumber(summary.longestStreak), currentStreak),
    lastActiveDate: today,
  };
}

function eventKey(uid) {
  return getDatabase().ref(`progress/${uid}/activity`).push().key;
}

function cleanAnswers(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 20)
      .map(([key, answer]) => [String(key).slice(0, 160), String(answer ?? "").slice(0, 600)]),
  );
}

function calculateStars(score, maximumScore) {
  const percent = maximumScore > 0 ? (score / maximumScore) * 100 : 0;
  if (percent >= 85) return 3;
  if (percent >= 60) return 2;
  if (percent >= 30) return 1;
  return 0;
}

export async function saveLessonCheckpointSecure(request) {
  const { userProfile, content: lesson } = await requireLearningContent(
    request,
    "lesson",
    request.data?.lessonId,
    { roles: ["student"] },
  );
  const uid = request.auth.uid;
  const step = String(request.data?.step || "overview").trim().toLowerCase();
  if (!Object.hasOwn(LESSON_STEPS, step)) {
    throw new HttpsError("invalid-argument", "Invalid lesson step.");
  }

  const now = Date.now();
  const startEventId = eventKey(uid);
  const percent = LESSON_STEPS[step];
  const progressRef = getDatabase().ref(`progress/${uid}`);
  const transaction = await progressRef.transaction((current) => {
    const root = current || {};
    const existing = root.lesson?.[lesson.id] || {};
    const firstStart = !existing.startedAt;
    const summary = updateStreak(root.summary || {}, now);
    const nextActivity = firstStart && startEventId
      ? appendActivityEvent(root.activity, startEventId, {
          eventType: "lesson_started",
          contentType: "lesson",
          contentId: lesson.id,
          title: lesson.title || "Learning lesson",
          subject: lesson.subject || "General",
          grade: userProfile.gradeLevel,
          status: "Started lesson",
          timestamp: now,
        })
      : normalizeActivityMap(root.activity);

    return {
      ...root,
      lesson: {
        ...(root.lesson || {}),
        [lesson.id]: {
          ...existing,
          title: lesson.title || existing.title || "Learning lesson",
          subject: lesson.subject || existing.subject || "General",
          grade: userProfile.gradeLevel,
          startedAt: existing.startedAt || now,
          percent: Math.min(99, Math.max(safeNumber(existing.percent), percent)),
          currentStep: step,
          updatedAt: now,
        },
      },
      activity: nextActivity,
      summary: {
        ...summary,
        subjects: {
          ...normalizeSubjectMap(summary.subjects),
          [lesson.subject || "General"]: true,
        },
        updatedAt: now,
      },
    };
  });

  if (!transaction.committed) {
    throw new HttpsError("aborted", "Lesson progress could not be saved.");
  }

  return {
    lessonId: lesson.id,
    step,
    percent,
    updatedAt: now,
  };
}

export async function recordLessonQuizAttemptSecure(request) {
  const { userProfile, content: lesson } = await requireLearningContent(
    request,
    "lesson",
    request.data?.lessonId,
    { roles: ["student"] },
  );
  const answers = cleanAnswers(request.data?.answers);
  const graded = gradeLessonQuiz(lesson, answers);
  if (!graded.complete) {
    throw new HttpsError(
      "invalid-argument",
      `Answer every quiz question before submitting (${graded.answered}/${graded.total}).`,
    );
  }

  const uid = request.auth.uid;
  const now = Date.now();
  const attemptId = eventKey(uid);
  const progressRef = getDatabase().ref(`progress/${uid}`);
  const transaction = await progressRef.transaction((current) => {
    const root = current || {};
    const existing = root.lesson?.[lesson.id] || {};
    const summaryBase = updateStreak(root.summary || {}, now);
    const summary = {
      ...summaryBase,
      totalCorrectAnswers: safeNumber(summaryBase.totalCorrectAnswers) + graded.correct,
      totalQuestions: safeNumber(summaryBase.totalQuestions) + graded.total,
      bestQuizScore: Math.max(safeNumber(summaryBase.bestQuizScore), graded.score),
      subjects: {
        ...normalizeSubjectMap(summaryBase.subjects),
        [lesson.subject || "General"]: true,
      },
      updatedAt: now,
    };

    return {
      ...root,
      lesson: {
        ...(root.lesson || {}),
        [lesson.id]: {
          ...existing,
          title: lesson.title || existing.title || "Learning lesson",
          subject: lesson.subject || existing.subject || "General",
          grade: userProfile.gradeLevel,
          startedAt: existing.startedAt || now,
          quizAttempts: safeNumber(existing.quizAttempts) + 1,
          quizScore: graded.score,
          lastQuizScore: graded.score,
          lastQuizAttemptAt: now,
          bestQuizScore: Math.max(safeNumber(existing.bestQuizScore), graded.score),
          correctAnswers: safeNumber(existing.correctAnswers) + graded.correct,
          totalQuestions: safeNumber(existing.totalQuestions) + graded.total,
          updatedAt: now,
        },
      },
      activity: attemptId
        ? appendActivityEvent(root.activity, attemptId, {
            eventType: "lesson_quiz",
            contentType: "lesson",
            contentId: lesson.id,
            title: lesson.title || "Learning lesson",
            subject: lesson.subject || "General",
            grade: userProfile.gradeLevel,
            status: `Quiz ${graded.score}%`,
            score: graded.score,
            correctAnswers: graded.correct,
            totalQuestions: graded.total,
            timestamp: now,
          })
        : normalizeActivityMap(root.activity),
      summary,
    };
  });

  if (!transaction.committed) {
    throw new HttpsError("aborted", "Quiz attempt could not be saved.");
  }

  return {
    attemptId,
    score: graded.score,
    correct: graded.correct,
    total: graded.total,
    passed: graded.score >= 70,
    feedback: graded.feedback,
    saved: true,
  };
}

export async function completeLessonActivitySecure(request) {
  const { userProfile, content: lesson } = await requireLearningContent(
    request,
    "lesson",
    request.data?.lessonId,
    { roles: ["student"] },
  );
  const reflection = String(request.data?.reflection || "").trim().slice(0, 2000);
  if (reflection.length < 12) {
    throw new HttpsError(
      "invalid-argument",
      "Write a short learning reflection before completing the lesson.",
    );
  }

  const uid = request.auth.uid;
  const now = Date.now();
  const completionEventId = eventKey(uid);
  const baseXp = GRADE_REWARDS[userProfile.gradeLevel]?.lessonXp || 120;
  let awardedXp = 0;
  let verifiedQuizScore = 0;
  const progressRef = getDatabase().ref(`progress/${uid}`);
  const transaction = await progressRef.transaction((current) => {
    const root = current || {};
    const existing = root.lesson?.[lesson.id] || {};
    verifiedQuizScore = Math.max(
      safeNumber(existing.lastQuizScore),
      safeNumber(existing.bestQuizScore),
    );
    if (verifiedQuizScore < 70) return;

    const firstCompletion = !existing.completed;
    if (!firstCompletion) {
      awardedXp = 0;
      return root;
    }
    awardedXp = baseXp;
    const summaryBase = updateStreak(root.summary || {}, now);
    const summary = {
      ...summaryBase,
      totalXp: safeNumber(summaryBase.totalXp) + awardedXp,
      lessonsCompleted: safeNumber(summaryBase.lessonsCompleted) + 1,
      bestQuizScore: Math.max(safeNumber(summaryBase.bestQuizScore), verifiedQuizScore),
      subjects: {
        ...normalizeSubjectMap(summaryBase.subjects),
        [lesson.subject || "General"]: true,
      },
      updatedAt: now,
    };

    return {
      ...root,
      lesson: {
        ...(root.lesson || {}),
        [lesson.id]: {
          ...existing,
          title: lesson.title || existing.title || "Learning lesson",
          subject: lesson.subject || existing.subject || "General",
          grade: userProfile.gradeLevel,
          startedAt: existing.startedAt || now,
          completed: true,
          completedAt: existing.completedAt || now,
          percent: 100,
          currentStep: "challenge",
          reflection,
          reflectionUpdatedAt: now,
          xpEarned: safeNumber(existing.xpEarned) + awardedXp,
          updatedAt: now,
        },
      },
      activity: completionEventId
        ? appendActivityEvent(root.activity, completionEventId, {
            eventType: "lesson_completed",
            contentType: "lesson",
            contentId: lesson.id,
            title: lesson.title || "Learning lesson",
            subject: lesson.subject || "General",
            grade: userProfile.gradeLevel,
            status: "Lesson completed",
            score: verifiedQuizScore,
            xpEarned: awardedXp,
            timestamp: now,
          })
        : normalizeActivityMap(root.activity),
      summary,
    };
  });

  if (!transaction.committed) {
    if (verifiedQuizScore < 70) {
      throw new HttpsError(
        "failed-precondition",
        "A verified quiz score of at least 70% is required before completing this lesson.",
      );
    }
    throw new HttpsError("aborted", "Lesson completion could not be saved.");
  }

  return {
    lessonId: lesson.id,
    completed: true,
    quizScore: verifiedQuizScore,
    xpAwarded: awardedXp,
    totalXp: safeNumber(transaction.snapshot.val()?.summary?.totalXp),
    completedAt: transaction.snapshot.val()?.lesson?.[lesson.id]?.completedAt || now,
  };
}

export async function recordGameResultSecure(request) {
  const { userProfile, content: game } = await requireLearningContent(
    request,
    "game",
    request.data?.gameId,
    { roles: ["student"] },
  );

  const difficulty = Math.max(1, Math.min(3, Math.round(safeNumber(request.data?.difficulty, 1))));
  const mode = request.data?.mode === "camera" ? "camera" : "classic";
  const totalQuestions = Math.max(1, Math.min(20, Math.round(safeNumber(request.data?.totalQuestions, 10))));
  const correctAnswers = Math.max(
    0,
    Math.min(totalQuestions, Math.round(safeNumber(request.data?.correctAnswers))),
  );
  const maximumPlausibleScore = totalQuestions * 250;
  const score = Math.max(
    0,
    Math.min(maximumPlausibleScore, Math.round(safeNumber(request.data?.score))),
  );
  const stars = calculateStars(score, totalQuestions * 150);
  const subject = String(game.subject || "").toLocaleLowerCase();
  const cameraWin = Boolean(request.data?.cameraWin)
    && mode === "camera"
    && subject.includes("math")
    && correctAnswers > 0;

  const uid = request.auth.uid;
  const now = Date.now();
  const completionEventId = eventKey(uid);
  const gradeRewards = GRADE_REWARDS[userProfile.gradeLevel] || GRADE_REWARDS["Grade 3"];
  const baseXp = gradeRewards.gameXp + stars * 15 + difficulty * 10;
  let awardedXp = 0;
  const progressRef = getDatabase().ref(`progress/${uid}`);
  const transaction = await progressRef.transaction((current) => {
    const root = current || {};
    const existing = root.game?.[game.id] || {};
    const firstCompletion = !existing.completedAt;
    awardedXp = firstCompletion ? baseXp : Math.max(10, Math.round(baseXp * 0.35));
    const summaryBase = updateStreak(root.summary || {}, now);
    const summary = {
      ...summaryBase,
      totalXp: safeNumber(summaryBase.totalXp) + awardedXp,
      gameSessions: safeNumber(summaryBase.gameSessions) + 1,
      totalGameScore: safeNumber(summaryBase.totalGameScore) + score,
      totalCorrectAnswers: safeNumber(summaryBase.totalCorrectAnswers) + correctAnswers,
      totalQuestions: safeNumber(summaryBase.totalQuestions) + totalQuestions,
      cameraWins: safeNumber(summaryBase.cameraWins) + (cameraWin ? 1 : 0),
      subjects: {
        ...normalizeSubjectMap(summaryBase.subjects),
        [game.subject || "General"]: true,
      },
      updatedAt: now,
    };

    return {
      ...root,
      game: {
        ...(root.game || {}),
        [game.id]: {
          ...existing,
          title: game.title || existing.title || "Learning game",
          subject: game.subject || existing.subject || "General",
          grade: userProfile.gradeLevel,
          playCount: safeNumber(existing.playCount) + 1,
          gameSessions: safeNumber(existing.gameSessions) + 1,
          score,
          bestScore: Math.max(safeNumber(existing.bestScore), score),
          stars,
          bestStars: Math.max(safeNumber(existing.bestStars), stars),
          totalCorrect: safeNumber(existing.totalCorrect) + correctAnswers,
          totalQuestions: safeNumber(existing.totalQuestions) + totalQuestions,
          cameraWins: safeNumber(existing.cameraWins) + (cameraWin ? 1 : 0),
          xpEarned: safeNumber(existing.xpEarned) + awardedXp,
          completedAt: existing.completedAt || now,
          lastPlayedAt: now,
          lastMode: mode,
          lastDifficulty: difficulty,
          updatedAt: now,
        },
      },
      activity: completionEventId
        ? appendActivityEvent(root.activity, completionEventId, {
            eventType: "game_completed",
            contentType: "game",
            contentId: game.id,
            title: game.title || "Learning game",
            subject: game.subject || "General",
            grade: userProfile.gradeLevel,
            status: "Game completed",
            score,
            stars,
            xpEarned: awardedXp,
            cameraWin,
            mode,
            difficulty,
            timestamp: now,
          })
        : normalizeActivityMap(root.activity),
      summary,
    };
  });

  if (!transaction.committed) {
    throw new HttpsError("aborted", "Game result could not be saved.");
  }

  return {
    gameId: game.id,
    score,
    correct: correctAnswers,
    total: totalQuestions,
    stars,
    xpAwarded: awardedXp,
    cameraWin,
    totalXp: safeNumber(transaction.snapshot.val()?.summary?.totalXp),
    saved: true,
  };
}
