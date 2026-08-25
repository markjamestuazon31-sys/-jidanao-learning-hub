import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase/firebaseConfig";

const saveLessonCheckpointCallable = httpsCallable(functions, "saveLessonCheckpoint");
const recordLessonQuizAttemptCallable = httpsCallable(functions, "recordLessonQuizAttempt");
const completeLessonActivityCallable = httpsCallable(functions, "completeLessonActivity");
const recordGameResultCallable = httpsCallable(functions, "recordGameResult");

function progressError(error, fallback) {
  const code = String(error?.code || "").replace(/^functions\//, "");
  const message = error?.message || fallback;
  const normalized = new Error(message);
  normalized.name = "SecureProgressError";
  normalized.code = code || "unavailable";
  return normalized;
}

export async function saveLessonCheckpoint(lessonId, step) {
  try {
    const result = await saveLessonCheckpointCallable({ lessonId, step });
    return result.data;
  } catch (error) {
    throw progressError(error, "Lesson progress could not be saved securely.");
  }
}

export async function recordLessonQuizAttempt(lessonId, answers) {
  try {
    const result = await recordLessonQuizAttemptCallable({ lessonId, answers });
    return result.data;
  } catch (error) {
    throw progressError(error, "Quiz attempt could not be verified and saved.");
  }
}

export async function completeLessonActivity(lessonId, reflection) {
  try {
    const result = await completeLessonActivityCallable({ lessonId, reflection });
    return result.data;
  } catch (error) {
    throw progressError(error, "Lesson completion could not be verified and saved.");
  }
}

export async function recordGameResult(gameId, result = {}) {
  try {
    const response = await recordGameResultCallable({
      gameId,
      score: result.score,
      correctAnswers: result.correctAnswers,
      totalQuestions: result.totalQuestions,
      difficulty: result.difficulty,
      mode: result.mode,
      cameraWin: Boolean(result.cameraWin),
    });
    return response.data;
  } catch (error) {
    throw progressError(error, "Game result could not be verified and saved.");
  }
}
