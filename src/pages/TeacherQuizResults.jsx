import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileQuestion,
  LoaderCircle,
  Pencil,
  RefreshCw,
  Save,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getQuizAttemptsForTeacher, getTeacherQuiz, reviewQuizAttempt } from "../services/assessmentService";

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export default function TeacherQuizResults() {
  const { quizId } = useParams();
  const { user } = useAuth();
  const [quiz, setQuiz] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [review, setReview] = useState({});
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    if (!user?.uid || !quizId) return;
    setLoading(true);
    setError("");
    try {
      const [quizRecord, responses] = await Promise.all([getTeacherQuiz(user.uid, quizId), getQuizAttemptsForTeacher(user.uid, quizId)]);
      setQuiz(quizRecord);
      setAttempts(responses);
      setReview(Object.fromEntries(responses.map((attempt) => [attempt.id, { score: attempt.finalScore, feedback: attempt.feedback || "" }])));
    } catch (loadError) {
      setError(loadError.message || "Unable to load quiz results.");
    } finally {
      setLoading(false);
    }
  }, [quizId, user?.uid]);

  useEffect(() => { load(); }, [load]);

  const metrics = useMemo(() => {
    const scores = attempts.map((attempt) => Number(attempt.scorePercent || 0));
    const uniqueStudents = new Set(attempts.map((attempt) => attempt.studentUid)).size;
    return {
      responses: attempts.length,
      students: uniqueStudents,
      average: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0,
      review: attempts.filter((attempt) => attempt.status === "needs-review").length,
    };
  }, [attempts]);

  async function saveReview(attempt) {
    setBusyId(attempt.id);
    setError("");
    setMessage("");
    try {
      const values = review[attempt.id] || {};
      await reviewQuizAttempt(user.uid, quizId, attempt.studentUid, attempt.id, values.score, values.feedback);
      setMessage(`Final score saved for ${attempt.studentName}.`);
      await load();
    } catch (reviewError) {
      setError(reviewError.message || "Unable to save this review.");
    } finally {
      setBusyId("");
    }
  }

  function exportResponses() {
    const rows = [
      ["Student", "Email", "Grade", "Section", "Submitted", "Status", "Auto score", "Final score", "Maximum points", "Percent", "Feedback"],
      ...attempts.map((attempt) => [attempt.studentName, attempt.studentEmail, attempt.grade, attempt.section, new Date(attempt.submittedAt).toLocaleString("en-PH"), attempt.status, attempt.autoScore, attempt.finalScore, attempt.maxPoints, `${attempt.scorePercent}%`, attempt.feedback || ""]),
    ];
    const blob = new Blob([rows.map((row) => row.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${String(quiz?.title || "quiz-results").replace(/[^a-z0-9]+/gi, "-")}-responses.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div className="teacher-workspace-state"><LoaderCircle className="spin" /> Loading response analytics…</div>;
  if (!quiz) return <div className="alert error">{error || "Quiz not found."}</div>;

  return (
    <div className="teacher-quiz-results">
      <header className="teacher-workspace-hero">
        <div><span>QUIZ RESPONSES</span><h1>{quiz.title}</h1><p>{quiz.grade} · {quiz.section} · {quiz.subject} · {quiz.gradingPeriod}</p></div>
        <div><Link className="ghost-button" to="/teacher/quizzes"><ArrowLeft size={17} /> Quiz Bank</Link><Link className="ghost-button" to={`/teacher/quizzes/${quiz.id}/edit`}><Pencil size={17} /> Edit form</Link><button className="primary-button" type="button" onClick={exportResponses} disabled={!attempts.length}><Download size={17} /> Export responses</button><button className="ghost-button" type="button" onClick={load}><RefreshCw size={17} /> Refresh</button></div>
      </header>

      {error && <div className="alert error" role="alert">{error}</div>}
      {message && <div className="alert success" role="status">{message}</div>}

      <section className="teacher-workspace-metrics">
        <article><FileQuestion /><div><strong>{metrics.responses}</strong><span>Responses</span></div></article>
        <article><Users /><div><strong>{metrics.students}</strong><span>Students responded</span></div></article>
        <article><BarChart3 /><div><strong>{metrics.average}%</strong><span>Average score</span></div></article>
        <article><ClipboardCheck /><div><strong>{metrics.review}</strong><span>Need review</span></div></article>
      </section>

      <section className="panel teacher-results-panel">
        <div className="teacher-results-heading"><div><CheckCircle2 size={21} /><span><h2>Individual responses</h2><p>Review paragraph answers, adjust final points, and add private feedback.</p></span></div><strong>{quiz.totalPoints || 0} points</strong></div>
        {attempts.length ? (
          <div className="teacher-response-list">
            {attempts.map((attempt, index) => (
              <article className="teacher-response-card" key={`${attempt.studentUid}-${attempt.id}`}>
                <header><span>{index + 1}</span><div><h3>{attempt.studentName}</h3><p>{attempt.studentEmail} · {attempt.grade} · {attempt.section}</p></div><div><strong>{attempt.scorePercent}%</strong><small>{attempt.status.replaceAll("-", " ")}</small></div></header>
                <div className="teacher-response-summary"><span>Submitted {new Date(attempt.submittedAt).toLocaleString("en-PH")}</span><span>Auto score: {attempt.autoScore}/{attempt.maxPoints}</span><span>Final score: {attempt.finalScore}/{attempt.maxPoints}</span></div>
                <details>
                  <summary>Review student answers</summary>
                  <div className="teacher-response-answers">
                    {(quiz.questions || []).map((question) => {
                      const answer = attempt.answers?.[question.id];
                      const display = Array.isArray(answer)
                        ? answer.map((value) => question.options?.[value] ?? value).join(", ")
                        : ["multiple-choice", "true-false"].includes(question.type)
                          ? question.options?.[answer] ?? "No answer"
                          : answer || "No answer";
                      const grading = (attempt.grading || []).find((item) => item.questionId === question.id);
                      return <div key={question.id}><span>{question.prompt}</span><strong>{display}</strong><small>{grading?.manual ? "Teacher review required" : grading?.correct ? `Correct · ${grading.earned} point(s)` : "Incorrect"}</small></div>;
                    })}
                  </div>
                </details>
                <div className="teacher-response-review"><label>Final points<input type="number" min="0" max={attempt.maxPoints} value={review[attempt.id]?.score ?? ""} onChange={(event) => setReview((current) => ({ ...current, [attempt.id]: { ...current[attempt.id], score: event.target.value } }))} /></label><label>Teacher feedback<input value={review[attempt.id]?.feedback || ""} onChange={(event) => setReview((current) => ({ ...current, [attempt.id]: { ...current[attempt.id], feedback: event.target.value } }))} placeholder="Optional feedback for school records" /></label><button type="button" onClick={() => saveReview(attempt)} disabled={busyId === attempt.id}><Save size={16} /> {busyId === attempt.id ? "Saving…" : "Save review"}</button></div>
              </article>
            ))}
          </div>
        ) : <div className="teacher-workspace-state"><FileQuestion size={28} /> No student has submitted this quiz yet.</div>}
      </section>
    </div>
  );
}
