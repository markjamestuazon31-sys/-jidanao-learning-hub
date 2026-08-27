import { get, ref } from "firebase/database";
import { auth, database } from "../firebase/firebaseConfig";
import {
  normalizeAssignedClasses,
  normalizeSection,
  teacherCanAccessClass,
} from "../data/schoolClasses";
import { normalizeGradeLevel, normalizeProgress } from "./dataService";

function isStudentGrade(value) {
  const grade = normalizeGradeLevel(value);
  return Boolean(grade && grade !== "All Grades");
}

async function readStaffViewer() {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Sign in again to open the learner directory.");
  const snapshot = await get(ref(database, `users/${currentUser.uid}`));
  const viewer = snapshot.exists() ? snapshot.val() : null;
  if (!viewer || !["teacher", "admin"].includes(viewer.role) || viewer.status !== "active") {
    throw new Error("An active teacher or administrator account is required.");
  }
  return viewer;
}

async function studentUidsForViewer(viewer) {
  if (viewer.role === "admin" || viewer.teachingScope === "schoolwide") {
    const snapshot = await get(ref(database, "users"));
    if (!snapshot.exists()) return [];
    return Object.entries(snapshot.val())
      .filter(([, value]) => value?.role === "student")
      .map(([uid]) => uid);
  }

  const classes = Object.keys(normalizeAssignedClasses(viewer.assignedClasses, viewer));
  const rosterSnapshots = await Promise.all(
    classes.map((classKey) => get(ref(database, `classRosters/${classKey}`))),
  );
  return [...new Set(rosterSnapshots.flatMap((snapshot) => (
    snapshot.exists() ? Object.keys(snapshot.val()) : []
  )))];
}

async function readStudentRow(uid) {
  const [profileSnapshot, photoSnapshot] = await Promise.all([
    get(ref(database, `users/${uid}`)),
    get(ref(database, `profilePhotos/${uid}`)).catch(() => null),
  ]);
  if (!profileSnapshot.exists()) return null;
  const value = profileSnapshot.val();
  if (value?.role !== "student" || !isStudentGrade(value.gradeLevel)) return null;
  const photo = photoSnapshot?.exists?.() ? photoSnapshot.val() : {};
  return {
    uid,
    source: "account",
    accountType: "Student account",
    name: String(value.name || "").trim().slice(0, 120),
    email: String(value.email || "").trim().slice(0, 254),
    gradeLevel: normalizeGradeLevel(value.gradeLevel),
    section: normalizeSection(value.section, "Unassigned section"),
    classKey: value.classKey || "",
    status: value.status === "disabled" ? "disabled" : "active",
    createdAt: Number(value.createdAt || 0) || null,
    photoDataUrl: String(photo?.dataUrl || ""),
    photoUpdatedAt: Number(photo?.updatedAt || value.photoUpdatedAt || 0) || null,
  };
}

function sharedLearnerRows(classKey, node, viewer) {
  return Object.entries(node || {}).map(([id, value]) => ({
    uid: id,
    id,
    source: "shared-device",
    accountType: "Shared-device learner",
    name: String(value?.name || "").trim().slice(0, 120),
    email: "",
    learnerNumber: String(value?.learnerNumber || "").trim().slice(0, 40),
    gradeLevel: normalizeGradeLevel(value?.gradeLevel || value?.grade),
    section: normalizeSection(value?.section, "Unassigned section"),
    classKey: value?.classKey || classKey,
    status: value?.status === "archived" ? "archived" : "active",
    createdAt: Number(value?.createdAt || 0) || null,
    createdBy: String(value?.createdBy || ""),
    createdByName: String(value?.createdByName || "Teacher").trim().slice(0, 120),
    photoDataUrl: "",
    photoUpdatedAt: null,
    progress: {
      level: 1,
      totalXp: 0,
      lessonsCompleted: 0,
      gameSessions: 0,
      accuracyPercent: 0,
    },
  })).filter((student) => (
    student.name
    && student.classKey
    && (viewer.role === "admin" || (student.status === "active" && teacherCanAccessClass(viewer, student.gradeLevel, student.section)))
  ));
}

async function readSharedLearners(viewer) {
  try {
    if (viewer.role === "admin" || viewer.teachingScope === "schoolwide") {
      const snapshot = await get(ref(database, "classLearners"));
      if (!snapshot.exists()) return [];
      return Object.entries(snapshot.val()).flatMap(([classKey, node]) => sharedLearnerRows(classKey, node, viewer));
    }
    const classes = Object.keys(normalizeAssignedClasses(viewer.assignedClasses, viewer));
    const snapshots = await Promise.all(classes.map(async (classKey) => ({
      classKey,
      snapshot: await get(ref(database, `classLearners/${classKey}`)),
    })));
    return snapshots.flatMap(({ classKey, snapshot }) => (
      snapshot.exists() ? sharedLearnerRows(classKey, snapshot.val(), viewer) : []
    ));
  } catch (error) {
    const message = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
    if (message.includes("permission-denied") || message.includes("permission denied")) {
      console.warn("Shared-device learner rules are not deployed yet; showing registered accounts only.");
      return [];
    }
    throw error;
  }
}

async function readDirectory({ includeSharedDevice = false } = {}) {
  const viewer = await readStaffViewer();
  const uids = await studentUidsForViewer(viewer);
  const accountStudents = (await Promise.all(uids.map(readStudentRow)))
    .filter(Boolean)
    .filter((student) => viewer.role === "admin" || teacherCanAccessClass(viewer, student.gradeLevel, student.section));
  const sharedStudents = includeSharedDevice ? await readSharedLearners(viewer) : [];
  const students = [...accountStudents, ...sharedStudents];

  const progressRows = await Promise.all(accountStudents.map(async (student) => {
    try {
      const snapshot = await get(ref(database, `progress/${student.uid}`));
      return [student.uid, normalizeProgress(snapshot.exists() ? snapshot.val() : {})];
    } catch {
      return [student.uid, normalizeProgress({})];
    }
  }));
  const progressByUid = Object.fromEntries(progressRows);
  return students
    .map((student) => {
      const progress = progressByUid[student.uid] || normalizeProgress({});
      return {
        ...student,
        progress: {
          level: progress.summary.level,
          totalXp: progress.summary.totalXp,
          lessonsCompleted: progress.summary.lessonsCompleted,
          gameSessions: progress.summary.gameSessions,
          accuracyPercent: progress.summary.accuracyPercent,
        },
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getTeacherStudentDirectory(options = {}) {
  return readDirectory(options);
}

export async function getAdminStudentDirectory() {
  return readDirectory({ includeSharedDevice: true });
}
