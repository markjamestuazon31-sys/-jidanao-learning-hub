import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  CirclePlus,
  ClipboardList,
  Copy,
  Eye,
  GripVertical,
  ListChecks,
  Plus,
  Save,
  Send,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSchoolStructure } from "../context/SchoolStructureContext";
import { subjectsForGrade } from "../data/curriculum";
import { assignedClassOptions } from "../data/schoolClasses";
import { getAcademicSettings } from "../services/dataService";
import {
  GRADING_PERIODS,
  QUESTION_TYPES,
  createQuestion,
  getTeacherQuiz,
  saveTeacherQuiz,
} from "../services/assessmentService";

const EMPTY_QUIZ = {
  title: "Untitled quiz",
  description: "",
  grade: "",
  section: "",
  subject: "Mathematics",
  gradingPeriod: GRADING_PERIODS[0],
  schoolYear: "2026-2027",
  questions: [createQuestion()],
  settings: {
    shuffleQuestions: false,
    showScore: true,
    showCorrectAnswers: false,
    maxAttempts: 1,
    dueAt: "",
  },
};

function cloneQuestion(question) {
  return { ...structuredClone(question), id: `question-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
}

function typeDefaults(question, type) {
  return { ...createQuestion(type), id: question.id, prompt: question.prompt, description: question.description, required: question.required, points: question.points };
}

function OptionEditor({ question, onChange }) {
  if (question.type === "short-answer") {
    const acceptedAnswers = question.acceptedAnswers?.length ? question.acceptedAnswers : [""];
    return (
      <div className="quiz-answer-editor">
        <span className="quiz-answer-editor__label">Accepted answers</span>
        {acceptedAnswers.map((answer, index) => (
          <div className="quiz-option-row" key={`answer-${index}`}>
            <CheckCircle2 size={17} />
            <input
              value={answer}
              onChange={(event) => onChange({ ...question, acceptedAnswers: acceptedAnswers.map((item, itemIndex) => itemIndex === index ? event.target.value : item) })}
              placeholder="Accepted answer"
            />
            {acceptedAnswers.length > 1 && <button type="button" onClick={() => onChange({ ...question, acceptedAnswers: acceptedAnswers.filter((_, itemIndex) => itemIndex !== index) })} aria-label="Remove accepted answer"><X size={16} /></button>}
          </div>
        ))}
        <button type="button" className="quiz-inline-action" onClick={() => onChange({ ...question, acceptedAnswers: [...acceptedAnswers, ""] })}><Plus size={15} /> Add another accepted answer</button>
        <label className="quiz-mini-toggle"><input type="checkbox" checked={Boolean(question.caseSensitive)} onChange={(event) => onChange({ ...question, caseSensitive: event.target.checked })} /><span>Case-sensitive checking</span></label>
      </div>
    );
  }

  if (question.type === "paragraph") {
    return <div className="quiz-manual-note"><ClipboardList size={18} /><div><strong>Teacher-reviewed response</strong><span>Students can write a long answer. You will assign the final points from the Results page.</span></div></div>;
  }

  const options = question.type === "true-false" ? ["True", "False"] : question.options || ["Option 1", "Option 2"];
  const checkboxType = question.type === "checkboxes";
  return (
    <div className="quiz-answer-editor">
      <span className="quiz-answer-editor__label">Options and answer key</span>
      {options.map((option, index) => {
        const checked = checkboxType ? (question.correctAnswers || []).includes(index) : Number(question.answerIndex) === index;
        return (
          <div className="quiz-option-row" key={`${question.id}-option-${index}`}>
            <input
              className="quiz-answer-control"
              type={checkboxType ? "checkbox" : "radio"}
              name={`answer-${question.id}`}
              checked={checked}
              onChange={() => {
                if (checkboxType) {
                  const current = question.correctAnswers || [];
                  onChange({ ...question, correctAnswers: current.includes(index) ? current.filter((value) => value !== index) : [...current, index] });
                } else onChange({ ...question, answerIndex: index });
              }}
              aria-label={`Mark option ${index + 1} as correct`}
            />
            <input
              value={option}
              disabled={question.type === "true-false"}
              onChange={(event) => onChange({ ...question, options: options.map((item, itemIndex) => itemIndex === index ? event.target.value : item) })}
              placeholder={`Option ${index + 1}`}
            />
            {question.type !== "true-false" && options.length > 2 && (
              <button type="button" onClick={() => {
                const nextOptions = options.filter((_, itemIndex) => itemIndex !== index);
                if (checkboxType) onChange({ ...question, options: nextOptions, correctAnswers: (question.correctAnswers || []).filter((value) => value !== index).map((value) => value > index ? value - 1 : value) });
                else onChange({ ...question, options: nextOptions, answerIndex: Math.max(0, Math.min(nextOptions.length - 1, question.answerIndex > index ? question.answerIndex - 1 : question.answerIndex)) });
              }} aria-label="Remove option"><X size={16} /></button>
            )}
          </div>
        );
      })}
      {question.type !== "true-false" && options.length < 12 && <button type="button" className="quiz-inline-action" onClick={() => onChange({ ...question, options: [...options, `Option ${options.length + 1}`] })}><Plus size={15} /> Add option</button>}
      <small>Select the circle or checkbox beside every correct answer.</small>
    </div>
  );
}

function QuizQuestionCard({ question, index, count, onChange, onDelete, onDuplicate, onMove }) {
  return (
    <article className="quiz-builder-question">
      <div className="quiz-builder-question__top">
        <span className="quiz-question-drag"><GripVertical size={20} /><b>Question {index + 1}</b></span>
        <select value={question.type} onChange={(event) => onChange(typeDefaults(question, event.target.value))} aria-label="Question type">
          {QUESTION_TYPES.map((type) => <option value={type.value} key={type.value}>{type.label}</option>)}
        </select>
      </div>
      <div className="quiz-builder-question__prompt">
        <label><span className="sr-only">Question</span><input value={question.prompt} onChange={(event) => onChange({ ...question, prompt: event.target.value })} placeholder="Question" /></label>
        <label className="quiz-points-input"><input type="number" min="0" max="100" value={question.points} onChange={(event) => onChange({ ...question, points: Number(event.target.value) })} /><span>points</span></label>
      </div>
      <input className="quiz-question-description" value={question.description || ""} onChange={(event) => onChange({ ...question, description: event.target.value })} placeholder="Description or instructions (optional)" />
      <OptionEditor question={question} onChange={onChange} />
      <footer className="quiz-builder-question__footer">
        <div>
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Move question up"><ArrowUp size={17} /></button>
          <button type="button" onClick={() => onMove(1)} disabled={index === count - 1} aria-label="Move question down"><ArrowDown size={17} /></button>
        </div>
        <div>
          <button type="button" onClick={onDuplicate} title="Duplicate question"><Copy size={17} /></button>
          <button type="button" onClick={onDelete} disabled={count === 1} title="Delete question"><Trash2 size={17} /></button>
          <span className="quiz-footer-divider" />
          <label className="quiz-required-toggle"><span>Required</span><input type="checkbox" checked={question.required !== false} onChange={(event) => onChange({ ...question, required: event.target.checked })} /></label>
        </div>
      </footer>
    </article>
  );
}

export default function TeacherQuizBuilder() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { structure } = useSchoolStructure();
  const classOptions = useMemo(() => assignedClassOptions(profile, { includeAllSections: false, structure }), [profile, structure]);
  const [quiz, setQuiz] = useState(EMPTY_QUIZ);
  const subjectOptions = useMemo(() => subjectsForGrade(quiz.grade), [quiz.grade]);
  const [loading, setLoading] = useState(Boolean(quizId));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getAcademicSettings().then((settings) => setQuiz((current) => ({
      ...current,
      schoolYear: settings.schoolYear || current.schoolYear,
      gradingPeriod: settings.activeGradingPeriod || current.gradingPeriod,
    }))).catch(() => {});
  }, []);

  useEffect(() => {
    if (!classOptions.length || quiz.grade) return;
    setQuiz((current) => ({ ...current, grade: classOptions[0].grade, section: classOptions[0].section }));
  }, [classOptions, quiz.grade]);

  useEffect(() => {
    if (!subjectOptions.length || subjectOptions.includes(quiz.subject)) return;
    setQuiz((current) => ({ ...current, subject: subjectOptions[0] }));
  }, [quiz.subject, subjectOptions]);

  useEffect(() => {
    if (!quizId || !user?.uid) return;
    setLoading(true);
    getTeacherQuiz(user.uid, quizId)
      .then((record) => setQuiz({ ...EMPTY_QUIZ, ...record, settings: { ...EMPTY_QUIZ.settings, ...record.settings } }))
      .catch((loadError) => setError(loadError.message || "Unable to load this quiz."))
      .finally(() => setLoading(false));
  }, [quizId, user?.uid]);

  function updateQuestion(index, nextQuestion) {
    setQuiz((current) => ({ ...current, questions: current.questions.map((question, itemIndex) => itemIndex === index ? nextQuestion : question) }));
  }

  function moveQuestion(index, direction) {
    setQuiz((current) => {
      const questions = [...current.questions];
      const target = index + direction;
      if (target < 0 || target >= questions.length) return current;
      [questions[index], questions[target]] = [questions[target], questions[index]];
      return { ...current, questions };
    });
  }

  async function save(status) {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const saved = await saveTeacherQuiz(user.uid, quiz, status);
      setQuiz(saved);
      setMessage(status === "published" ? `Quiz published to ${saved.grade} · ${saved.section}.` : "Quiz draft saved.");
      if (!quizId) navigate(`/teacher/quizzes/${saved.id}/edit`, { replace: true });
    } catch (saveError) {
      setError(saveError.message || "Unable to save this quiz.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="teacher-workspace-state">Loading quiz builder…</div>;

  return (
    <div className="quiz-builder-page">
      <header className="quiz-builder-toolbar">
        <Link to="/teacher/quizzes" className="quiz-toolbar-icon" aria-label="Back to Quiz Bank"><ArrowLeft size={20} /></Link>
        <div className="quiz-builder-toolbar__identity"><span><ListChecks size={21} /></span><div><strong>Jidanao Quiz Studio</strong><small>{quiz.status === "published" ? "Published assessment" : "Teacher draft"}</small></div></div>
        <div className="quiz-builder-toolbar__actions">
          {quiz.id && <Link className="ghost-button" to={`/teacher/quizzes/${quiz.id}/results`}><Eye size={17} /> Results</Link>}
          <button type="button" className="ghost-button" disabled={saving} onClick={() => save("draft")}><Save size={17} /> Save draft</button>
          <button type="button" className="primary-button" disabled={saving || !classOptions.length} onClick={() => save("published")}><Send size={17} /> {saving ? "Saving…" : "Publish"}</button>
        </div>
      </header>

      {error && <div className="alert error" role="alert">{error}</div>}
      {message && <div className="alert success" role="status">{message}</div>}
      {!classOptions.length && <div className="alert error">Ask an administrator to assign your Grade and Section before building a quiz.</div>}

      <div className="quiz-builder-layout">
        <main className="quiz-builder-canvas">
          <section className="quiz-builder-title-card">
            <span className="quiz-form-accent" />
            <input className="quiz-title-input" value={quiz.title} onChange={(event) => setQuiz((current) => ({ ...current, title: event.target.value }))} aria-label="Quiz title" />
            <textarea value={quiz.description} onChange={(event) => setQuiz((current) => ({ ...current, description: event.target.value }))} placeholder="Quiz description and student instructions" rows={2} />
            <div className="quiz-builder-class-strip"><span>{quiz.grade || "Grade"} · {quiz.section || "Section"}</span><span>{quiz.subject}</span><span>{quiz.gradingPeriod}</span><span>{quiz.questions.reduce((sum, item) => sum + Number(item.points || 0), 0)} total points</span></div>
          </section>

          {quiz.questions.map((question, index) => (
            <QuizQuestionCard
              key={question.id}
              question={question}
              index={index}
              count={quiz.questions.length}
              onChange={(next) => updateQuestion(index, next)}
              onDelete={() => setQuiz((current) => ({ ...current, questions: current.questions.filter((_, itemIndex) => itemIndex !== index) }))}
              onDuplicate={() => setQuiz((current) => ({ ...current, questions: [...current.questions.slice(0, index + 1), cloneQuestion(question), ...current.questions.slice(index + 1)] }))}
              onMove={(direction) => moveQuestion(index, direction)}
            />
          ))}

          <button type="button" className="quiz-add-question" onClick={() => setQuiz((current) => ({ ...current, questions: [...current.questions, createQuestion()] }))}><CirclePlus size={20} /> Add question</button>
        </main>

        <aside className="quiz-builder-settings">
          <section>
            <div className="quiz-settings-heading"><Settings2 size={18} /><div><strong>Quiz assignment</strong><span>Only this class will receive it.</span></div></div>
            <label>Grade and Section<select value={`${quiz.grade}|${quiz.section}`} onChange={(event) => { const selected = classOptions.find((item) => `${item.grade}|${item.section}` === event.target.value); if (selected) setQuiz((current) => ({ ...current, grade: selected.grade, section: selected.section })); }} disabled={!classOptions.length}>{classOptions.map((item) => <option value={`${item.grade}|${item.section}`} key={item.key}>{item.label}</option>)}</select></label>
            <label>Subject<select value={quiz.subject} onChange={(event) => setQuiz((current) => ({ ...current, subject: event.target.value }))}>{subjectOptions.map((subject) => <option key={subject}>{subject}</option>)}</select></label>
            <label>Grading period<select value={quiz.gradingPeriod} onChange={(event) => setQuiz((current) => ({ ...current, gradingPeriod: event.target.value }))}>{GRADING_PERIODS.map((period) => <option key={period}>{period}</option>)}</select></label>
            <label>School year<input value={quiz.schoolYear} onChange={(event) => setQuiz((current) => ({ ...current, schoolYear: event.target.value }))} placeholder="2026-2027" /></label>
            <label>Due date and time<input type="datetime-local" value={quiz.settings.dueAt || ""} onChange={(event) => setQuiz((current) => ({ ...current, settings: { ...current.settings, dueAt: event.target.value } }))} /></label>
            <label>Maximum attempts<select value={quiz.settings.maxAttempts} onChange={(event) => setQuiz((current) => ({ ...current, settings: { ...current.settings, maxAttempts: Number(event.target.value) } }))}>{[1, 2, 3, 4, 5].map((value) => <option value={value} key={value}>{value}</option>)}</select></label>
          </section>
          <section>
            <div className="quiz-settings-heading"><CheckCircle2 size={18} /><div><strong>Response settings</strong><span>Google Forms-style behavior.</span></div></div>
            <label className="quiz-setting-toggle"><span><strong>Shuffle questions</strong><small>Randomize order for each learner.</small></span><input type="checkbox" checked={quiz.settings.shuffleQuestions} onChange={(event) => setQuiz((current) => ({ ...current, settings: { ...current.settings, shuffleQuestions: event.target.checked } }))} /></label>
            <label className="quiz-setting-toggle"><span><strong>Show score</strong><small>Display the result after submission.</small></span><input type="checkbox" checked={quiz.settings.showScore} onChange={(event) => setQuiz((current) => ({ ...current, settings: { ...current.settings, showScore: event.target.checked } }))} /></label>
            <label className="quiz-setting-toggle"><span><strong>Show correct answers</strong><small>Reveal the answer key after submission.</small></span><input type="checkbox" checked={quiz.settings.showCorrectAnswers} onChange={(event) => setQuiz((current) => ({ ...current, settings: { ...current.settings, showCorrectAnswers: event.target.checked } }))} /></label>
          </section>
          <div className="quiz-publish-note"><Send size={18} /><div><strong>Class-scoped publishing</strong><span>Publishing copies this assessment only to the selected assigned Grade and Section.</span></div></div>
        </aside>
      </div>
    </div>
  );
}
