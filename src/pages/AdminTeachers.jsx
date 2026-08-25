import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  Layers3,
  Mail,
  PencilLine,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserPlus,
  UserX,
  Users,
} from "lucide-react";
import { useSchoolStructure } from "../context/SchoolStructureContext";
import {
  activeGradeOptions,
  assignedClassLabels,
  normalizeAssignedClasses,
} from "../data/schoolClasses";
import { createTeacherAccount, sendAccountPasswordReset } from "../services/authService";
import { getUsers, updateTeacherAssignment, updateUserStatus } from "../services/dataService";
import "../styles/admin-teachers.css";

const EMPTY_FORM = { name: "", email: "", password: "", employeeId: "", assignedClasses: {} };

function randomIndex(maximum) {
  if (globalThis.crypto?.getRandomValues) {
    const value = new Uint32Array(1);
    globalThis.crypto.getRandomValues(value);
    return value[0] % maximum;
  }
  return Math.floor(Math.random() * maximum);
}

function generateSecurePassword(length = 14) {
  const groups = ["abcdefghijkmnopqrstuvwxyz", "ABCDEFGHJKLMNPQRSTUVWXYZ", "23456789", "!@#$%*-_"];
  const all = groups.join("");
  const characters = groups.map((group) => group[randomIndex(group.length)]);
  while (characters.length < length) characters.push(all[randomIndex(all.length)]);
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
  }
  return characters.join("");
}

async function copyText(value) {
  if (!navigator.clipboard?.writeText) throw new Error("Clipboard access is unavailable.");
  await navigator.clipboard.writeText(value);
}

function assignmentCount(map) {
  return Object.values(map || {}).filter(Boolean).length;
}

function ClassAssignmentGrid({ value, onChange, structure, disabled = false }) {
  const selected = normalizeAssignedClasses(value, null, structure);
  const grades = activeGradeOptions(structure);

  function toggleClass(grade, section) {
    const key = `${grade.key}__${section.key}`;
    onChange({ ...selected, [key]: !selected[key] || null });
  }

  function toggleGrade(grade) {
    const keys = grade.sections.filter((section) => section.active).map((section) => `${grade.key}__${section.key}`);
    const shouldSelect = !keys.every((key) => selected[key]);
    const next = { ...selected };
    keys.forEach((key) => { next[key] = shouldSelect ? true : null; });
    onChange(next);
  }

  return (
    <fieldset className="teacher-class-assignment" disabled={disabled}>
      <legend><span>3</span> Assign Grade and Section</legend>
      <div className="teacher-class-assignment__intro">
        <span><Layers3 size={20} /></span>
        <div>
          <strong>Choose every class this teacher will handle</strong>
          <p>Only students registered in the selected classes will appear in this teacher&apos;s roster, lessons, games, quizzes, attendance, and gradebook.</p>
        </div>
      </div>
      <div className="teacher-class-assignment__grid">
        {!grades.length && <div className="admin-empty-state">Add and publish a section in Academic Settings before assigning a teacher.</div>}
        {grades.map((grade) => {
          const sections = grade.sections.filter((section) => section.active);
          const gradeKeys = sections.map((section) => `${grade.key}__${section.key}`);
          const allSelected = Boolean(gradeKeys.length) && gradeKeys.every((key) => selected[key]);
          const selectedInGrade = gradeKeys.filter((key) => selected[key]).length;
          return (
            <div className="teacher-class-assignment__row" key={grade.key}>
              <header>
                <span><GraduationCap size={19} /></span>
                <div><strong>{grade.name}</strong><small>{selectedInGrade} of {sections.length} sections selected</small></div>
                <button type="button" className={allSelected ? "is-selected" : ""} onClick={() => toggleGrade(grade)}>{allSelected ? "Clear grade" : "Select all"}</button>
              </header>
              <div className="teacher-class-assignment__sections">
                {sections.map((section) => {
                  const key = `${grade.key}__${section.key}`;
                  return (
                    <label className={selected[key] ? "is-selected" : ""} key={key}>
                      <input type="checkbox" checked={Boolean(selected[key])} onChange={() => toggleClass(grade, section)} />
                      <span className="teacher-class-assignment__check"><CheckCircle2 size={16} /></span>
                      <span>{section.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <footer className="teacher-class-assignment__footer">
        <div><CheckCircle2 size={18} /><strong>{assignmentCount(selected)} class assignment{assignmentCount(selected) === 1 ? "" : "s"} selected</strong></div>
        {assignmentCount(selected) ? <button type="button" onClick={() => onChange({})}>Clear selection</button> : <span>Select at least one class to continue</span>}
      </footer>
    </fieldset>
  );
}

export default function AdminTeachers() {
  const { structure, loading: structureLoading } = useSchoolStructure();
  const [teachers, setTeachers] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [actionUid, setActionUid] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [showPassword, setShowPassword] = useState(false);
  const [createdAccount, setCreatedAccount] = useState(null);
  const [editingUid, setEditingUid] = useState("");
  const [editingAssignments, setEditingAssignments] = useState({});

  const loadTeachers = useCallback(async () => {
    setLoading(true);
    try {
      const users = await getUsers();
      setTeachers(users.filter((item) => item.role === "teacher").sort((a, b) => String(a.name || a.email).localeCompare(String(b.name || b.email))));
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Unable to load teacher accounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadTeachers(); }, [loadTeachers]);

  const filteredTeachers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return teachers.filter((teacher) => {
      if (statusFilter !== "all" && (teacher.status || "active") !== statusFilter) return false;
      const values = [teacher.name, teacher.email, teacher.employeeId, ...assignedClassLabels(teacher, structure)];
      return !term || values.some((value) => String(value || "").toLowerCase().includes(term));
    });
  }, [search, statusFilter, structure, teachers]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function createTeacher(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const profile = await createTeacherAccount(form);
      const classes = assignedClassLabels(profile, structure);
      setCreatedAccount({ ...profile, temporaryPassword: form.password, classes });
      setForm(EMPTY_FORM);
      setShowPassword(false);
      setMessageType("success");
      setMessage(`Teacher account created with ${classes.length} assigned class${classes.length === 1 ? "" : "es"}.`);
      await loadTeachers();
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Unable to create the teacher account.");
    } finally {
      setBusy(false);
    }
  }

  async function saveAssignments(teacher) {
    setActionUid(teacher.uid);
    try {
      await updateTeacherAssignment(teacher.uid, editingAssignments);
      setEditingUid("");
      setMessageType("success");
      setMessage(`${teacher.name || teacher.email}'s class assignments were updated.`);
      await loadTeachers();
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Unable to update class assignments.");
    } finally {
      setActionUid("");
    }
  }

  async function toggleStatus(teacher) {
    const next = teacher.status === "disabled" ? "active" : "disabled";
    setActionUid(teacher.uid);
    try {
      await updateUserStatus(teacher.uid, next);
      setMessageType("success");
      setMessage(`${teacher.name || teacher.email} is now ${next}.`);
      await loadTeachers();
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Unable to update teacher status.");
    } finally {
      setActionUid("");
    }
  }

  async function resetPassword(teacher) {
    setActionUid(teacher.uid);
    try {
      await sendAccountPasswordReset(teacher.email);
      setMessageType("success");
      setMessage(`Password reset email sent to ${teacher.email}.`);
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Unable to send password reset email.");
    } finally {
      setActionUid("");
    }
  }

  return (
    <div className="admin-page teacher-admin-page">
      <header className="admin-page-header teacher-admin-header">
        <div className="teacher-admin-header-copy"><span className="admin-kicker">FACULTY & CLASS CONTROL</span><h1>Teacher Assignment Center</h1><p>Create secure faculty accounts, assign the correct Grade and Section, and manage every teacher from one clear workspace.</p><div className="teacher-admin-header-tags"><span><ShieldCheck size={15} /> Secure accounts</span><span><Layers3 size={15} /> Multiple classes allowed</span></div></div>
        <img className="teacher-admin-header-seal" src="/school-logo.jpg" alt="" aria-hidden="true" />
        <button type="button" className="admin-button secondary" onClick={() => void loadTeachers()} disabled={loading}><RefreshCw size={18} className={loading ? "spin" : ""} /> Refresh directory</button>
      </header>

      <section className="teacher-admin-summary" aria-label="Teacher account summary">
        <article><span className="teacher-admin-summary-icon purple"><Users size={20} /></span><div><small>Total teachers</small><strong>{teachers.length}</strong></div></article>
        <article><span className="teacher-admin-summary-icon green"><UserCheck size={20} /></span><div><small>Active</small><strong>{teachers.filter((item) => item.status !== "disabled").length}</strong></div></article>
        <article><span className="teacher-admin-summary-icon red"><UserX size={20} /></span><div><small>Disabled</small><strong>{teachers.filter((item) => item.status === "disabled").length}</strong></div></article>
        <article><span className="teacher-admin-summary-icon blue"><Layers3 size={20} /></span><div><small>Assigned classes</small><strong>{teachers.reduce((total, teacher) => total + assignedClassLabels(teacher, structure).length, 0)}</strong></div></article>
      </section>

      {message && <div className={`alert ${messageType} admin-alert`} role="status">{message}</div>}

      <div className="admin-two-column teacher-admin-layout">
        <section className="admin-panel teacher-admin-create-panel">
          <div className="admin-panel-heading compact"><div><span className="admin-section-icon"><UserPlus size={20} /></span><div><h2>Create teacher account</h2><p>Complete the three steps below.</p></div></div></div>
          <div className="teacher-admin-workflow" aria-label="Teacher account creation steps">
            <div><span>1</span><strong>Teacher details</strong></div>
            <i aria-hidden="true">→</i>
            <div><span>2</span><strong>Secure access</strong></div>
            <i aria-hidden="true">→</i>
            <div><span>3</span><strong>Assign classes</strong></div>
          </div>
          <form className="admin-form" onSubmit={createTeacher}>
            <section className="teacher-admin-form-section">
              <header><span>1</span><div><h3>Teacher details</h3><p>Enter the faculty member&apos;s official information.</p></div></header>
              <div className="teacher-admin-form-grid">
                <label>Full name<input required minLength={2} autoComplete="name" value={form.name} onChange={(event) => updateForm("name", event.target.value)} placeholder="Example: Maria Dela Cruz" /></label>
                <label>Employee ID <small>Optional</small><input value={form.employeeId} onChange={(event) => updateForm("employeeId", event.target.value)} placeholder="Example: T-2026-001" /></label>
              </div>
            </section>
            <section className="teacher-admin-form-section">
              <header><span>2</span><div><h3>Secure account access</h3><p>The teacher will use these credentials for the first login.</p></div></header>
              <label>Email address<input required type="email" autoComplete="off" value={form.email} onChange={(event) => updateForm("email", event.target.value)} placeholder="teacher@jidanao.edu.ph" /></label>
              <label>Temporary password <small>Minimum 10 characters</small>
                <div className="teacher-admin-password-row">
                  <div className="teacher-admin-password-control"><input required minLength={10} autoComplete="new-password" type={showPassword ? "text" : "password"} value={form.password} onChange={(event) => updateForm("password", event.target.value)} placeholder="Create or generate a secure password" /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
                  <button type="button" className="teacher-admin-generate-button" onClick={() => { updateForm("password", generateSecurePassword()); setShowPassword(true); }}><Sparkles size={16} /> Generate password</button>
                </div>
              </label>
              <div className="teacher-admin-security-note"><KeyRound size={17} /><span>Share the temporary password privately. The teacher can change it after signing in.</span></div>
            </section>
            <ClassAssignmentGrid value={form.assignedClasses} onChange={(value) => updateForm("assignedClasses", value)} structure={structure} disabled={busy || structureLoading} />
            <div className="teacher-admin-review-bar">
              <div><ShieldCheck size={20} /><span><strong>Ready to create?</strong><small>{assignmentCount(form.assignedClasses) ? `${assignmentCount(form.assignedClasses)} class assignment${assignmentCount(form.assignedClasses) === 1 ? "" : "s"} will be connected to this teacher.` : "Select at least one Grade and Section above."}</small></span></div>
              <button className="admin-button primary" disabled={busy || structureLoading || !assignmentCount(form.assignedClasses)}><UserPlus size={18} />{busy ? "Creating account…" : "Create teacher account"}</button>
            </div>
          </form>

          {createdAccount && <aside className="teacher-admin-created-card"><div className="teacher-admin-created-heading"><span><CheckCircle2 size={19} /></span><div><strong>Account ready</strong><small>Share credentials privately with the teacher.</small></div></div><dl><div><dt>Email</dt><dd>{createdAccount.email}</dd></div><div><dt>Password</dt><dd className="teacher-admin-password-value">{createdAccount.temporaryPassword}</dd></div><div><dt>Classes</dt><dd>{createdAccount.classes.join(", ")}</dd></div></dl><button type="button" className="admin-button secondary full" onClick={() => void copyText(["Jidanao Teacher Account", `Name: ${createdAccount.name}`, `Email: ${createdAccount.email}`, `Temporary password: ${createdAccount.temporaryPassword}`, `Classes: ${createdAccount.classes.join(", ")}`].join("\n"))}><Copy size={16} /> Copy credentials</button></aside>}
        </section>

        <section className="admin-panel teacher-admin-directory">
          <div className="admin-panel-heading teacher-admin-directory-heading"><div><span className="admin-section-icon"><GraduationCap size={20} /></span><div><h2>Teacher directory</h2><p>Review accounts, assignments, and access status.</p></div></div><span className="teacher-admin-result-count"><strong>{filteredTeachers.length}</strong> showing</span></div>
          <div className="teacher-admin-filter-row"><label className="admin-search-box"><Search size={19} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by teacher, email, employee ID, or class…" /></label><label className="teacher-admin-status-filter"><span>Account status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All accounts</option><option value="active">Active only</option><option value="disabled">Disabled only</option></select></label></div>
          <div className="admin-card-list teacher-admin-card-list">
            {loading && <div className="admin-empty-state">Loading teacher accounts…</div>}
            {!loading && filteredTeachers.map((teacher) => {
              const labels = assignedClassLabels(teacher, structure);
              const editing = editingUid === teacher.uid;
              return <article className="admin-person-card teacher-admin-person-card" key={teacher.uid}>
                <div className="admin-person-main"><span className="admin-avatar"><GraduationCap size={20} /></span><div><strong>{teacher.name || "Unnamed teacher"}</strong><span><Mail size={14} /> {teacher.email}</span>{teacher.employeeId ? <small>Employee ID: {teacher.employeeId}</small> : null}</div><span className={`admin-status-pill ${teacher.status === "disabled" ? "disabled" : "active"}`}>{teacher.status === "disabled" ? "Disabled" : "Active"}</span></div>
                <div className={`teacher-admin-access-banner ${labels.length ? "" : "is-empty"}`}><ShieldCheck size={18} /><div><strong>{labels.length ? `${labels.length} assigned class${labels.length === 1 ? "" : "es"}` : "No assigned class"}</strong><div className="teacher-admin-class-badges">{labels.length ? labels.map((label) => <span key={label}>{label}</span>) : <span>Use Edit classes to connect this teacher to students.</span>}</div></div></div>
                {editing && <div className="teacher-admin-edit-assignment"><header><div><PencilLine size={18} /><span><strong>Update class assignments</strong><small>Select every class this teacher should manage.</small></span></div><button type="button" onClick={() => setEditingUid("")}>Close</button></header><ClassAssignmentGrid value={editingAssignments} onChange={setEditingAssignments} structure={structure} disabled={actionUid === teacher.uid || structureLoading} /></div>}
                <div className="admin-person-actions">
                  {editing ? <button type="button" className="admin-text-button positive" onClick={() => void saveAssignments(teacher)} disabled={actionUid === teacher.uid || !assignmentCount(editingAssignments)}><CheckCircle2 size={16} /> Save class assignments</button> : <button type="button" className="admin-text-button" onClick={() => { setEditingUid(teacher.uid); setEditingAssignments(normalizeAssignedClasses(teacher.assignedClasses, teacher, structure)); }}><PencilLine size={16} /> Edit classes</button>}
                  <button type="button" className="admin-text-button" onClick={() => void resetPassword(teacher)} disabled={actionUid === teacher.uid}><KeyRound size={16} /> Send password reset</button>
                  <button type="button" className={`admin-text-button ${teacher.status === "disabled" ? "positive" : "danger"}`} onClick={() => void toggleStatus(teacher)} disabled={actionUid === teacher.uid}>{teacher.status === "disabled" ? <UserCheck size={16} /> : <UserX size={16} />}{teacher.status === "disabled" ? "Activate account" : "Disable account"}</button>
                </div>
              </article>;
            })}
            {!loading && !filteredTeachers.length && <div className="admin-empty-state">No teacher accounts match these filters.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
