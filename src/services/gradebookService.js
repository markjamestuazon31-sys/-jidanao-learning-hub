import { get, ref, update } from "firebase/database";
import { database } from "../firebase/firebaseConfig";
import { classFields, teacherCanAccessClass } from "../data/schoolClasses";

function safeKey(value, prefix = "key") {
  const key = String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${prefix}-${key || "unspecified"}`;
}

function number(value, fallback = 0) {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function clean(value) {
  return JSON.parse(JSON.stringify(value));
}

export function gradeRemark(score) {
  const value = number(score);
  if (value >= 90) return "Outstanding";
  if (value >= 85) return "Very Satisfactory";
  if (value >= 80) return "Satisfactory";
  if (value >= 75) return "Fairly Satisfactory";
  return "Did Not Meet Expectations";
}

export function gradePathKeys(schoolYear, gradingPeriod, subject) {
  return {
    schoolYearKey: safeKey(schoolYear, "sy"),
    periodKey: safeKey(gradingPeriod, "period"),
    subjectKey: safeKey(subject, "subject"),
  };
}

async function teacherAndStudent(teacherId, studentUid) {
  const [teacherSnapshot, studentSnapshot] = await Promise.all([
    get(ref(database, `users/${teacherId}`)),
    get(ref(database, `users/${studentUid}`)),
  ]);
  if (!teacherSnapshot.exists() || !studentSnapshot.exists()) throw new Error("Teacher or student profile was not found.");
  const teacher = teacherSnapshot.val();
  const student = studentSnapshot.val();
  if (teacher.role !== "teacher" || teacher.status !== "active") throw new Error("An active teacher account is required.");
  if (student.role !== "student" || !teacherCanAccessClass(teacher, student.gradeLevel, student.section)) {
    throw new Error("This student is outside your assigned Grade and Section.");
  }
  return { teacher, student };
}

function recordPaths(teacherId, studentUid, context) {
  const keys = gradePathKeys(context.schoolYear, context.gradingPeriod, context.subject);
  const suffix = `${studentUid}/${keys.schoolYearKey}/${keys.periodKey}/${keys.subjectKey}`;
  return {
    ...keys,
    draft: `gradeDrafts/${teacherId}/${suffix}`,
    released: `grades/${suffix}`,
  };
}

export async function getGradebookRows(teacherId, students, context) {
  const paths = gradePathKeys(context.schoolYear, context.gradingPeriod, context.subject);
  return Promise.all(students.map(async (student) => {
    const [draftSnapshot, releasedSnapshot] = await Promise.all([
      get(ref(database, `gradeDrafts/${teacherId}/${student.uid}/${paths.schoolYearKey}/${paths.periodKey}/${paths.subjectKey}`)),
      get(ref(database, `grades/${student.uid}/${paths.schoolYearKey}/${paths.periodKey}/${paths.subjectKey}`)),
    ]);
    const draft = draftSnapshot.exists() ? draftSnapshot.val() : null;
    const released = releasedSnapshot.exists() ? releasedSnapshot.val() : null;
    const current = draft || released;
    return {
      ...student,
      score: current?.score ?? "",
      remarks: current?.remarks || "",
      teacherComment: current?.teacherComment || "",
      gradeStatus: draft ? "draft" : released ? "released" : "not-encoded",
      updatedAt: current?.updatedAt || current?.releasedAt || 0,
    };
  }));
}

function gradeRecord(teacherId, teacher, studentUid, student, context, score, teacherComment, status) {
  const numericScore = number(score, -1);
  if (numericScore < 60 || numericScore > 100) throw new Error("Enter a grade from 60 to 100.");
  const targetClass = classFields(student.gradeLevel, student.section);
  return clean({
    studentUid,
    studentName: student.name || student.email || "Student",
    teacherId,
    teacherName: teacher.name || teacher.email || "Teacher",
    ...targetClass,
    schoolYear: String(context.schoolYear || "").trim(),
    gradingPeriod: String(context.gradingPeriod || "").trim(),
    subject: String(context.subject || "").trim(),
    score: numericScore,
    remarks: gradeRemark(numericScore),
    teacherComment: String(teacherComment || "").trim().slice(0, 500),
    status,
    updatedAt: Date.now(),
    ...(status === "released" ? { releasedAt: Date.now() } : {}),
  });
}

export async function saveGradeDraft(teacherId, studentUid, context, score, teacherComment = "") {
  const { teacher, student } = await teacherAndStudent(teacherId, studentUid);
  const paths = recordPaths(teacherId, studentUid, context);
  const record = gradeRecord(teacherId, teacher, studentUid, student, context, score, teacherComment, "draft");
  await update(ref(database), { [paths.draft]: record });
  return record;
}

export async function releaseStudentGrade(teacherId, studentUid, context, score, teacherComment = "") {
  const { teacher, student } = await teacherAndStudent(teacherId, studentUid);
  const paths = recordPaths(teacherId, studentUid, context);
  const record = gradeRecord(teacherId, teacher, studentUid, student, context, score, teacherComment, "released");
  await update(ref(database), {
    [paths.released]: record,
    [paths.draft]: null,
  });
  return record;
}

export async function getReleasedGradesForStudent(studentUid) {
  const snapshot = await get(ref(database, `grades/${studentUid}`));
  return snapshot.exists() ? snapshot.val() : {};
}

export function flattenReleasedGrades(node, path = [], rows = []) {
  if (!node || typeof node !== "object") return rows;
  const directScore = node.score ?? node.grade ?? node.finalGrade ?? node.value;
  if (directScore !== undefined && directScore !== null && directScore !== "" && node.status !== "draft") {
    rows.push({
      id: path.join("-") || `grade-${rows.length}`,
      schoolYear: node.schoolYear || "Current school year",
      period: node.gradingPeriod || node.period || "Grading period",
      subject: node.subject || "Subject",
      score: number(directScore),
      remarks: node.remarks || gradeRemark(directScore),
      teacherComment: node.teacherComment || "",
      teacherName: node.teacherName || "",
      releasedAt: node.releasedAt || node.updatedAt || 0,
    });
    return rows;
  }
  Object.entries(node).forEach(([key, value]) => {
    if (value && typeof value === "object") flattenReleasedGrades(value, [...path, key], rows);
  });
  return rows;
}
