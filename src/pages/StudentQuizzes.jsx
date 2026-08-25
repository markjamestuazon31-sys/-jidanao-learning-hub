import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileQuestion,
  LoaderCircle,
  PlayCircle,
  Trophy,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getGradeExperience } from "../data/gradeExperience";
import { getStudentQuizAttempts, subscribePublishedQuizzes } from "../services/assessmentService";

function dueLabel(value) {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No due date";
  return `Due ${date.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}`;
}

export default function StudentQuizzes() {
  const { user, profile } = useAuth();
  const experience = getGradeExperience(profile?.gradeLevel);
  const [quizzes, setQuizzes] = useState([]);
  const [attemptsByQuiz, setAttemptsByQuiz] = useState({});
  const [pageOpenedAt] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile?.classKey) return undefined;
    return subscribePublishedQuizzes(profile.classKey, async (records) => {
      setQuizzes(records);
      setLoading(false);
      if (user?.uid) {
        const attempts = await Promise.all(records.map(async (quiz) => [quiz.id, await getStudentQuizAttempts(quiz.id, user.uid).catch(() => [])]));
        setAttemptsByQuiz(Object.fromEntries(attempts));
      }
    }, (loadError) => {
      setError(loadError.message || "Unable to load assigned quizzes.");
      setLoading(false);
    });
  }, [profile?.classKey, user?.uid]);

  const summary = useMemo(() => {
    const attempts = Object.values(attemptsByQuiz).flat();
    const scores = attempts.map((attempt) => Number(attempt.scorePercent || 0));
    return {
      assigned: quizzes.length,
      completed: quizzes.filter((quiz) => attemptsByQuiz[quiz.id]?.length).length,
      average: scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0,
    };
  }, [attemptsByQuiz, quizzes]);

  return (
    <div className={`student-portal student-quiz-library student-theme--${experience.theme}`}>
      <header className="student-page-hero student-quiz-hero">
        <div className="student-page-hero__icon"><ClipboardList size={30} /></div>
        <div><span>{profile?.gradeLevel} · {profile?.section}</span><h1>My assigned quizzes</h1><p>Complete assessments published by your teacher and review your released scores.</p></div>
        <div className="student-page-hero__tools"><strong>{summary.completed}/{summary.assigned}</strong><small>completed forms</small></div>
      </header>

      <section className="student-quiz-metrics">
        <article><FileQuestion /><span>Assigned</span><strong>{summary.assigned}</strong></article>
        <article><CheckCircle2 /><span>Completed</span><strong>{summary.completed}</strong></article>
        <article><Trophy /><span>Average score</span><strong>{summary.average || "—"}{summary.average ? "%" : ""}</strong></article>
      </section>

      {error && <div className="student-state-card student-state-card--error"><FileQuestion /><div><strong>Quizzes could not be loaded.</strong><p>{error}</p></div></div>}
      {loading ? (
        <div className="student-state-card"><LoaderCircle className="spin" /><div><strong>Loading teacher assessments…</strong><p>Checking quizzes assigned to your Grade and Section.</p></div></div>
      ) : quizzes.length ? (
        <section className="student-quiz-grid">
          {quizzes.map((quiz) => {
            const attempts = attemptsByQuiz[quiz.id] || [];
            const latest = attempts[0];
            const maxAttempts = Number(quiz.settings?.maxAttempts || 1);
            const attemptsRemaining = Math.max(0, maxAttempts - attempts.length);
            const overdue = quiz.settings?.dueAt && pageOpenedAt > new Date(quiz.settings.dueAt).getTime();
            return (
              <article className="student-quiz-card" key={quiz.id}>
                <div className="student-quiz-card__top"><span>{quiz.subject}</span><small>{quiz.gradingPeriod}</small></div>
                <div className="student-quiz-card__icon"><FileQuestion size={28} /></div>
                <h2>{quiz.title}</h2>
                <p>{quiz.description || "Read every question carefully and submit when you are ready."}</p>
                <div className="student-quiz-card__details">
                  <span><ClipboardList size={15} /> {quiz.questions?.length || 0} questions</span>
                  <span><Trophy size={15} /> {quiz.totalPoints || 0} points</span>
                  <span><CalendarClock size={15} /> {dueLabel(quiz.settings?.dueAt)}</span>
                  <span><Clock3 size={15} /> {attemptsRemaining} attempt{attemptsRemaining === 1 ? "" : "s"} remaining</span>
                </div>
                {latest && <div className={`student-quiz-result-badge is-${latest.status}`}><CheckCircle2 size={16} /><span><strong>{latest.status === "needs-review" ? "Waiting for teacher review" : `${latest.scorePercent}% score`}</strong><small>Submitted {new Date(latest.submittedAt).toLocaleDateString("en-PH")}</small></span></div>}
                <Link className={overdue || !attemptsRemaining ? "is-disabled" : ""} to={overdue || !attemptsRemaining ? "/student/quizzes" : `/student/quizzes/${quiz.id}`} aria-disabled={overdue || !attemptsRemaining}><PlayCircle size={18} />{overdue ? "Quiz closed" : attemptsRemaining ? (attempts.length ? "Try again" : "Open quiz") : "Attempts completed"}</Link>
              </article>
            );
          })}
        </section>
      ) : (
        <div className="student-state-card student-state-card--empty"><ClipboardList /><div><strong>No assigned quizzes yet.</strong><p>New quizzes published by the teacher of {profile?.gradeLevel} · {profile?.section} will appear here automatically.</p></div></div>
      )}
    </div>
  );
}
