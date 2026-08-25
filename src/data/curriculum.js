import { normalizeGradeLevel } from "./gradeExperience.js";

export const MATATAG_SUBJECTS_BY_GRADE = Object.freeze({
  "Grade 3": Object.freeze(["Filipino", "English", "Mathematics", "Science", "Makabansa", "GMRC"]),
  "Grade 4": Object.freeze(["Filipino", "English", "Mathematics", "Science", "Araling Panlipunan", "EPP", "GMRC", "MAPEH"]),
  "Grade 5": Object.freeze(["Filipino", "English", "Mathematics", "Science", "Araling Panlipunan", "EPP", "GMRC", "MAPEH"]),
  "Grade 6": Object.freeze(["Filipino", "English", "Mathematics", "Science", "Araling Panlipunan", "EPP/TLE", "GMRC", "MAPEH"]),
});

export const ALL_CURRICULUM_SUBJECTS = Object.freeze([
  ...new Set(Object.values(MATATAG_SUBJECTS_BY_GRADE).flat()),
]);

export function subjectsForGrade(gradeValue) {
  return MATATAG_SUBJECTS_BY_GRADE[normalizeGradeLevel(gradeValue)] || [];
}

export function isSubjectForGrade(gradeValue, subjectValue) {
  return subjectsForGrade(gradeValue).includes(String(subjectValue || "").trim());
}

export function ensureSubjectForGrade(gradeValue, subjectValue) {
  const grade = normalizeGradeLevel(gradeValue);
  const subject = String(subjectValue || "").trim();
  if (!grade || !isSubjectForGrade(grade, subject)) {
    throw new Error(`${subject || "The selected subject"} is not available for ${grade || "this grade"} in the SY 2026–2027 curriculum.`);
  }
  return subject;
}
