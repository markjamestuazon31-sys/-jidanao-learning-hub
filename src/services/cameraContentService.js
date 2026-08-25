import { get, ref, update } from "firebase/database";
import { auth, database } from "../firebase/firebaseConfig";
import { classFields, teacherCanAccessClass } from "../data/schoolClasses";
import { getLearningWeek } from "../utils/gameEngine";

export const CAMERA_TRACKS = Object.freeze({
  math: {
    id: "math",
    label: "Camera Math",
    subject: "Mathematics",
  },
  english: {
    id: "english",
    label: "English Camera Reading",
    subject: "English",
  },
});

export const CAMERA_LEVELS = Object.freeze(
  Array.from({ length: 10 }, (_, index) => index + 1),
);

export const CAMERA_LEVEL_FOCUS = Object.freeze({
  math: [
    "Foundation skills and clear one-step solving",
    "Accuracy and number fluency",
    "Applying operations in familiar situations",
    "Multi-step thinking and checking work",
    "Models, patterns, and representations",
    "Word problems and choosing a strategy",
    "Mixed operations and efficient solutions",
    "Reasoning with unfamiliar problems",
    "Integrated challenge and explanation",
    "Independent mastery and transfer",
  ],
  english: [
    "Word accuracy and confident oral reading",
    "Phrasing and natural pauses",
    "Punctuation, pace, and expression",
    "Vocabulary in meaningful sentences",
    "Fluency across connected ideas",
    "Main idea and supporting detail",
    "Cause, effect, sequence, and inference",
    "Academic language and complex sentences",
    "Critical reading with expressive delivery",
    "Independent mastery and communication",
  ],
});

const ITEMS_PER_LEVEL = 10;

function text(value, limit = 600) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, limit);
}

function integer(value, fallback, minimum, maximum) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, parsed));
}

function clean(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createEmptyCameraItems(track = "math") {
  return Array.from({ length: ITEMS_PER_LEVEL }, (_, index) => (
    track === "english"
      ? {
          id: `item-${index + 1}`,
          readingText: "",
          coachingTip: "",
          skill: "Reading fluency",
          passAccuracy: 70,
        }
      : {
          id: `item-${index + 1}`,
          prompt: "",
          answer: "",
          choices: ["", "", "", ""],
          explanation: "",
          skill: "Problem solving",
        }
  ));
}

function normalizeMathItem(item, index) {
  const answer = text(item?.answer, 80);
  const choices = Array.isArray(item?.choices)
    ? item.choices.slice(0, 4).map((choice) => text(choice, 80))
    : [];
  while (choices.length < 4) choices.push("");
  return {
    id: `item-${index + 1}`,
    prompt: text(item?.prompt, 400),
    answer,
    choices,
    explanation: text(item?.explanation, 600),
    skill: text(item?.skill, 100) || "Problem solving",
  };
}

function normalizeReadingItem(item, index) {
  return {
    id: `item-${index + 1}`,
    readingText: text(item?.readingText || item?.prompt, 700),
    coachingTip: text(item?.coachingTip || item?.explanation, 400),
    skill: text(item?.skill, 100) || "Reading fluency",
    passAccuracy: integer(item?.passAccuracy, 70, 55, 95),
  };
}

export function normalizeCameraItems(items, track = "math") {
  const source = Array.isArray(items) ? items : [];
  return Array.from({ length: ITEMS_PER_LEVEL }, (_, index) => (
    track === "english"
      ? normalizeReadingItem(source[index], index)
      : normalizeMathItem(source[index], index)
  ));
}

export function validateCameraItems(items, track = "math") {
  const normalized = normalizeCameraItems(items, track);
  const errors = [];
  normalized.forEach((item, index) => {
    if (track === "english") {
      if (item.readingText.split(/\s+/).filter(Boolean).length < 3) {
        errors.push(`Reading item ${index + 1} needs at least three words.`);
      }
      if (!item.coachingTip) errors.push(`Reading item ${index + 1} needs a coaching tip.`);
      return;
    }
    if (!item.prompt) errors.push(`Math item ${index + 1} needs a problem.`);
    if (!item.answer) errors.push(`Math item ${index + 1} needs a correct answer.`);
    if (item.choices.some((choice) => !choice)) errors.push(`Math item ${index + 1} needs four answer choices.`);
    if (new Set(item.choices.map((choice) => choice.toLowerCase())).size !== 4) {
      errors.push(`Math item ${index + 1} must use four different choices.`);
    }
    if (!item.choices.some((choice) => choice.toLowerCase() === item.answer.toLowerCase())) {
      errors.push(`Math item ${index + 1} must include the correct answer among its choices.`);
    }
    if (!item.explanation) errors.push(`Math item ${index + 1} needs a solution explanation.`);
  });
  const signatures = normalized.map((item) => text(
    track === "english" ? item.readingText : item.prompt,
    700,
  ).toLowerCase()).filter(Boolean);
  if (new Set(signatures).size !== signatures.length) {
    errors.push("Every activity in this level must use a different problem or reading passage.");
  }
  return { valid: errors.length === 0, errors, items: normalized };
}

function programPath(classKey, track, level) {
  return `${classKey}/${track}/level-${level}`;
}

function normalizeProgram(record, fallback = {}) {
  if (!record || typeof record !== "object") return null;
  const track = record.track === "english" ? "english" : "math";
  const level = integer(record.level, fallback.level || 1, 1, 10);
  return {
    ...record,
    track,
    level,
    title: text(record.title, 120),
    competency: text(record.competency, 600),
    instructions: text(record.instructions, 600),
    questions: normalizeCameraItems(record.questions, track),
  };
}

export async function getTeacherCameraPrograms(profile) {
  const assignments = Object.entries(profile?.assignedClasses || {})
    .filter(([, enabled]) => Boolean(enabled))
    .map(([classKey]) => classKey);
  if (!assignments.length && profile?.teachingScope !== "schoolwide") return [];

  const classKeys = profile?.teachingScope === "schoolwide"
    ? ["grade-3__section-1", "grade-3__section-2", "grade-3__section-3", "grade-3__section-4", "grade-3__section-5", "grade-3__section-6",
        "grade-4__section-1", "grade-4__section-2", "grade-4__section-3", "grade-4__section-4", "grade-4__section-5", "grade-4__section-6",
        "grade-5__section-1", "grade-5__section-2", "grade-5__section-3", "grade-5__section-4", "grade-5__section-5", "grade-5__section-6",
        "grade-6__section-1", "grade-6__section-2", "grade-6__section-3", "grade-6__section-4", "grade-6__section-5", "grade-6__section-6"]
    : assignments;
  const snapshots = await Promise.all(
    classKeys.map(async (classKey) => ({ classKey, snapshot: await get(ref(database, `cameraPrograms/${classKey}`)) })),
  );
  return snapshots.flatMap(({ classKey, snapshot }) => {
    if (!snapshot.exists()) return [];
    const classNode = snapshot.val();
    return Object.entries(classNode).flatMap(([track, levels]) =>
      Object.entries(levels || {}).map(([levelKey, record]) => normalizeProgram(record, {
        classKey,
        track,
        level: Number(levelKey.replace(/\D/g, "")) || 1,
      })),
    ).filter(Boolean);
  }).sort((left, right) => Number(right.updatedAt || 0) - Number(left.updatedAt || 0));
}

export async function saveTeacherCameraProgram(teacherProfile, input) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Sign in again before saving camera content.");
  const teacherSnapshot = await get(ref(database, `users/${currentUser.uid}`));
  const serverProfile = teacherSnapshot.exists() ? teacherSnapshot.val() : teacherProfile;
  if (!teacherCanAccessClass(serverProfile, input?.grade, input?.section)) {
    throw new Error("This grade and section is outside your administrator-assigned teaching scope.");
  }

  const track = input?.track === "english" ? "english" : "math";
  const level = integer(input?.level, 1, 1, 10);
  const status = input?.status === "published" ? "published" : "draft";
  const validation = validateCameraItems(input?.questions, track);
  if (status === "published" && !validation.valid) throw new Error(validation.errors[0]);
  const targetClass = classFields(input.grade, input.section);
  const relativePath = programPath(targetClass.classKey, track, level);
  const [existingSnapshot, trackSnapshot] = await Promise.all([
    get(ref(database, `cameraPrograms/${relativePath}`)),
    get(ref(database, `cameraPrograms/${targetClass.classKey}/${track}`)),
  ]);
  const existing = existingSnapshot.exists() ? existingSnapshot.val() : {};
  if (status === "published" && trackSnapshot.exists()) {
    const currentSignatures = new Set(validation.items.map((item) => text(
      track === "english" ? item.readingText : item.prompt,
      700,
    ).toLowerCase()).filter(Boolean));
    const duplicate = Object.entries(trackSnapshot.val()).find(([levelKey, program]) => {
      if (levelKey === `level-${level}` || !program?.questions) return false;
      return normalizeCameraItems(program.questions, track).some((item) => currentSignatures.has(text(
        track === "english" ? item.readingText : item.prompt,
        700,
      ).toLowerCase()));
    });
    if (duplicate) {
      throw new Error(`This level repeats content already used in Level ${Number(duplicate[0].replace(/\D/g, ""))}. Use different learning activities for every level.`);
    }
  }
  const now = Date.now();
  const week = getLearningWeek();
  const record = clean({
    ...targetClass,
    track,
    subject: CAMERA_TRACKS[track].subject,
    level,
    title: text(input.title, 120) || `${CAMERA_TRACKS[track].label} · Level ${level}`,
    competency: text(input.competency, 600),
    instructions: text(input.instructions, 600),
    questions: validation.items,
    status,
    teacherId: currentUser.uid,
    teacherName: text(serverProfile?.name || teacherProfile?.name || "Jidanao teacher", 100),
    weekKey: track === "math" ? week.key : "ongoing",
    weekLabel: track === "math" ? week.label : "Ongoing reading practice",
    createdAt: Number(existing.createdAt || now),
    updatedAt: now,
    ...(status === "published" ? { publishedAt: now } : {}),
  });

  await update(ref(database), {
    [`cameraPrograms/${relativePath}`]: record,
    [`cameraPublished/${relativePath}`]: status === "published" ? record : null,
  });
  return normalizeProgram(record);
}

export async function getPublishedCameraProgramsForStudent(profile) {
  const classKey = text(profile?.classKey, 80);
  if (!classKey) return [];
  const snapshot = await get(ref(database, `cameraPublished/${classKey}`));
  if (!snapshot.exists()) return [];
  const classNode = snapshot.val();
  return Object.entries(classNode).flatMap(([track, levels]) =>
    Object.entries(levels || {}).map(([levelKey, record]) => normalizeProgram(record, {
      classKey,
      track,
      level: Number(levelKey.replace(/\D/g, "")) || 1,
    })),
  ).filter((program) => program?.status === "published");
}

export function cameraProgramQuestions(program) {
  if (!program) return [];
  const track = program.track === "english" ? "english" : "math";
  return normalizeCameraItems(program.questions, track).map((item, index) => (
    track === "english"
      ? {
          id: `${program.classKey}-${track}-level-${program.level}-${index + 1}`,
          prompt: "Read this aloud",
          readingText: item.readingText,
          answer: item.readingText,
          choices: [],
          explanation: item.coachingTip,
          skill: item.skill,
          language: "english",
          level: program.level,
          passAccuracy: item.passAccuracy,
        }
      : {
          id: `${program.classKey}-${track}-level-${program.level}-${index + 1}`,
          prompt: item.prompt,
          answer: item.answer,
          choices: item.choices,
          explanation: item.explanation,
          skill: item.skill,
          level: program.level,
        }
  ));
}

function parseJsonItems(source, track) {
  try {
    const parsed = JSON.parse(source);
    const items = Array.isArray(parsed) ? parsed : parsed?.questions;
    return Array.isArray(items) ? normalizeCameraItems(items, track) : null;
  } catch {
    return null;
  }
}

export function importCameraItemsFromText(sourceText, track = "math") {
  const source = String(sourceText || "").trim();
  if (!source) throw new Error("The imported document does not contain readable text.");
  const jsonItems = parseJsonItems(source, track);
  if (jsonItems) return jsonItems;

  if (track === "english") {
    const sentences = source
      .split(/\n+|(?<=[.!?])\s+/)
      .map((value) => text(value, 700))
      .filter((value) => value.split(/\s+/).length >= 3)
      .slice(0, ITEMS_PER_LEVEL);
    if (sentences.length < ITEMS_PER_LEVEL) {
      throw new Error("The document needs at least 10 complete English sentences or passages.");
    }
    return sentences.map((readingText, index) => ({
      id: `item-${index + 1}`,
      readingText,
      coachingTip: "Read clearly, pause at punctuation, and use natural expression.",
      skill: "Accuracy and fluency",
      passAccuracy: 70,
    }));
  }

  const rows = source.split(/\n+/).map((value) => value.trim()).filter(Boolean);
  const parsed = rows.map((row, index) => {
    const columns = row.split(/\s*[|\t]\s*/);
    if (columns.length < 7) return null;
    return normalizeMathItem({
      prompt: columns[0],
      answer: columns[1],
      choices: columns.slice(2, 6),
      explanation: columns.slice(6).join(" "),
      skill: `Teacher skill ${index + 1}`,
    }, index);
  }).filter(Boolean).slice(0, ITEMS_PER_LEVEL);
  if (parsed.length < ITEMS_PER_LEVEL) {
    throw new Error("For Math, add 10 lines in this format: problem | answer | choice A | choice B | choice C | choice D | solution.");
  }
  return parsed;
}
