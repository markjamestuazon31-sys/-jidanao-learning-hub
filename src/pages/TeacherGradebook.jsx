import {
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileText,
  LoaderCircle,
  RefreshCw,
  Save,
  Send,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useSchoolStructure } from "../context/SchoolStructureContext";
import { subjectsForGrade } from "../data/curriculum";
import { assignedClassOptions } from "../data/schoolClasses";
import { GRADING_PERIODS } from "../services/assessmentService";
import { getAcademicSettings } from "../services/dataService";
import { getTeacherStudentDirectory } from "../services/directoryService";
import {
  flattenReleasedGrades,
  getGradebookRows,
  getReleasedGradesForStudent,
  gradeRemark,
  releaseStudentGrade,
  saveGradeDraft,
} from "../services/gradebookService";
import { generateReportCard } from "../utils/pdf";

export default function TeacherGradebook() {
  const { user, profile } = useAuth();
  const { structure } = useSchoolStructure();
  const classOptions = useMemo(() => assignedClassOptions(profile, { includeAllSections: false, structure }), [profile, structure]);
  const [context, setContext] = useState({ grade: "", section: "", schoolYear: "2026-2027", gradingPeriod: GRADING_PERIODS[0], subject: "Mathematics" });
  const subjectOptions = useMemo(() => subjectsForGrade(context.grade), [context.grade]);
  const [students, setStudents] = useState([]);
  const [rows, setRows] = useState([]);
  const [edits, setEdits] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([getAcademicSettings(), getTeacherStudentDirectory()])
      .then(([settings, directory]) => {
        setStudents(directory);
        setContext((current) => ({
          ...current,
          schoolYear: settings.schoolYear || current.schoolYear,
          gradingPeriod: settings.activeGradingPeriod || current.gradingPeriod,
          grade: current.grade || classOptions[0]?.grade || "",
          section: current.section || classOptions[0]?.section || "",
        }));
      })
      .catch((loadError) => setError(loadError.message || "Unable to initialize the gradebook."));
  }, [classOptions]);

  useEffect(() => {
    if (!subjectOptions.length || subjectOptions.includes(context.subject)) return;
    setContext((current) => ({ ...current, subject: subjectOptions[0] }));
  }, [context.subject, subjectOptions]);

  const classStudents = useMemo(() => students.filter((student) => student.gradeLevel === context.grade && student.section === context.section), [context.grade, context.section, students]);

  const loadRows = useCallback(async () => {
    if (!user?.uid || !context.grade || !context.section) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const records = await getGradebookRows(user.uid, classStudents, context);
      setRows(records);
      setEdits(Object.fromEntries(records.map((row) => [row.uid, { score: row.score, teacherComment: row.teacherComment || "" }])));
    } catch (loadError) {
      setError(loadError.message || "Unable to load gradebook records.");
    } finally {
      setLoading(false);
    }
  }, [classStudents, context, user?.uid]);

  useEffect(() => { loadRows(); }, [loadRows]);

  function updateEdit(uid, field, value) {
    setEdits((current) => ({ ...current, [uid]: { ...(current[uid] || {}), [field]: value } }));
  }

  async function saveRow(student, action) {
    const values = edits[student.uid] || {};
    setBusyId(student.uid);
    setError("");
    setMessage("");
    try {
      if (action === "release") {
        await releaseStudentGrade(user.uid, student.uid, context, values.score, values.teacherComment);
        setMessage(`${context.subject} grade released to ${student.name}.`);
      } else {
        await saveGradeDraft(user.uid, student.uid, context, values.score, values.teacherComment);
        setMessage(`Private grade draft saved for ${student.name}.`);
      }
      await loadRows();
    } catch (saveError) {
      setError(saveError.message || "Unable to save this grade.");
    } finally {
      setBusyId("");
    }
  }

  async function releaseAll() {
    const validRows = rows.filter((row) => Number(edits[row.uid]?.score) >= 60 && Number(edits[row.uid]?.score) <= 100);
    if (!validRows.length) {
      setError("Encode at least one valid grade from 60 to 100.");
      return;
    }
    if (!window.confirm(`Release ${context.subject} grades to ${validRows.length} learner(s) in ${context.grade} · ${context.section}?`)) return;
    setBusyId("all");
    setError("");
    setMessage("");
    try {
      for (const student of validRows) {
        const values = edits[student.uid];
        await releaseStudentGrade(user.uid, student.uid, context, values.score, values.teacherComment);
      }
      setMessage(`${validRows.length} grades released successfully.`);
      await loadRows();
    } catch (releaseError) {
      setError(releaseError.message || "Unable to release all grades.");
    } finally {
      setBusyId("");
    }
  }

  async function downloadReportCard(student) {
    setBusyId(`report-${student.uid}`);
    setError("");
    try {
      const grades = flattenReleasedGrades(await getReleasedGradesForStudent(student.uid));
      if (!grades.length) throw new Error("Release at least one grade before generating this report card.");
      generateReportCard({ student, grades, schoolYear: context.schoolYear, schoolName: "Jidanao Elementary School" });
    } catch (reportError) {
      setError(reportError.message || "Unable to generate the report card.");
    } finally {
      setBusyId("");
    }
  }

  const encoded = rows.filter((row) => edits[row.uid]?.score !== "").length;
  const released = rows.filter((row) => row.gradeStatus === "released").length;
  const averageScores = rows.map((row) => Number(edits[row.uid]?.score)).filter((value) => value >= 60 && value <= 100);
  const average = averageScores.length ? Math.round((averageScores.reduce((sum, value) => sum + value, 0) / averageScores.length) * 10) / 10 : 0;

  return (
    <div className="teacher-gradebook-page">
      <header className="teacher-workspace-hero teacher-gradebook-hero">
        <div><span>OFFICIAL GRADEBOOK</span><h1>Encode, review, and release grades</h1><p>Manage academic results by school year, grading period, subject, and your assigned Grade + Section. Drafts remain private until you release them.</p></div>
        <div><button className="ghost-button" type="button" onClick={loadRows} disabled={loading}><RefreshCw size={17} className={loading ? "spin" : ""} /> Refresh</button><button className="primary-button" type="button" onClick={releaseAll} disabled={busyId === "all" || !rows.length}><Send size={17} /> {busyId === "all" ? "Releasing…" : "Release encoded grades"}</button></div>
      </header>

      {error && <div className="alert error" role="alert">{error}</div>}
      {message && <div className="alert success" role="status">{message}</div>}

      <section className="teacher-grade-filters panel">
        <label>Assigned class<select value={`${context.grade}|${context.section}`} onChange={(event) => { const selected = classOptions.find((item) => `${item.grade}|${item.section}` === event.target.value); if (selected) setContext((current) => ({ ...current, grade: selected.grade, section: selected.section })); }}>{classOptions.map((item) => <option value={`${item.grade}|${item.section}`} key={item.key}>{item.label}</option>)}</select></label>
        <label>School year<input value={context.schoolYear} onChange={(event) => setContext((current) => ({ ...current, schoolYear: event.target.value }))} /></label>
        <label>Grading period<select value={context.gradingPeriod} onChange={(event) => setContext((current) => ({ ...current, gradingPeriod: event.target.value }))}>{GRADING_PERIODS.map((period) => <option key={period}>{period}</option>)}</select></label>
        <label>Subject<select value={context.subject} onChange={(event) => setContext((current) => ({ ...current, subject: event.target.value }))}>{subjectOptions.map((subject) => <option key={subject}>{subject}</option>)}</select></label>
      </section>

      <section className="teacher-workspace-metrics teacher-gradebook-metrics">
        <article><Users /><div><strong>{rows.length}</strong><span>Class learners</span></div></article>
        <article><BookOpenCheck /><div><strong>{encoded}</strong><span>Grades encoded</span></div></article>
        <article><CheckCircle2 /><div><strong>{released}</strong><span>Released results</span></div></article>
        <article><ClipboardCheck /><div><strong>{average || "—"}</strong><span>Class average</span></div></article>
      </section>

      <section className="panel teacher-gradebook-panel">
        <div className="teacher-gradebook-heading"><div><ClipboardCheck size={21} /><span><h2>{context.subject} class record</h2><p>{context.grade} · {context.section} · {context.gradingPeriod}</p></span></div><small>Valid grade range: 60–100</small></div>
        {loading ? <div className="teacher-workspace-state"><LoaderCircle className="spin" /> Loading class grade records…</div> : rows.length ? (
          <div className="teacher-gradebook-table-wrap">
            <table>
              <thead><tr><th>Learner</th><th>Grade</th><th>Performance</th><th>Teacher comment</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>{rows.map((student) => {
                const score = edits[student.uid]?.score ?? "";
                const valid = Number(score) >= 60 && Number(score) <= 100;
                return (
                  <tr key={student.uid}>
                    <td><strong>{student.name}</strong><small>{student.email}</small></td>
                    <td><input className={`teacher-grade-input ${score !== "" && !valid ? "is-invalid" : ""}`} type="number" min="60" max="100" value={score} onChange={(event) => updateEdit(student.uid, "score", event.target.value)} aria-label={`Grade for ${student.name}`} /></td>
                    <td><span className={`teacher-grade-remark ${valid && Number(score) < 75 ? "is-low" : valid && Number(score) >= 90 ? "is-high" : ""}`}>{valid ? gradeRemark(score) : "Not encoded"}</span></td>
                    <td><input value={edits[student.uid]?.teacherComment || ""} onChange={(event) => updateEdit(student.uid, "teacherComment", event.target.value)} placeholder="Optional comment" /></td>
                    <td><span className={`teacher-grade-status is-${student.gradeStatus}`}>{student.gradeStatus.replaceAll("-", " ")}</span></td>
                    <td><div className="teacher-grade-actions"><button type="button" title="Save private draft" disabled={!valid || busyId === student.uid} onClick={() => saveRow(student, "draft")}><Save size={15} /> Draft</button><button type="button" title="Release to student" disabled={!valid || busyId === student.uid} onClick={() => saveRow(student, "release")}><Send size={15} /> Release</button><button type="button" title="Generate report card" disabled={busyId === `report-${student.uid}`} onClick={() => downloadReportCard(student)}><FileText size={15} /> Report card</button></div></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        ) : <div className="teacher-workspace-state"><Users size={27} /> No students are registered in this assigned class yet.</div>}
      </section>

      <div className="teacher-gradebook-note"><Download size={18} /><span><strong>Official report-card generation is enabled.</strong><small>Release grades first, then use Report card to download the learner’s consolidated PDF academic record.</small></span></div>
    </div>
  );
}
