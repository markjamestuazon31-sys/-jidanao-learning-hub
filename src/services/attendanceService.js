import { get, ref, update } from "firebase/database";
import { database } from "../firebase/firebaseConfig";
import { classFields, teacherCanAccessClass } from "../data/schoolClasses";

export const ATTENDANCE_STATUSES = Object.freeze([
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "late", label: "Late" },
  { value: "excused", label: "Excused" },
]);

const VALID_STATUS = new Set(ATTENDANCE_STATUSES.map((item) => item.value));

function clean(value) {
  return JSON.parse(JSON.stringify(value));
}

export function attendanceDateKey(value = new Date()) {
  if (typeof value === "string") {
    const text = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Select a valid attendance date.");
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

async function readTeacher(teacherId) {
  if (!teacherId) throw new Error("Sign in again before recording attendance.");
  const snapshot = await get(ref(database, `users/${teacherId}`));
  const teacher = snapshot.exists() ? snapshot.val() : null;
  if (!teacher || teacher.role !== "teacher" || teacher.status !== "active") {
    throw new Error("An active teacher account is required.");
  }
  return teacher;
}

export async function getAttendanceForDate(classKey, date) {
  if (!classKey) return {};
  const snapshot = await get(ref(database, `attendance/${classKey}/${attendanceDateKey(date)}`));
  return snapshot.exists() ? snapshot.val() : {};
}

export async function getAttendanceForMonth(classKey, month) {
  if (!classKey) return {};
  const monthKey = String(month || "").slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(monthKey)) throw new Error("Select a valid attendance month.");
  const snapshot = await get(ref(database, `attendance/${classKey}`));
  if (!snapshot.exists()) return {};
  return Object.fromEntries(Object.entries(snapshot.val()).filter(([date]) => date.startsWith(monthKey)));
}

export async function saveAttendanceRegister({ teacherId, grade, section, date, schoolYear, students, entries }) {
  const teacher = await readTeacher(teacherId);
  if (!teacherCanAccessClass(teacher, grade, section)) {
    throw new Error("This Grade and Section is outside your administrator-assigned teaching scope.");
  }
  const targetClass = classFields(grade, section);
  const dateKey = attendanceDateKey(date);
  const existingSnapshot = await get(ref(database, `attendance/${targetClass.classKey}/${dateKey}`));
  const existing = existingSnapshot.exists() ? existingSnapshot.val() : {};
  const changes = {};
  const now = Date.now();

  students.forEach((student) => {
    if (student.gradeLevel !== targetClass.grade || student.section !== targetClass.section || student.classKey !== targetClass.classKey) {
      throw new Error(`${student.name || "A student"} is outside the selected class.`);
    }
    const entry = entries?.[student.uid] || {};
    if (!VALID_STATUS.has(entry.status)) {
      throw new Error(`Select an attendance status for ${student.name}.`);
    }
    const record = clean({
      id: `${dateKey}-${student.uid}`,
      studentUid: student.uid,
      studentName: student.name || student.email || "Student",
      studentEmail: student.email || "",
      teacherId,
      teacherName: teacher.name || teacher.email || "Teacher",
      ...targetClass,
      date: dateKey,
      schoolYear: String(schoolYear || "").trim(),
      status: entry.status,
      note: String(entry.note || "").trim().slice(0, 300),
      createdAt: existing?.[student.uid]?.createdAt || now,
      updatedAt: now,
    });
    changes[`attendance/${targetClass.classKey}/${dateKey}/${student.uid}`] = record;
  });

  await update(ref(database), changes);
  return { classKey: targetClass.classKey, date: dateKey, saved: students.length };
}

export function summarizeAttendance(records) {
  const values = Array.isArray(records)
    ? records
    : Object.values(records || {}).flatMap((day) => Object.values(day || {}));
  return values.reduce((summary, record) => {
    if (VALID_STATUS.has(record?.status)) summary[record.status] += 1;
    summary.total += 1;
    return summary;
  }, { present: 0, absent: 0, late: 0, excused: 0, total: 0 });
}

export function studentAttendanceSummary(monthRecords, studentUid) {
  const records = Object.values(monthRecords || {})
    .map((day) => day?.[studentUid])
    .filter(Boolean);
  return summarizeAttendance(records);
}
