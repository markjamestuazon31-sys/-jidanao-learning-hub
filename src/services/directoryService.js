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

async function readDirectory() {
  const viewer = await readStaffViewer();
  const uids = await studentUidsForViewer(viewer);
  const students = (await Promise.all(uids.map(readStudentRow)))
    .filter(Boolean)
    .filter((student) => viewer.role === "admin" || teacherCanAccessClass(viewer, student.gradeLevel, student.section));

  const progressRows = await Promise.all(students.map(async (student) => {
    try {
      const snapshot = await get(ref(database, `progress/${student.uid}`));
      return [student.uid, normalizeProgress(snapshot.exists() ? snapshot.val() : {})];
    } catch {
      return [student.uid, normalizeProgress({})];
    }
  }));
  const progressByUid = Object.fromEntries(progressRows);
  return students
    .map((student) => ({
      ...student,
      progress: {
        level: progressByUid[student.uid].summary.level,
        totalXp: progressByUid[student.uid].summary.totalXp,
        lessonsCompleted: progressByUid[student.uid].summary.lessonsCompleted,
        gameSessions: progressByUid[student.uid].summary.gameSessions,
        accuracyPercent: progressByUid[student.uid].summary.accuracyPercent,
      },
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getTeacherStudentDirectory() {
  return readDirectory();
}

export async function getAdminStudentDirectory() {
  return readDirectory();
}
