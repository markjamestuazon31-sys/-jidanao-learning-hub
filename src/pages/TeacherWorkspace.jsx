import {
  BarChart3,
  BookOpenCheck,
  ClipboardCheck,
  Download,
  FileText,
  FileQuestion,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getTeacherLessons, getTeacherQuizzes } from "../services/dataService";
import { getTeacherStudentDirectory } from "../services/directoryService";
import { exportTeacherClassWordReport } from "../utils/teacherWordReport";
import "../styles/teacher-reports-redesign.css";

const VIEW_META = {
  lessons: { icon: BookOpenCheck, eyebrow: "LESSON MANAGEMENT", title: "Your lesson workspace", description: "Review teacher-owned drafts and publication status across your administrator-assigned classes." },
  quizzes: { icon: FileQuestion, eyebrow: "QUIZ BANK", title: "Assessment question bank", description: "Review the assessments saved under your teacher profile in Realtime Database." },
  grades: { icon: ClipboardCheck, eyebrow: "GRADEBOOK", title: "Learner performance", description: "Compare completion, accuracy, XP, and practice activity for learners in your teaching scope." },
  reports: { icon: BarChart3, eyebrow: "TEACHER REPORT CENTER", title: "Class progress report", description: "Review learner engagement and download a professional Microsoft Word report for school documentation." },
};

function classLabelFromKey(classKey) {
  if (!classKey) return "All assigned classes";
  const [gradePart = "", sectionPart = ""] = String(classKey).split("__");
  const gradeNumber = gradePart.replace(/^grade-/i, "").replaceAll("-", " ");
  const sectionName = sectionPart.replace(/^section-/i, "").replaceAll("-", " ");
  const titledSection = sectionName.replace(/\b\w/g, (letter) => letter.toUpperCase());
  return `Grade ${gradeNumber} · Section ${titledSection}`;
}

export default function TeacherWorkspace({ view }) {
  const { user, profile } = useAuth();
  const meta = VIEW_META[view] || VIEW_META.lessons;
  const Icon = meta.icon;
  const [students, setStudents] = useState([]);
  const [records, setRecords] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [activeClassKey, setActiveClassKey] = useState(() => window.localStorage.getItem("jidanao-teacher-active-class") || "");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (view === "lessons") setRecords(await getTeacherLessons(user.uid));
      else if (view === "quizzes") setRecords(await getTeacherQuizzes(user.uid));
      else setStudents(await getTeacherStudentDirectory());
    } catch (loadError) {
      console.error(`Unable to load teacher ${view} workspace:`, loadError);
      setError(loadError.message || "This teacher workspace could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [user?.uid, view]);

  useEffect(() => { if (user?.uid) load(); }, [load, user?.uid]);

  useEffect(() => {
    function syncActiveClass(event) {
      setActiveClassKey(event?.detail?.classKey || window.localStorage.getItem("jidanao-teacher-active-class") || "");
    }
    window.addEventListener("jidanao:teacher-class-change", syncActiveClass);
    window.addEventListener("storage", syncActiveClass);
    return () => {
      window.removeEventListener("jidanao:teacher-class-change", syncActiveClass);
      window.removeEventListener("storage", syncActiveClass);
    };
  }, []);

  const reportStudents = useMemo(() => (
    activeClassKey ? students.filter((student) => student.classKey === activeClassKey) : students
  ), [activeClassKey, students]);

  const filteredRecords = useMemo(() => {
    const term = query.trim().toLowerCase();
    const source = view === "lessons" || view === "quizzes" ? records : view === "reports" ? reportStudents : students;
    return source.filter((item) => !term || [item.title, item.name, item.subject, item.grade, item.gradeLevel, item.email]
      .filter(Boolean).some((value) => String(value).toLowerCase().includes(term)));
  }, [query, records, reportStudents, students, view]);

  const metricStudents = view === "reports" ? reportStudents : students;
  const totals = useMemo(() => ({
    learners: metricStudents.length,
    lessons: metricStudents.reduce((sum, item) => sum + Number(item.progress?.lessonsCompleted || 0), 0),
    games: metricStudents.reduce((sum, item) => sum + Number(item.progress?.gameSessions || 0), 0),
    accuracy: metricStudents.length ? Math.round(metricStudents.reduce((sum, item) => sum + Number(item.progress?.accuracyPercent || 0), 0) / metricStudents.length) : 0,
  }), [metricStudents]);

  const reportClassLabel = useMemo(() => {
    if (activeClassKey) return classLabelFromKey(activeClassKey);
    const classLabels = [...new Set(reportStudents.map((student) => `${student.gradeLevel} · ${student.section}`))];
    return classLabels.length === 1 ? classLabels[0] : "All administrator-assigned classes";
  }, [activeClassKey, reportStudents]);

  async function exportReport() {
    if (exporting || !filteredRecords.length) return;
    setExporting(true);
    setError("");
    try {
      const reportTotals = {
        learners: filteredRecords.length,
        lessons: filteredRecords.reduce((sum, item) => sum + Number(item.progress?.lessonsCompleted || 0), 0),
        games: filteredRecords.reduce((sum, item) => sum + Number(item.progress?.gameSessions || 0), 0),
        accuracy: filteredRecords.length
          ? Math.round(filteredRecords.reduce((sum, item) => sum + Number(item.progress?.accuracyPercent || 0), 0) / filteredRecords.length)
          : 0,
      };
      await exportTeacherClassWordReport({
        teacherName: profile?.name || user?.displayName || "Jidanao Teacher",
        classLabel: reportClassLabel,
        students: filteredRecords,
        totals: reportTotals,
      });
    } catch (exportError) {
      console.error("Unable to create the teacher Word report:", exportError);
      setError(exportError.message || "The Microsoft Word report could not be created.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className={`teacher-workspace-page ${view === "reports" ? "teacher-reports-page" : ""}`}>
      <header className="teacher-workspace-hero">
        <div>
          <span>{meta.eyebrow}</span><h1>{meta.title}</h1><p>{meta.description}</p>
          {view === "reports" && <div className="teacher-report-hero-badges"><b><FileText size={15} /> Microsoft Word</b><b><ShieldCheck size={15} /> Class records protected</b><b><Sparkles size={15} /> Print-ready format</b></div>}
        </div>
        <div>
          {view === "lessons" && <Link className="primary-button" to="/teacher/dashboard"><BookOpenCheck size={17} /> Create draft</Link>}
          {view === "quizzes" && <Link className="primary-button" to="/teacher/ai-studio"><FileQuestion size={17} /> Build lesson quiz</Link>}
          {view === "reports" && <button type="button" className="primary-button teacher-report-download" onClick={() => void exportReport()} disabled={!filteredRecords.length || exporting}>{exporting ? <LoaderCircle size={17} className="spin" /> : <Download size={17} />} {exporting ? "Preparing Word report…" : "Download Word report"}</button>}
          <button type="button" className="ghost-button" onClick={load} disabled={loading}><RefreshCw size={16} className={loading ? "spin" : ""} /> Refresh</button>
        </div>
      </header>

      {error && <div className="alert error" role="alert">{error}</div>}

      {(view === "grades" || view === "reports") && (
        <section className="teacher-workspace-metrics">
          <article><Users /><div><strong>{totals.learners}</strong><span>Learners</span></div></article>
          <article><BookOpenCheck /><div><strong>{totals.lessons}</strong><span>Lessons completed</span></div></article>
          <article><ClipboardCheck /><div><strong>{totals.accuracy}%</strong><span>Average accuracy</span></div></article>
          <article><BarChart3 /><div><strong>{totals.games}</strong><span>Games played</span></div></article>
        </section>
      )}

      {view === "reports" && (
        <section className="teacher-report-guide">
          <article><span>1</span><div><strong>Confirm the class</strong><p>The report follows the Active class selected in the teacher sidebar.</p></div></article>
          <article><span>2</span><div><strong>Review learner records</strong><p>Search if needed. The Word report includes the learners currently shown.</p></div></article>
          <article><span>3</span><div><strong>Download and print</strong><p>Open the `.doc` file in Microsoft Word, review it, and print or save it securely.</p></div></article>
        </section>
      )}

      <section className="panel teacher-workspace-panel">
        <div className="teacher-workspace-toolbar">
          <div><Icon size={20} /><div><h2>{view === "lessons" ? "Lesson records" : view === "quizzes" ? "Quiz records" : view === "reports" ? "Learner progress records" : "Learner records"}</h2><p>{view === "reports" ? `${reportClassLabel} · ` : ""}{filteredRecords.length} result{filteredRecords.length === 1 ? "" : "s"}</p></div></div>
          <label><Search size={16} /><span className="sr-only">Search records</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this workspace…" /></label>
        </div>

        {loading ? <div className="teacher-workspace-state"><LoaderCircle className="spin" /> Loading records…</div> : filteredRecords.length ? (
          <div className="teacher-workspace-table-wrap">
            <table>
              <thead><tr>
                {(view === "lessons" || view === "quizzes") ? <><th>Title</th><th>Class</th><th>Subject</th><th>Status / questions</th><th>Updated</th></> : <><th>Student</th><th>Grade</th><th>Section</th><th>Status</th><th>Lessons</th><th>Games</th><th>Accuracy</th><th>XP</th></>}
              </tr></thead>
              <tbody>
                {(view === "lessons" || view === "quizzes") ? filteredRecords.map((item) => (
                  <tr key={item.id}><td><strong>{item.title || "Untitled record"}</strong></td><td>{item.grade || "—"} · {item.section || "All Sections"}</td><td>{item.subject || "—"}</td><td>{view === "lessons" ? item.status || "draft" : `${item.questions?.length || 0} questions`}</td><td>{item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : "—"}</td></tr>
                )) : filteredRecords.map((student) => (
                  <tr key={student.uid}><td><strong>{student.name}</strong><small>{student.email}</small></td><td>{student.gradeLevel}</td><td>{student.section || "Section 1"}</td><td><span className={`teacher-workspace-status is-${student.status}`}>{student.status}</span></td><td>{student.progress?.lessonsCompleted || 0}</td><td>{student.progress?.gameSessions || 0}</td><td>{student.progress?.accuracyPercent || 0}%</td><td>{student.progress?.totalXp || 0}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="teacher-workspace-state">{view === "reports" ? "No learner records are available for the selected Active class. Choose another class from the sidebar or refresh the page." : "No records match this workspace yet."}</div>}
      </section>

      {view === "reports" && <footer className="teacher-report-privacy"><ShieldCheck size={20} /><div><strong>Student records are confidential</strong><p>Download reports only for authorized school use. Store printed and electronic copies securely.</p></div></footer>}
    </div>
  );
}
