import { GRADES } from "./catalog.js";
import { gradeToKey, normalizeGradeLevel } from "./gradeExperience.js";

export const SECTIONS = Object.freeze([
  "Section 1",
  "Section 2",
  "Section 3",
  "Section 4",
  "Section 5",
  "Section 6",
]);

export const ALL_SECTIONS = "All Sections";

function cleanLabel(value, maximumLength = 50) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, maximumLength);
}

export function academicKey(value, prefix = "item") {
  const slug = cleanLabel(value, 80)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || `${prefix}-${Date.now()}`;
}

function defaultGradeDefinitions() {
  return GRADES.map((grade, gradeIndex) => ({
    key: gradeToKey(grade),
    name: grade,
    order: gradeIndex + 1,
    active: true,
    published: true,
    sections: SECTIONS.map((section, sectionIndex) => ({
      key: sectionToKey(section),
      name: section,
      order: sectionIndex + 1,
      active: true,
      published: true,
    })),
  }));
}

export const DEFAULT_SCHOOL_STRUCTURE = Object.freeze({
  version: 1,
  grades: defaultGradeDefinitions(),
});

function collectionValues(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value);
  return [];
}

function normalizeSectionRecord(value, fallbackOrder) {
  const name = normalizeSection(value?.name || value?.label || value);
  if (!name || name === ALL_SECTIONS) return null;
  return {
    key: cleanLabel(value?.key) || academicKey(name, "section"),
    name,
    order: Number.isFinite(Number(value?.order)) ? Number(value.order) : fallbackOrder,
    active: value?.active !== false,
    published: value?.published !== false,
  };
}

function normalizeGradeRecord(value, fallbackOrder) {
  const name = normalizeGradeLevel(value?.name || value?.label || value);
  if (!name) return null;
  const sections = collectionValues(value?.sections)
    .map((section, index) => normalizeSectionRecord(section, index + 1))
    .filter(Boolean)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  return {
    key: cleanLabel(value?.key) || gradeToKey(name),
    name,
    order: Number.isFinite(Number(value?.order)) ? Number(value.order) : fallbackOrder,
    active: value?.active !== false,
    published: value?.published !== false,
    sections,
  };
}

export function normalizeSchoolStructure(value, { fallback = true } = {}) {
  const isStructureRecord = value
    && typeof value === "object"
    && !Array.isArray(value)
    && ("version" in value || "updatedAt" in value || "publishedCount" in value);
  const source = isStructureRecord ? (value.grades || {}) : value;
  const grades = collectionValues(source)
    .map((grade, index) => normalizeGradeRecord(grade, index + 1))
    .filter(Boolean)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  if (!grades.length && fallback) {
    return normalizeSchoolStructure(DEFAULT_SCHOOL_STRUCTURE, { fallback: false });
  }
  return { version: Number(value?.version || 1), grades };
}

export function ensureCoreGradeStructure(value) {
  const normalized = normalizeSchoolStructure(value, { fallback: false });
  const defaults = normalizeSchoolStructure(DEFAULT_SCHOOL_STRUCTURE, { fallback: false });
  const grades = defaults.grades.map((defaultGrade) => {
    const existing = normalized.grades.find((grade) => grade.key === defaultGrade.key || grade.name === defaultGrade.name);
    if (!existing) return defaultGrade;
    return {
      ...existing,
      active: true,
      published: true,
      sections: existing.sections.length ? existing.sections : defaultGrade.sections,
    };
  });
  return { version: Math.max(1, Number(normalized.version || 1)), grades };
}

export function schoolStructureRecord(value) {
  const structure = normalizeSchoolStructure(value, { fallback: false });
  return {
    version: 1,
    grades: Object.fromEntries(structure.grades.map((grade) => [grade.key, {
      key: grade.key,
      name: grade.name,
      order: grade.order,
      active: grade.active,
      published: grade.published,
      sectionCount: grade.sections.length,
      sections: Object.fromEntries(grade.sections.map((section) => [section.key, {
        key: section.key,
        name: section.name,
        order: section.order,
        active: section.active,
        published: section.published,
      }])),
    }])),
  };
}

export function publishedSchoolStructureRecord(value) {
  const structure = normalizeSchoolStructure(value, { fallback: false });
  const publishedStructure = {
    version: 1,
    grades: structure.grades
      .filter((grade) => grade.active && grade.published)
      .map((grade) => ({
        ...grade,
        sections: grade.sections.filter((section) => section.active && section.published),
      }))
      .filter((grade) => grade.sections.length > 0),
  };
  return schoolStructureRecord(publishedStructure);
}

export function activeGradeOptions(structure = DEFAULT_SCHOOL_STRUCTURE) {
  return normalizeSchoolStructure(structure).grades
    .filter((grade) => grade.active && grade.published)
    .map((grade) => ({
      ...grade,
      sections: grade.sections.filter((section) => section.active && section.published),
    }))
    .filter((grade) => grade.sections.length > 0);
}

export function sectionsForGrade(structure, gradeValue, { includeInactive = false } = {}) {
  const gradeName = normalizeGradeLevel(gradeValue);
  const gradeKey = gradeToKey(gradeValue);
  const grade = normalizeSchoolStructure(structure).grades.find((item) => (
    item.key === gradeKey || item.name.toLowerCase() === gradeName.toLowerCase()
  ));
  if (!grade) return [];
  return includeInactive
    ? grade.sections
    : grade.sections.filter((section) => section.active && section.published);
}

export function allSectionNames(structure = DEFAULT_SCHOOL_STRUCTURE, { includeInactive = false } = {}) {
  const names = normalizeSchoolStructure(structure).grades.flatMap((grade) => (
    (includeInactive
      ? grade.sections
      : grade.sections.filter((section) => section.active && section.published))
      .map((section) => section.name)
  ));
  return [...new Set(names)];
}

export function normalizeSection(value, fallback = "") {
  const text = cleanLabel(value);
  if (/^all sections$/i.test(text)) return ALL_SECTIONS;
  if (!text) return fallback;
  const shortMatch = text.match(/^s(?:ection)?\s*[-.]?\s*(.+)$/i);
  if (shortMatch?.[1]) return `Section ${cleanLabel(shortMatch[1], 38)}`;
  return text;
}

export function sectionToKey(value) {
  const section = normalizeSection(value);
  if (section === ALL_SECTIONS) return "all-sections";
  return section ? academicKey(section, "section") : "";
}

export function classKeyFor(gradeValue, sectionValue) {
  const grade = normalizeGradeLevel(gradeValue);
  const sectionKey = sectionToKey(sectionValue);
  if (!grade || !sectionKey) return "";
  return `${gradeToKey(grade)}__${sectionKey}`;
}

export function classLabel(gradeValue, sectionValue) {
  const grade = normalizeGradeLevel(gradeValue);
  const section = normalizeSection(sectionValue);
  return grade && section ? `${grade} · ${section}` : grade || section || "Unassigned class";
}

export function classFields(gradeValue, sectionValue) {
  const grade = normalizeGradeLevel(gradeValue);
  const section = normalizeSection(sectionValue);
  const classKey = classKeyFor(grade, section);
  if (!grade || !section || !classKey) {
    throw new Error("Select a valid grade and section configured by the administrator.");
  }
  return {
    grade,
    gradeLevel: grade,
    gradeKey: gradeToKey(grade),
    section,
    sectionKey: sectionToKey(section),
    classKey,
  };
}

export function allConcreteClassOptions(
  structure = DEFAULT_SCHOOL_STRUCTURE,
  { includeInactive = false } = {},
) {
  return normalizeSchoolStructure(structure).grades.flatMap((grade) => {
    if (!includeInactive && (!grade.active || !grade.published)) return [];
    return grade.sections
      .filter((section) => includeInactive || (section.active && section.published))
      .map((section) => ({
        grade: grade.name,
        gradeKey: grade.key,
        section: section.name,
        sectionKey: section.key,
        key: `${grade.key}__${section.key}`,
        label: `${grade.name} · ${section.name}`,
        active: grade.active && grade.published && section.active && section.published,
      }));
  });
}

export function normalizeAssignedClasses(value, profile = null, structure = DEFAULT_SCHOOL_STRUCTURE) {
  const result = {};
  if (Array.isArray(value)) {
    value.forEach((key) => {
      if (typeof key === "string" && key.includes("__")) result[key] = true;
    });
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, enabled]) => {
      if (enabled && key.includes("__")) result[key] = true;
    });
  }

  if (
    Object.keys(result).length === 0
    && profile
    && (profile.teachingScope === "schoolwide" || profile.gradeLevel === "All Grades")
  ) {
    allConcreteClassOptions(structure).forEach((item) => { result[item.key] = true; });
  }
  return result;
}

export function activeAssignedClasses(value, structure = DEFAULT_SCHOOL_STRUCTURE) {
  const selected = normalizeAssignedClasses(value);
  const activeKeys = new Set(allConcreteClassOptions(structure).map((item) => item.key));
  return Object.fromEntries(Object.keys(selected)
    .filter((key) => activeKeys.has(key))
    .map((key) => [key, true]));
}

export function assignedGradeMap(assignedClasses, structure = DEFAULT_SCHOOL_STRUCTURE) {
  const map = normalizeAssignedClasses(assignedClasses);
  return Object.fromEntries(
    activeGradeOptions(structure)
      .filter((grade) => {
        const activeSections = grade.sections.filter((section) => section.active && section.published);
        return activeSections.length > 0
          && activeSections.every((section) => map[`${grade.key}__${section.key}`]);
      })
      .map((grade) => [grade.key, true]),
  );
}

export function assignedClassOptions(
  profile,
  { includeAllSections = true, structure = DEFAULT_SCHOOL_STRUCTURE } = {},
) {
  if (!profile) return [];
  const available = allConcreteClassOptions(structure);
  const map = profile.role === "admin"
    ? Object.fromEntries(available.map((item) => [item.key, true]))
    : normalizeAssignedClasses(profile.assignedClasses, profile, structure);
  const concrete = available.filter((item) => map[item.key]);
  if (!includeAllSections) return concrete;

  const allOptions = [];
  activeGradeOptions(structure).forEach((grade) => {
    const activeSections = grade.sections.filter((section) => section.active && section.published);
    const assignedInGrade = concrete.filter((item) => item.gradeKey === grade.key);
    if (activeSections.length > 0 && assignedInGrade.length === activeSections.length) {
      allOptions.push({
        grade: grade.name,
        gradeKey: grade.key,
        section: ALL_SECTIONS,
        sectionKey: "all-sections",
        key: `${grade.key}__all-sections`,
        label: `${grade.name} · ${ALL_SECTIONS}`,
      });
    }
  });
  return [...allOptions, ...concrete];
}

export function teacherCanAccessClass(profile, gradeValue, sectionValue) {
  if (profile?.role === "admin" && profile?.status === "active") return true;
  if (profile?.role !== "teacher" || profile?.status === "disabled") return false;
  if (profile.teachingScope === "schoolwide" || profile.gradeLevel === "All Grades") return true;
  const grade = normalizeGradeLevel(gradeValue);
  const section = normalizeSection(sectionValue);
  const map = normalizeAssignedClasses(profile.assignedClasses, profile);
  if (section === ALL_SECTIONS) return Boolean(profile.assignedGrades?.[gradeToKey(grade)]);
  return Boolean(map[classKeyFor(grade, section)]);
}

export function contentMatchesStudentClass(content, profile) {
  const learnerGrade = normalizeGradeLevel(profile?.gradeLevel);
  const learnerSection = normalizeSection(profile?.section);
  const contentGrade = normalizeGradeLevel(content?.grade || content?.gradeLevel);
  const contentSection = normalizeSection(content?.section, ALL_SECTIONS);
  return contentGrade === learnerGrade
    && (contentSection === ALL_SECTIONS || contentSection === learnerSection);
}

export function assignedClassLabels(profile, structure = DEFAULT_SCHOOL_STRUCTURE) {
  return assignedClassOptions(profile, { includeAllSections: false, structure })
    .map((item) => item.label);
}
