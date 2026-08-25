import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  GraduationCap,
  Layers3,
  Plus,
  Save,
  Settings2,
  ShieldCheck,
  Trash2,
  UserRoundCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  academicKey,
  allConcreteClassOptions,
  DEFAULT_SCHOOL_STRUCTURE,
  normalizeAssignedClasses,
  normalizeSchoolStructure,
  normalizeSection,
} from "../data/schoolClasses";
import { getAcademicSettings, getUsers, replaceTeacherAssignment, saveAcademicSettings } from "../services/dataService";
import {
  getManagedSchoolStructure,
  saveSchoolStructure,
} from "../services/schoolStructureService";

const DEFAULT_SETTINGS = {
  schoolName: "Jidanao Elementary School",
  schoolYear: "2026-2027",
  activeGradingPeriod: "1st Grading Period",
};

export default function AdminSettings() {
  const { user } = useAuth();
  const [form, setForm] = useState(DEFAULT_SETTINGS);
  const [draftStructure, setDraftStructure] = useState(() => (
    normalizeSchoolStructure(DEFAULT_SCHOOL_STRUCTURE)
  ));
  const [sectionNames, setSectionNames] = useState({});
  const [teachers, setTeachers] = useState([]);
  const [adviserByClass, setAdviserByClass] = useState({});
  const [loading, setLoading] = useState(true);
  const [structureLoading, setStructureLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingStructure, setSavingStructure] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  useEffect(() => {
    Promise.all([getAcademicSettings(), getManagedSchoolStructure(), getUsers()])
      .then(([settings, managedStructure, users]) => {
        setForm((current) => ({ ...current, ...settings }));
        const managedByKey = Object.fromEntries(managedStructure.grades.map((grade) => [grade.key, grade]));
        const fixedStructure = normalizeSchoolStructure({
          version: 2,
          grades: DEFAULT_SCHOOL_STRUCTURE.grades.map((grade) => ({
            ...grade,
            active: true,
            published: true,
            sections: (managedByKey[grade.key]?.sections || []).map((section) => ({ ...section, active: true, published: true })),
          })),
        });
        const faculty = users.filter((item) => item.role === "teacher" && item.status !== "disabled");
        const adviserMap = {};
        faculty.forEach((teacher) => {
          Object.keys(normalizeAssignedClasses(teacher.assignedClasses, teacher, fixedStructure)).forEach((classKey) => {
            if (!adviserMap[classKey]) adviserMap[classKey] = teacher.uid;
          });
        });
        setDraftStructure(fixedStructure);
        setTeachers(faculty.sort((a, b) => String(a.name || a.email).localeCompare(String(b.name || b.email))));
        setAdviserByClass(adviserMap);
      })
      .catch((error) => {
        setMessageType("error");
        setMessage(error.message || "Unable to load academic settings and class drafts.");
      })
      .finally(() => {
        setLoading(false);
        setStructureLoading(false);
      });
  }, []);

  const activeClassCount = useMemo(() => allConcreteClassOptions(draftStructure).length, [draftStructure]);

  async function submitCalendar(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const saved = await saveAcademicSettings(form);
      setForm((current) => ({ ...current, ...saved }));
      setMessageType("success");
      setMessage("Academic calendar settings were saved.");
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Unable to save academic settings.");
    } finally {
      setSaving(false);
    }
  }

  function addSection(event, gradeKey) {
    event.preventDefault();
    const rawName = String(sectionNames[gradeKey] || "").trim();
    const name = normalizeSection(/^section\b/i.test(rawName) ? rawName : `Section ${rawName}`);
    if (!name) return;
    const key = academicKey(name, "section");
    const grade = draftStructure.grades.find((item) => item.key === gradeKey);
    if (grade?.sections.some((section) => section.key === key || section.name.toLowerCase() === name.toLowerCase())) {
      setMessageType("error");
      setMessage(`${name} already exists in ${grade.name}.`);
      return;
    }
    setDraftStructure((current) => ({
      ...current,
      grades: current.grades.map((item) => item.key !== gradeKey ? item : {
        ...item,
        sections: [...item.sections, {
          key,
          name,
          order: Math.max(0, ...item.sections.map((section) => Number(section.order) || 0)) + 1,
          active: true,
          published: true,
        }],
      }),
    }));
    setSectionNames((current) => ({ ...current, [gradeKey]: "" }));
    setMessage("");
  }

  function removeSection(gradeKey, sectionKey) {
    const grade = draftStructure.grades.find((item) => item.key === gradeKey);
    const section = grade?.sections.find((item) => item.key === sectionKey);
    if (!section) return;
    if (!window.confirm(`Remove ${section.name} from ${grade.name}?`)) return;
    const classKey = `${grade.key}__${section.key}`;
    setAdviserByClass((current) => ({ ...current, [classKey]: "" }));
    setDraftStructure((current) => ({
      ...current,
      grades: current.grades.map((item) => item.key !== gradeKey ? item : {
        ...item,
        sections: item.sections.filter((candidate) => candidate.key !== sectionKey),
      }),
    }));
    setMessage("");
  }

  async function persistStructure() {
    setSavingStructure(true);
    setMessage("");
    try {
      const missingAdviser = allConcreteClassOptions(draftStructure).find((item) => !adviserByClass[item.key]);
      if (missingAdviser) throw new Error(`Assign a class adviser to ${missingAdviser.label} before saving.`);
      const saved = await saveSchoolStructure(draftStructure, user?.uid);
      await Promise.all(teachers.map((teacher) => {
        const assignments = Object.fromEntries(Object.entries(adviserByClass)
          .filter(([, teacherUid]) => teacherUid === teacher.uid)
          .map(([classKey]) => [classKey, true]));
        return replaceTeacherAssignment(teacher.uid, assignments);
      }));
      setDraftStructure(saved);
      setMessageType("success");
      setMessage("The Grade + Section structure and class advisers were saved. Matching students will automatically appear in each adviser’s roster.");
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Unable to save the school structure.");
    } finally {
      setSavingStructure(false);
    }
  }

  return (
    <div className="admin-page academic-settings-page">
      <header className="admin-page-header">
        <div>
          <span className="admin-kicker">SCHOOL CONFIGURATION</span>
          <h1>Academic settings</h1>
          <p>Create the school’s sections under Grades 3–6 and assign one class adviser to every section.</p>
        </div>
      </header>

      {message && <div className={`alert ${messageType} admin-alert`} role="status">{message}</div>}

      <section className="admin-panel academic-structure-panel">
        <div className="academic-structure-heading">
          <div>
            <span className="admin-section-icon"><Layers3 size={20} /></span>
            <div><h2>Class sections and advisers</h2><p>Grades 3–6 are fixed. Enter each real section name and select the teacher responsible for that class.</p></div>
          </div>
          <div className="academic-structure-summary"><strong>4</strong><span>grade levels</span><strong>{activeClassCount}</strong><span>school sections</span></div>
        </div>

        <div className="academic-grade-list">
          {draftStructure.grades.map((grade) => (
            <article className="academic-grade-card is-active" key={grade.key}>
              <header>
                <span className="academic-grade-icon"><GraduationCap size={20} /></span>
                <div><h3>{grade.name}</h3><p>{grade.sections.length} section{grade.sections.length === 1 ? "" : "s"}</p></div>
                <span className="academic-status-button active"><CheckCircle2 size={15} /> School grade</span>
              </header>

              <div className="academic-section-list">
                {!grade.sections.length && (
                  <div className="academic-section-empty">
                    No sections yet. Enter the first real section name for {grade.name}.
                  </div>
                )}
                {grade.sections.map((section) => (
                  <div className="academic-section-item" key={section.key}>
                    <div className="academic-section-record">
                      <div className="academic-section-name"><CheckCircle2 size={16} /><span><strong>{section.name}</strong><small>{grade.name} class</small></span></div>
                      <label><UserRoundCheck size={16} /><select value={adviserByClass[`${grade.key}__${section.key}`] || ""} onChange={(event) => setAdviserByClass((current) => ({ ...current, [`${grade.key}__${section.key}`]: event.target.value }))}><option value="">Select class adviser</option>{teachers.map((teacher) => <option key={teacher.uid} value={teacher.uid}>{teacher.name || teacher.email}</option>)}</select></label>
                      <button type="button" className="academic-remove-section" aria-label={`Remove ${section.name}`} title={`Remove ${section.name}`} onClick={() => removeSection(grade.key, section.key)}><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>

              <form className="academic-add-section" onSubmit={(event) => addSection(event, grade.key)}>
                <input value={sectionNames[grade.key] || ""} onChange={(event) => setSectionNames((current) => ({ ...current, [grade.key]: event.target.value }))} placeholder="Type a section, for example: G or Rizal" maxLength={40} />
                <button type="submit" disabled={!String(sectionNames[grade.key] || "").trim()}><Plus size={15} /> Add section</button>
              </form>
            </article>
          ))}
        </div>

        <footer className="academic-structure-actions">
          <p><ShieldCheck size={16} /> Saving makes each configured section available in student registration and links its matching learners to the selected class adviser.</p>
          <button type="button" className="admin-button primary" onClick={() => void persistStructure()} disabled={structureLoading || savingStructure}>
            <Save size={17} /> {savingStructure ? "Saving class assignments…" : "Save sections and advisers"}
          </button>
        </footer>
      </section>

      <div className="admin-two-column settings-layout">
        <section className="admin-panel">
          <div className="admin-panel-heading compact"><div><span className="admin-section-icon"><CalendarDays size={19} /></span><div><h2>Academic calendar</h2><p>School year and grading-period defaults.</p></div></div></div>
          <form className="admin-form" onSubmit={submitCalendar}>
            <label>School name<input value={form.schoolName} onChange={(event) => setForm((value) => ({ ...value, schoolName: event.target.value }))} required /></label>
            <label>School year<input value={form.schoolYear} onChange={(event) => setForm((value) => ({ ...value, schoolYear: event.target.value }))} placeholder="2026-2027" required /></label>
            <label>Active grading period<select value={form.activeGradingPeriod} onChange={(event) => setForm((value) => ({ ...value, activeGradingPeriod: event.target.value }))}><option>1st Grading Period</option><option>2nd Grading Period</option><option>3rd Grading Period</option><option>4th Grading Period</option></select></label>
            <button className="admin-button primary" disabled={loading || saving}><Save size={17} /> {saving ? "Saving…" : "Save academic calendar"}</button>
          </form>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-heading compact"><div><span className="admin-section-icon"><ShieldCheck size={19} /></span><div><h2>Connected class flow</h2><p>How the administrator-managed structure is applied.</p></div></div></div>
          <div className="admin-governance-list">
            <div><Settings2 size={18} /><span><strong>Student registration</strong><small>Learners choose one administrator-created Grade + Section.</small></span></div>
            <div><ShieldCheck size={18} /><span><strong>Class adviser</strong><small>Each section has one responsible teacher; the same teacher may manage several assigned sections.</small></span></div>
            <div><CalendarDays size={18} /><span><strong>Class delivery</strong><small>Lessons, games, quizzes, attendance, and grades stay inside the teacher&apos;s assigned classes.</small></span></div>
          </div>
        </section>
      </div>
    </div>
  );
}
