import {
  BarChart3,
  CalendarClock,
  CheckCircle2,
  CirclePlus,
  Clock3,
  FileQuestion,
  LoaderCircle,
  LockKeyhole,
  Pencil,
  RefreshCw,
  Search,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getTeacherQuizzes } from "../services/dataService";
import { deleteTeacherQuiz, setTeacherQuizStatus } from "../services/assessmentService";

function formatDate(value) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not set" : date.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
}

export default function TeacherQuizLibrary() {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    setError("");
    try {
      const records = await getTeacherQuizzes(user.uid);
      setQuizzes(records.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0)));
    } catch (loadError) {
      setError(loadError.message || "Unable to load the Quiz Bank.");
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return quizzes.filter((quiz) => (status === "all" || quiz.status === status) && (!term || [quiz.title, quiz.subject, quiz.grade, quiz.section, quiz.gradingPeriod]
      .filter(Boolean).some((value) => String(value).toLowerCase().includes(term))));
  }, [query, quizzes, status]);

  const totals = useMemo(() => ({
    all: quizzes.length,
    published: quizzes.filter((quiz) => quiz.status === "published").length,
    draft: quizzes.filter((quiz) => quiz.status === "draft").length,
    questions: quizzes.reduce((sum, quiz) => sum + Number(quiz.questions?.length || 0), 0),
  }), [quizzes]);

  async function changeStatus(quiz, nextStatus) {
    setBusyId(quiz.id);
    setError("");
    setMessage("");
    try {
      await setTeacherQuizStatus(user.uid, quiz.id, nextStatus);
      setMessage(nextStatus === "published" ? `“${quiz.title}” is now available to ${quiz.grade} · ${quiz.section}.` : `“${quiz.title}” is now closed.`);
      await load();
    } catch (statusError) {
      setError(statusError.message || "Unable to update this quiz.");
    } finally {
      setBusyId("");
    }
  }

  async function removeQuiz(quiz) {
    if (!window.confirm(`Delete “${quiz.title}”? This removes the form but preserves already submitted response records.`)) return;
    setBusyId(quiz.id);
    setError("");
    try {
      await deleteTeacherQuiz(user.uid, quiz.id);
      setMessage("Quiz deleted from the Quiz Bank.");
      await load();
    } catch (deleteError) {
      setError(deleteError.message || "Unable to delete this quiz.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="teacher-quiz-library">
      <header className="teacher-workspace-hero teacher-quiz-hero">
        <div><span>ASSESSMENT WORKSPACE</span><h1>Google Forms-style Quiz Bank</h1><p>Build reusable assessments, define answer keys and points, then publish each quiz only to your administrator-assigned Grade and Section.</p></div>
        <div><Link className="primary-button" to="/teacher/quizzes/new"><CirclePlus size={18} /> Create quiz</Link><button className="ghost-button" type="button" onClick={load} disabled={loading}><RefreshCw className={loading ? "spin" : ""} size={17} /> Refresh</button></div>
      </header>

      {error && <div className="alert error" role="alert">{error}</div>}
      {message && <div className="alert success" role="status">{message}</div>}

      <section className="teacher-workspace-metrics teacher-quiz-metrics">
        <article><FileQuestion /><div><strong>{totals.all}</strong><span>Total quizzes</span></div></article>
        <article><CheckCircle2 /><div><strong>{totals.published}</strong><span>Published</span></div></article>
        <article><Clock3 /><div><strong>{totals.draft}</strong><span>Private drafts</span></div></article>
        <article><BarChart3 /><div><strong>{totals.questions}</strong><span>Questions created</span></div></article>
      </section>

      <section className="panel teacher-quiz-library__panel">
        <div className="teacher-quiz-library__filters">
          <label><Search size={17} /><span className="sr-only">Search quizzes</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, subject, class…" /></label>
          <div role="group" aria-label="Filter quiz status">
            {["all", "published", "draft", "closed"].map((value) => <button type="button" className={status === value ? "active" : ""} onClick={() => setStatus(value)} key={value}>{value}</button>)}
          </div>
        </div>

        {loading ? (
          <div className="teacher-workspace-state"><LoaderCircle className="spin" /> Loading your quiz forms…</div>
        ) : filtered.length ? (
          <div className="teacher-quiz-grid">
            {filtered.map((quiz) => (
              <article className="teacher-quiz-card" key={quiz.id}>
                <div className="teacher-quiz-card__accent" />
                <header><span className={`teacher-quiz-status is-${quiz.status || "draft"}`}>{quiz.status || "draft"}</span><span>{quiz.questions?.length || 0} questions · {quiz.totalPoints || 0} points</span></header>
                <div className="teacher-quiz-card__title"><span><FileQuestion size={22} /></span><div><h2>{quiz.title || "Untitled quiz"}</h2><p>{quiz.description || "No form description added."}</p></div></div>
                <div className="teacher-quiz-card__meta">
                  <span><Users size={15} /> {quiz.grade} · {quiz.section}</span>
                  <span><CalendarClock size={15} /> {quiz.gradingPeriod}</span>
                  <span><Clock3 size={15} /> Due: {formatDate(quiz.settings?.dueAt)}</span>
                </div>
                <footer>
                  <Link to={`/teacher/quizzes/${quiz.id}/edit`}><Pencil size={16} /> Edit</Link>
                  <Link to={`/teacher/quizzes/${quiz.id}/results`}><BarChart3 size={16} /> Results</Link>
                  {quiz.status === "published" ? <button type="button" disabled={busyId === quiz.id} onClick={() => changeStatus(quiz, "closed")}><LockKeyhole size={16} /> Close</button> : <button type="button" disabled={busyId === quiz.id} onClick={() => changeStatus(quiz, "published")}><Send size={16} /> Publish</button>}
                  <button type="button" className="is-danger" disabled={busyId === quiz.id} onClick={() => removeQuiz(quiz)}><Trash2 size={16} /> Delete</button>
                </footer>
              </article>
            ))}
          </div>
        ) : (
          <div className="teacher-workspace-state"><FileQuestion size={27} /> No quizzes match this view. Create your first class assessment.</div>
        )}
      </section>
    </div>
  );
}
