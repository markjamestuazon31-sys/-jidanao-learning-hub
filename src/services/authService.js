import {
  createUserWithEmailAndPassword,
  deleteUser,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  getAuth,
} from "firebase/auth";
import { deleteApp, initializeApp } from "firebase/app";
import { get, onValue, ref, set, update } from "firebase/database";
import { auth, database, firebaseConfig } from "../firebase/firebaseConfig";
import {
  activeAssignedClasses,
  assignedGradeMap,
  normalizeAssignedClasses,
} from "../data/schoolClasses";
import { getActiveClassFields, getSchoolStructure } from "./schoolStructureService";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeName(name, fallbackEmail = "") {
  const cleanName = String(name || "").trim().replace(/\s+/g, " ");
  if (cleanName) return cleanName;

  const emailName = normalizeEmail(fallbackEmail).split("@")[0];
  return emailName || "Jidanao Learner";
}

function normalizeEmployeeId(employeeId) {
  return String(employeeId || "").trim().toUpperCase();
}

function createFriendlyError(error, fallbackMessage) {
  const messages = {
    "auth/email-already-in-use":
      "This email already has a Firebase Authentication account. Check the teacher directory before creating another account.",
    "auth/invalid-email": "Enter a valid teacher email address.",
    "auth/weak-password":
      "The temporary password is too weak. Use at least 10 characters with uppercase, lowercase, a number, and a symbol.",
    "auth/operation-not-allowed":
      "Email/password sign-in is not enabled in Firebase Authentication.",
    "auth/network-request-failed":
      "The account could not be created because the network request failed. Check the internet connection and try again.",
    "auth/too-many-requests":
      "Firebase temporarily blocked this request after too many attempts. Wait briefly and try again.",
    "auth/invalid-credential": "The supplied Firebase credential is invalid.",
    "database/permission-denied":
      "Realtime Database rules denied the LMS profile write. The incomplete teacher Authentication account was rolled back.",
    PERMISSION_DENIED:
      "Realtime Database rules denied this administrator action.",
  };

  const message =
    messages[error?.code] ||
    (typeof error?.message === "string" && error.message.trim()
      ? error.message
      : fallbackMessage);

  return Object.assign(new Error(message || fallbackMessage), {
    ...(error?.code ? { code: error.code } : {}),
    cause: error,
  });
}

function validateTeacherInput({ name, email, password }) {
  const normalizedName = normalizeName(name, email);
  const normalizedEmail = normalizeEmail(email);
  const textPassword = String(password || "");

  if (normalizedName.length < 2) {
    throw new Error("Enter the teacher's complete name.");
  }

  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
    throw new Error("Enter a valid teacher email address.");
  }

  if (textPassword.length < 10) {
    throw new Error("The temporary password must contain at least 10 characters.");
  }

  if (
    !/[a-z]/.test(textPassword) ||
    !/[A-Z]/.test(textPassword) ||
    !/\d/.test(textPassword) ||
    !/[^A-Za-z0-9]/.test(textPassword)
  ) {
    throw new Error(
      "The temporary password must include uppercase, lowercase, numeric, and symbol characters.",
    );
  }

  return {
    normalizedName,
    normalizedEmail,
    password: textPassword,
  };
}


export async function login(email, password) {
  try {
    return await signInWithEmailAndPassword(auth, normalizeEmail(email), password);
  } catch (error) {
    throw createFriendlyError(error, "Unable to sign in.");
  }
}

export async function logout() {
  return signOut(auth);
}

export async function registerStudent({ name, email, password, gradeLevel, section }) {
  const normalizedEmail = normalizeEmail(email);
  const learnerClass = await getActiveClassFields(gradeLevel, section);
  let credential = null;

  try {
    credential = await createUserWithEmailAndPassword(
      auth,
      normalizedEmail,
      password,
    );

    const profile = {
      uid: credential.user.uid,
      name: normalizeName(name, normalizedEmail),
      email: normalizedEmail,
      role: "student",
      ...learnerClass,
      status: "active",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await updateProfile(credential.user, { displayName: profile.name });
    await update(ref(database), {
      [`users/${credential.user.uid}`]: profile,
      [`classRosters/${profile.classKey}/${credential.user.uid}`]: true,
    });
    return profile;
  } catch (error) {
    if (credential?.user) {
      try {
        await deleteUser(credential.user);
      } catch (cleanupError) {
        console.error("Unable to roll back incomplete student account:", cleanupError);
      }
    }

    throw createFriendlyError(error, "Unable to create the student account.");
  }
}

/**
 * Recovery for an Authentication account that has no Realtime Database profile.
 * The browser may create a STUDENT profile only. This path can never elevate a
 * user to teacher or administrator.
 */
export async function completeStudentProfile({ name, gradeLevel, section }) {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Please sign in before completing your learner profile.");
  }

  const profileRef = ref(database, `users/${currentUser.uid}`);
  const existingSnapshot = await get(profileRef);
  if (existingSnapshot.exists()) {
    const existing = existingSnapshot.val();
    if (existing.role !== "student" || (existing.section && existing.classKey)) return existing;
    const recoveredClass = await getActiveClassFields(gradeLevel || existing.gradeLevel, section);
    const recoveredProfile = { ...existing, ...recoveredClass, updatedAt: Date.now() };
    await update(ref(database), {
      [`users/${currentUser.uid}`]: recoveredProfile,
      [`classRosters/${recoveredClass.classKey}/${currentUser.uid}`]: true,
    });
    return recoveredProfile;
  }

  const profile = {
    uid: currentUser.uid,
    name: normalizeName(name, currentUser.email),
    email: normalizeEmail(currentUser.email),
    role: "student",
    ...(await getActiveClassFields(gradeLevel, section)),
    status: "active",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  try {
    await updateProfile(currentUser, { displayName: profile.name });
    await update(ref(database), {
      [`users/${currentUser.uid}`]: profile,
      [`classRosters/${profile.classKey}/${currentUser.uid}`]: true,
    });
    return profile;
  } catch (error) {
    throw createFriendlyError(error, "Unable to complete the student profile.");
  }
}

export async function getUserProfile(uid) {
  if (!uid) return null;
  const snapshot = await get(ref(database, `users/${uid}`));
  return snapshot.exists() ? snapshot.val() : null;
}

export function subscribeUserProfile(uid, onData, onError) {
  if (!uid) return () => {};
  return onValue(
    ref(database, `users/${uid}`),
    (snapshot) => onData(snapshot.exists() ? snapshot.val() : null),
    onError,
  );
}

/**
 * Creates the Authentication account through an isolated secondary Firebase
 * app, then writes the teacher role using the still-signed-in administrator's
 * Realtime Database session. Database Rules are the role-authorization gate.
 */
export async function createTeacherAccount({
  name,
  email,
  password,
  employeeId = "",
  assignedClasses = {},
}) {
  const adminUser = auth.currentUser;
  if (!adminUser) throw new Error("Administrator sign-in is required.");

  const validated = validateTeacherInput({ name, email, password });
  const normalizedEmployeeId = normalizeEmployeeId(employeeId);
  const structure = await getSchoolStructure();
  const classAssignments = activeAssignedClasses(normalizeAssignedClasses(assignedClasses), structure);
  if (!Object.keys(classAssignments).length) {
    throw new Error("Assign at least one grade and section to this teacher.");
  }
  const adminSnapshot = await get(ref(database, `users/${adminUser.uid}`));
  const adminProfile = adminSnapshot.exists() ? adminSnapshot.val() : null;
  if (adminProfile?.role !== "admin" || adminProfile?.status !== "active") {
    throw new Error("Only an active administrator can create teacher accounts.");
  }

  const usersSnapshot = await get(ref(database, "users"));
  const users = usersSnapshot.exists() ? Object.values(usersSnapshot.val()) : [];
  const requestedClassKeys = Object.keys(classAssignments);
  const existingAdviser = users.find((item) => item?.role === "teacher"
    && requestedClassKeys.some((classKey) => normalizeAssignedClasses(item?.assignedClasses)[classKey]));
  if (existingAdviser) {
    throw new Error(`One selected section is already assigned to ${existingAdviser.name || existingAdviser.email}.`);
  }
  if (normalizedEmployeeId && users.some((item) => normalizeEmployeeId(item?.employeeId) === normalizedEmployeeId)) {
    throw new Error("This employee ID is already assigned to another account.");
  }

  const secondaryApp = initializeApp(firebaseConfig, `teacher-provisioning-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);
  let credential = null;

  try {
    credential = await createUserWithEmailAndPassword(
      secondaryAuth,
      validated.normalizedEmail,
      validated.password,
    );
    await updateProfile(credential.user, { displayName: validated.normalizedName });
    const now = Date.now();
    const profile = {
      uid: credential.user.uid,
      name: validated.normalizedName,
      email: validated.normalizedEmail,
      role: "teacher",
      status: "active",
      employeeId: normalizedEmployeeId,
      subject: "All Subjects",
      teachingScope: "assigned-classes",
      assignedClasses: classAssignments,
      assignedGrades: assignedGradeMap(classAssignments, structure),
      createdAt: now,
      updatedAt: now,
      createdBy: adminUser.uid,
    };
    await set(ref(database, `users/${credential.user.uid}`), profile);
    return profile;
  } catch (error) {
    if (credential?.user) {
      try { await deleteUser(credential.user); }
      catch (cleanupError) { console.error("Unable to roll back incomplete teacher account:", cleanupError); }
    }
    throw createFriendlyError(error, "Unable to create the teacher account.");
  } finally {
    try { await signOut(secondaryAuth); } catch { /* already signed out */ }
    await deleteApp(secondaryApp);
  }
}

export async function sendAccountPasswordReset(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) throw new Error("A valid email address is required.");

  try {
    await sendPasswordResetEmail(auth, normalizedEmail);
  } catch (error) {
    throw createFriendlyError(error, "Unable to send the password reset email.");
  }
}
