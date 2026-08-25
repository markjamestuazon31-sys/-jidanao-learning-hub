import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import OpenAI from "openai";
import { approvedLessonContext, studentLessonPayload } from "./learningContent.js";
import {
  completeLessonActivitySecure,
  recordGameResultSecure,
  recordLessonQuizAttemptSecure,
  saveLessonCheckpointSecure,
} from "./progressService.js";
import {
  assertStudentGrade,
  cleanRequiredText,
  isStudentGrade,
  normalizeGradeLevel,
  requireActiveRole,
  requireLearningContent,
} from "./security.js";

initializeApp();

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
const region = "asia-southeast1";

export const createTeacher = onCall({ region }, async (request) => {
  const adminProfile = await requireActiveRole(request, ["admin"]);

  const name = cleanRequiredText(request.data?.name, "Name", 120);
  const email = cleanRequiredText(request.data?.email, "Email", 254).toLowerCase();
  const password = String(request.data?.password || "");
  const employeeId = String(request.data?.employeeId || "").trim().toUpperCase().slice(0, 40);
  if (password.length < 10 || password.length > 128) {
    throw new HttpsError(
      "invalid-argument",
      "A 10–128 character temporary password is required.",
    );
  }
  if (
    !/[a-z]/.test(password)
    || !/[A-Z]/.test(password)
    || !/\d/.test(password)
    || !/[^A-Za-z0-9]/.test(password)
  ) {
    throw new HttpsError(
      "invalid-argument",
      "The temporary password must include uppercase, lowercase, numeric, and symbol characters.",
    );
  }

  if (employeeId) {
    const duplicate = await getDatabase()
      .ref("users")
      .orderByChild("employeeId")
      .equalTo(employeeId)
      .get();
    if (duplicate.exists()) {
      throw new HttpsError(
        "already-exists",
        `Employee ID ${employeeId} is already assigned to another account.`,
      );
    }
  }

  let user = null;
  try {
    user = await getAuth().createUser({
      email,
      password,
      displayName: name,
      emailVerified: false,
      disabled: false,
    });

    const now = Date.now();
    const teacherProfile = {
      uid: user.uid,
      name,
      email,
      employeeId,
      role: "teacher",
      status: "active",
      gradeLevel: "All Grades",
      subject: "All Subjects",
      teachingScope: "schoolwide",
      permissions: {
        createLessons: true,
        createGames: true,
        createQuizzes: true,
        manageOwnContent: true,
        viewStudentProgress: true,
      },
      mustChangePassword: true,
      accountSource: "admin-cloud-function",
      createdBy: adminProfile.uid || request.auth.uid,
      createdAt: now,
      updatedAt: now,
    };

    await getDatabase().ref(`users/${user.uid}`).set(teacherProfile);
    return { profile: teacherProfile };
  } catch (error) {
    if (user?.uid) {
      try {
        await getAuth().deleteUser(user.uid);
      } catch (rollbackError) {
        console.error("Unable to roll back teacher Auth account:", rollbackError);
      }
    }

    if (error instanceof HttpsError) throw error;
    if (error?.code === "auth/email-already-exists") {
      throw new HttpsError(
        "already-exists",
        "This email already has a Firebase Authentication account.",
      );
    }
    if (error?.code === "auth/invalid-email") {
      throw new HttpsError("invalid-argument", "Enter a valid teacher email address.");
    }

    console.error("Teacher provisioning failed:", error);
    throw new HttpsError(
      "internal",
      "Teacher account creation could not be completed safely.",
    );
  }
});


export const listStudentDirectory = onCall({ region }, async (request) => {
  const viewer = await requireActiveRole(request, ["teacher", "admin"]);
  const snapshot = await getDatabase()
    .ref("users")
    .orderByChild("role")
    .equalTo("student")
    .get();

  if (!snapshot.exists()) return { students: [] };

  const students = Object.entries(snapshot.val())
    .map(([uid, value]) => {
      const gradeLevel = normalizeGradeLevel(value?.gradeLevel);
      const expectedPhotoPath = `profilePhotos/${uid}/avatar`;
      return {
        uid,
        name: String(value?.name || "").trim().slice(0, 120),
        email: String(value?.email || "").trim().slice(0, 254),
        gradeLevel,
        status: value?.status === "disabled" ? "disabled" : "active",
        photoPath: value?.photoPath === expectedPhotoPath ? expectedPhotoPath : null,
        photoUpdatedAt: Number(value?.photoUpdatedAt || 0) || null,
        createdAt: Number(value?.createdAt || 0) || null,
      };
    })
    .filter((student) => isStudentGrade(student.gradeLevel))
    .filter((student) => {
      if (viewer.role !== "teacher") return true;
      if (viewer.teachingScope === "schoolwide" || viewer.gradeLevel === "All Grades") return true;
      return student.gradeLevel === viewer.gradeLevel;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return { students };
});

export const getLearningContent = onCall({ region }, async (request) => {
  const type = request.data?.type === "game" ? "game" : request.data?.type === "lesson" ? "lesson" : null;
  if (!type) {
    throw new HttpsError("invalid-argument", "Learning content type must be lesson or game.");
  }

  const { content, userProfile } = await requireLearningContent(
    request,
    type,
    request.data?.contentId,
    { roles: ["student", "teacher", "admin"] },
  );

  const safeContent = userProfile.role === "student" && type === "lesson"
    ? studentLessonPayload(content)
    : content;

  return {
    content: safeContent,
    access: {
      role: userProfile.role,
      gradeLevel: userProfile.role === "student" ? userProfile.gradeLevel : null,
      protected: true,
    },
  };
});

export const generateLesson = onCall(
  { region, secrets: [OPENAI_API_KEY], timeoutSeconds: 120 },
  async (request) => {
    await requireActiveRole(request, ["teacher"]);

    const grade = assertStudentGrade(request.data?.grade, "Grade");
    const subject = cleanRequiredText(request.data?.subject, "Subject", 120);
    const competency = cleanRequiredText(request.data?.competency, "Competency", 800);
    const lessonPlan = cleanRequiredText(request.data?.lessonPlan, "Teacher notes", 12000);

    const client = new OpenAI({ apiKey: OPENAI_API_KEY.value() });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.6",
      input: [
        {
          role: "system",
          content:
            "You are an elementary instructional design assistant. Produce age-appropriate, original, teacher-reviewable learning material. Do not copy copyrighted textbook passages. Return strict JSON only.",
        },
        {
          role: "user",
          content: [
            `Grade: ${grade}`,
            `Subject: ${subject}`,
            `Competency: ${competency}`,
            `Teacher notes: ${lessonPlan}`,
            "Return JSON with keys title, summary, learningObjectives (3-5 strings), discussion (concise but complete), activities (array of objects with title and instructions), practice (2 objects: question, choices array of 4, answerIndex integer 0-3, rationale), quiz (5 DIFFERENT objects that do not repeat the practice questions: question, choices array of 4, answerIndex integer 0-3, rationale), games (2 objects: title, mechanic, learningGoal).",
          ].join("\n"),
        },
      ],
      text: { format: { type: "json_object" } },
    });

    try {
      return JSON.parse(response.output_text);
    } catch (error) {
      console.error("AI lesson JSON parsing failed:", error);
      throw new HttpsError("internal", "AI returned invalid structured content.");
    }
  },
);

export const learningAssistant = onCall(
  { region, secrets: [OPENAI_API_KEY], timeoutSeconds: 60 },
  async (request) => {
    const question = cleanRequiredText(request.data?.question, "Question", 1000);
    const { content: lesson, userProfile } = await requireLearningContent(
      request,
      "lesson",
      request.data?.lessonId,
      { roles: ["student", "teacher", "admin"] },
    );

    const context = approvedLessonContext(lesson);
    if (!context) {
      throw new HttpsError(
        "failed-precondition",
        "This lesson does not contain enough approved material for the assistant.",
      );
    }

    const client = new OpenAI({ apiKey: OPENAI_API_KEY.value() });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.6",
      input: [
        {
          role: "system",
          content: [
            "You are a supportive elementary learning assistant.",
            "Answer only from the teacher-approved lesson context below.",
            "Do not reveal assessment answer keys or invent facts not present in the approved material.",
            "If the answer is not supported by the lesson context, say the student should review the lesson or ask the teacher.",
            `Use language appropriate for ${lesson.grade || userProfile.gradeLevel || "elementary students"}.`,
          ].join(" "),
        },
        {
          role: "user",
          content: `Approved lesson context:\n${context}\n\nLearner question: ${question}`,
        },
      ],
      max_output_tokens: 500,
    });

    return { answer: String(response.output_text || "").trim() };
  },
);

/**
 * Student progress callables.
 *
 * All authoritative student XP, quiz scores, lesson completions and game
 * result writes now happen through the Admin SDK after the authenticated
 * student's active role and grade are verified against the stored content.
 */
export const saveLessonCheckpoint = onCall(
  { region },
  saveLessonCheckpointSecure,
);

export const recordLessonQuizAttempt = onCall(
  { region },
  recordLessonQuizAttemptSecure,
);

export const completeLessonActivity = onCall(
  { region },
  completeLessonActivitySecure,
);

export const recordGameResult = onCall(
  { region },
  recordGameResultSecure,
);
