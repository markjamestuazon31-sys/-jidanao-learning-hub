import { get, onValue, ref, update } from "firebase/database";
import { database } from "../firebase/firebaseConfig";
import {
  allConcreteClassOptions,
  classFields,
  DEFAULT_SCHOOL_STRUCTURE,
  ensureCoreGradeStructure,
  normalizeSchoolStructure,
  publishedSchoolStructureRecord,
  schoolStructureRecord,
} from "../data/schoolClasses";

export async function getSchoolStructure() {
  const snapshot = await get(ref(database, "publishedSchoolStructure"));
  return ensureCoreGradeStructure(snapshot.exists() ? snapshot.val() : DEFAULT_SCHOOL_STRUCTURE);
}

export async function getManagedSchoolStructure() {
  const snapshot = await get(ref(database, "schoolStructure"));
  return ensureCoreGradeStructure(snapshot.exists() ? snapshot.val() : DEFAULT_SCHOOL_STRUCTURE);
}

export async function getActiveClassFields(grade, section) {
  const structure = await getSchoolStructure();
  const fields = classFields(grade, section);
  if (!allConcreteClassOptions(structure).some((item) => item.key === fields.classKey)) {
    throw new Error("This grade and section is not published. Select an available class.");
  }
  return fields;
}

export function subscribeSchoolStructure(onData, onError) {
  return onValue(
    ref(database, "publishedSchoolStructure"),
    (snapshot) => onData(ensureCoreGradeStructure(snapshot.exists() ? snapshot.val() : DEFAULT_SCHOOL_STRUCTURE)),
    onError,
  );
}

export async function saveSchoolStructure(structure, administratorUid = "") {
  const normalized = ensureCoreGradeStructure(structure);
  if (!normalized.grades.length) throw new Error("Add at least one grade before saving.");

  const updatedAt = Date.now();
  const updatedBy = administratorUid || "administrator";
  const managedRecord = {
    ...schoolStructureRecord(normalized),
    updatedAt,
    updatedBy,
  };
  const publishedRecord = {
    ...publishedSchoolStructureRecord(normalized),
    publishedCount: allConcreteClassOptions(normalized).length,
    updatedAt,
    updatedBy,
  };

  await update(ref(database), {
    schoolStructure: managedRecord,
    publishedSchoolStructure: publishedRecord,
  });
  return normalizeSchoolStructure(managedRecord);
}
