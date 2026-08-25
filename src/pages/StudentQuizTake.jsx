import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileQuestion,
  LoaderCircle,
  Send,
  Sparkles,
  Trophy,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getGradeExperience } from "../data/gradeExperience";
import { getPublishedQuiz, getStudentQuizAttempts, submitQuizAttempt } from "../services/assessmentService";

function QuestionInput({ question, value, onChange, reveal }) {
  const resultClass = reveal?.correct === true ? "is-correct" : reveal?.correct === false ? "is-wrong" : "";
  if (question.type === "paragraph") {
    return <textarea className={resultClass} rows={6} value={value || ""} onChange={(event) => onChange(event.target.value)} placeholder="Write your complete response…" disabled={Boolean(reveal)} />;
  }
  if (question.type === "short-answer") {
    return <input className={resultClass} value={value || ""} onChange={(event) => onChange(event.target.value)} placeholder="Your answer" disabled={Boolean(reveal)} />;
  }
  const values = Array.isArray(value) ? value : [];
  return (
    <div className={`student-form-options ${resultClass}`}>
      {(question.options || []).map((option, index) => {
        const checked = question.type === "checkboxes" ? values.includes(index) : Number(value) === index;
        return (
          <label key={`${question.id}-${index}`}>
            <input
              type={question.type === "checkboxes" ? "checkbox" : "radio"}
              name={question.id}
              checked={checked}
              disabled={Boolean(reveal)}
              onChange={() => {
                if (question.type !== "checkboxes") onChange(index);
                else onChange(checked ? values.filter((item) => item !== index) : [...values, index]);
              }}
            />
            <span>{option}</span>
          </label>
        );
      })}
    </div>
  );
}

export default function StudentQuizTake() {
  const { quizId } = useParams();
  const { user, profile } = useAuth();
  const experience = getGradeExperience(profile?.gradeLevel);
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [attempts, setAttempts] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile?.classKey || !quizId || !user?.uid) return;
    Promise.all([getPublishedQuiz(profile.classKey, quizId), getStudentQuizAttempts(quizId, user.uid)])
      .then(([record, history]) => {
        setQuiz(record);
        setAttempts(history);
        const source = [...(record.questions || [])];
        setQuestions(record.settings?.shuffleQuestions ? source.sort(() => Math.random() - 0.5) : source);
      })
      .catch((loadError) => setError(loadError.message || "Unable to open this quiz."))
      .finally(() => setLoading(false));
  }, [profile?.classKey, quizId, user?.uid]);

  const completion = useMemo(() => {
    if (!questions.length) return 0;
    const answered = questions.filter((question) => {
      const answer = answers[question.id];
      return answer !== undefined && answer !== "" && (!Array.isArray(answer) || answer.length);
    }).length;
    return Math.round((answered / questions.length) * 100);
  }, [answers, questions]);

  async function submit(event) {
    event.preventDefault();
    if (!window.confirm("Submit your responses now? You cannot edit this attempt afterward.")) return;
    setSubmitting(true);
    setError("");
    try {
      const saved = await submitQuizAttempt(quiz, answers);
      setResult(saved);
      setAttempts((current) => [saved, ...current]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (submitError) {
      setError(submitError.message || "Unable to submit your quiz.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="student-state-card"><LoaderCircle className="spin" /><div><strong>Opening quiz form…</strong><p>Loading the questions assigned to your class.</p></div></div>;
  if (error && !quiz) return <div className="student-state-card student-state-card--error"><AlertCircle /><div><strong>Quiz unavailable</strong><p>{error}</p><Link to="/student/quizzes">Return to My Quizzes</Link></div></div>;

  const gradingByQuestion = Object.fromEntries((result?.grading || []).map((item) => [item.questionId, item]));
  const remaining = Math.max(0, Number(quiz.settings?.maxAttempts || 1) - attempts.length);

  return (
    <div className={`student-portal student-form-page student-theme--${experience.theme}`}>
      <header className="student-form-header">
        <Link to="/student/quizzes"><ArrowLeft size={18} /> My quizzes</Link>
        <div><span>{quiz.subject} · {quiz.gradingPeriod}</span><h1>{quiz.title}</h1><p>{quiz.description || "Read every item carefully. Required questions are marked with an asterisk."}</p></div>
        <aside><strong>{quiz.totalPoints || 0}</strong><span>total points</span><small>{questions.length} questions</small></aside>
      </header>

      {error && <div className="alert error" role="alert">{error}</div>}

      {result && (
        <section className={`student-quiz-submitted ${result.manualReviewRequired ? "needs-review" : "is-graded"}`}>
          <span>{result.manualReviewRequired ? <Clock3 size={30} /> : <Trophy size={30} />}</span>
          <div>
            <small>RESPONSE RECORDED</small>
            <h2>{result.manualReviewRequired ? "Your teacher will review this response" : "Quiz completed!"}</h2>
            <p>{result.manualReviewRequired ? `Your objective items earned ${result.autoScore} of ${result.maxPoints} points so far. Paragraph points will be added by your teacher.` : quiz.settings?.showScore ? `You earned ${result.finalScore} of ${result.maxPoints} points (${result.scorePercent}%).` : "Your teacher has received your response."}</p>
          </div>
          <Link to="/student/quizzes"><CheckCircle2 size={17} /> Return to quizzes</Link>
        </section>
      )}

      <div className="student-form-progress"><div><span>Form completion</span><strong>{completion}%</strong></div><i><b style={{ width: `${completion}%` }} /></i></div>

      <form className="student-google-form" onSubmit={submit}>
        <section className="student-google-form__identity"><FileQuestion size={20} /><div><strong>{profile?.name}</strong><span>{profile?.gradeLevel} · {profile?.section} · {profile?.email}</span></div><small>Your identity is recorded with this response.</small></section>

        {questions.map((question, index) => {
          const reveal = result && quiz.settings?.showCorrectAnswers ? gradingByQuestion[question.id] : result ? { correct: null } : null;
          return (
            <article className={`student-form-question ${gradingByQuestion[question.id]?.correct === true ? "is-correct" : gradingByQuestion[question.id]?.correct === false ? "is-wrong" : ""}`} key={question.id}>
              <header><span>{index + 1}</span><div><h2>{question.prompt}{question.required && <b aria-label="Required"> *</b>}</h2>{question.description && <p>{question.description}</p>}</div><small>{question.points} point{question.points === 1 ? "" : "s"}</small></header>
              <QuestionInput question={question} value={answers[question.id]} onChange={(value) => setAnswers((current) => ({ ...current, [question.id]: value }))} reveal={reveal} />
              {result && quiz.settings?.showCorrectAnswers && gradingByQuestion[question.id]?.correct === true && <div className="student-answer-feedback is-correct"><CheckCircle2 size={16} /> Correct answer</div>}
              {result && quiz.settings?.showCorrectAnswers && gradingByQuestion[question.id]?.correct === false && <div className="student-answer-feedback is-wrong"><AlertCircle size={16} /> Review this item with your teacher.</div>}
              {result && gradingByQuestion[question.id]?.manual && <div className="student-answer-feedback"><Clock3 size={16} /> Waiting for teacher review.</div>}
            </article>
          );
        })}

        {!result ? (
          <footer className="student-form-submit"><div><Sparkles size={19} /><span><strong>Ready to submit?</strong><small>You have {remaining} attempt{remaining === 1 ? "" : "s"} available including this one.</small></span></div><button className="primary-button" disabled={submitting}><Send size={18} /> {submitting ? "Submitting…" : "Submit responses"}</button></footer>
        ) : (
          <footer className="student-form-submit"><div><ClipboardCheck size={19} /><span><strong>Response saved</strong><small>Your teacher can now view this result.</small></span></div><Link className="primary-button" to="/student/quizzes">Done</Link></footer>
        )}
      </form>
    </div>
  );
}
