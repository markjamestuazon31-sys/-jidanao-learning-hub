import { getDatabase } from "firebase-admin/database";
import { HttpsError } from "firebase-functions/v2/https";

export const STUDENT_GRADES = Object.freeze([
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
]);

const CONTENT_NODES = Object.freeze({
  lesson: "lessons",
  game: "games",
});

export function normalizeGradeLevel(value) {
  const text = String(value || "").trim();
  const match = text.match(/([3-6])/);
  return match ? `Grade ${match[1]}` : text;
}

export function isStudentGrade(value) {
  return STUDENT_GRADES.includes(normalizeGradeLevel(value));
}

function cleanText(value, maxLength = 500) {
  return String(value || "").trim().slice(0, maxLength);
}

export function requireId(value, label = "ID") {
  const id = cleanText(value, 160);
  if (!id || /[.#$\[\]/]/.test(id)) {
    throw new HttpsError("invalid-argument", `${label} is invalid.`);
  }
  return id;
}

export async function getUserProfile(uid) {
  const snapshot = await getDatabase().ref(`users/${uid}`).get();
  return snapshot.exists() ? snapshot.val() : null;
}

export async function requireActiveRole(request, allowedRoles) {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const userProfile = await getUserProfile(request.auth.uid);
  if (!userProfile) {
    throw new HttpsError(
      "failed-precondition",
      "Your LMS profile is missing. Complete your profile or contact an administrator.",
    );
  }

  if (userProfile.status !== "active") {
    throw new HttpsError(
      "permission-denied",
      "This LMS account is not active.",
    );
  }

  if (!allowedRoles.includes(userProfile.role)) {
    throw new HttpsError("permission-denied", "Insufficient role.");
  }

  if (userProfile.role === "student") {
    const gradeLevel = normalizeGradeLevel(userProfile.gradeLevel);
    if (!isStudentGrade(gradeLevel)) {
      throw new HttpsError(
        "failed-precondition",
        "A valid Grade 3–6 learner profile is required.",
      );
    }
    return { ...userProfile, gradeLevel };
  }

  return userProfile;
}

export async function requireLearningContent(request, type, contentId, options = {}) {
  const { roles = ["student"], publishedForStudents = true } = options;
  const userProfile = await requireActiveRole(request, roles);
  const node = CONTENT_NODES[type];
  if (!node) throw new HttpsError("invalid-argument", "Invalid learning content type.");

  const id = requireId(contentId, `${type} ID`);
  const snapshot = await getDatabase().ref(`${node}/${id}`).get();
  if (!snapshot.exists()) {
    throw new HttpsError("not-found", `${type === "game" ? "Game" : "Lesson"} not found.`);
  }

  const content = { id, type, ...snapshot.val() };
  const contentGrade = normalizeGradeLevel(content.grade || content.gradeLevel);

  if (userProfile.role === "student") {
    if (publishedForStudents && content.status !== "published") {
      throw new HttpsError(
        "permission-denied",
        "This learning activity is not published for students.",
      );
    }

    if (contentGrade !== userProfile.gradeLevel) {
      throw new HttpsError(
        "permission-denied",
        `This activity is assigned to ${contentGrade || "another grade"}, not ${userProfile.gradeLevel}.`,
      );
    }
  }

  return {
    userProfile,
    content: {
      ...content,
      grade: contentGrade,
    },
  };
}

export function assertStudentGrade(value, label = "grade") {
  const grade = normalizeGradeLevel(value);
  if (!isStudentGrade(grade)) {
    throw new HttpsError(
      "invalid-argument",
      `${label} must be Grade 3, Grade 4, Grade 5, or Grade 6.`,
    );
  }
  return grade;
}

export function cleanRequiredText(value, label, maxLength) {
  const text = cleanText(value, maxLength);
  if (!text) {
    throw new HttpsError("invalid-argument", `${label} is required.`);
  }
  return text;
}
