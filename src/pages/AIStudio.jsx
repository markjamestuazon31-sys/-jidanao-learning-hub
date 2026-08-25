import {
  BookOpenCheck,
  CheckCircle2,
  FileSearch,
  FileUp,
  Gamepad2,
  LoaderCircle,
  Rocket,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useSchoolStructure } from "../context/SchoolStructureContext";
import { subjectsForGrade } from "../data/curriculum";
import { assignedClassOptions } from "../data/schoolClasses";
import { generateLessonWithAI } from "../services/aiService";
import { saveGame, saveLesson } from "../services/dataService";
import { extractDocumentText } from "../utils/documentTextExtractor";

const INITIAL_FORM = {
  grade: "",
  section: "",
  subject: "Mathematics",
  competency: "",
  lessonPlan: "",
  output: "lesson-and-game",
  status: "draft",
};

export default function AIStudio() {
  const { user, profile } = useAuth();
  const { structure } = useSchoolStructure();
  const classOptions = useMemo(() => assignedClassOptions(profile, { structure }), [profile, structure]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [result, setResult] = useState(null);
  const [material, setMaterial] = useState(null);
  const [busy, setBusy] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const subjectOptions = useMemo(() => subjectsForGrade(form.grade), [form.grade]);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!classOptions.length || form.grade) return;
    setForm((current) => ({ ...current, grade: classOptions[0].grade, section: classOptions[0].section }));
  }, [classOptions, form.grade]);

  useEffect(() => {
    if (!subjectOptions.length || subjectOptions.includes(form.subject)) return;
    setForm((current) => ({ ...current, subject: subjectOptions[0] }));
  }, [form.subject, subjectOptions]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function importFile(file) {
    if (!file) return;
    setExtracting(true);
    setMessage("");
    try {
      const extracted = await extractDocumentText(file);
      setMaterial(extracted);
      updateField("lessonPlan", extracted.text);
      setMessageType("success");
      setMessage(`${extracted.name} was read locally. ${extracted.text.length.toLocaleString()} characters are ready for teacher review.`);
    } catch (error) {
      setMaterial(null);
      if (fileRef.current) fileRef.current.value = "";
      setMessageType("error");
      setMessage(error.message || "The document could not be read.");
    } finally {
      setExtracting(false);
    }
  }

  async function generate(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const generated = await generateLessonWithAI(form);
      setResult(generated);
      setMessageType("success");
      setMessage("The source document was analyzed and converted into a structured teacher-review draft.");
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "The lesson draft could not be prepared.");
    } finally {
      setBusy(false);
    }
  }

  async function saveGeneratedContent() {
    if (!result || !user?.uid) return;
    setBusy(true);
    setMessage("");
    const shouldSaveLesson = form.output !== "game-only";
    const shouldSaveGame = form.output !== "lesson-only";
    try {
      const saved = [];
      const common = {
        grade: form.grade,
        section: form.section,
        subject: form.subject,
        competency: form.competency || result.learningObjectives?.[0] || "Teacher-reviewed competency",
        status: form.status,
        generationMode: result.generationMode,
        sourceDocument: material ? {
          name: material.name,
          contentType: material.contentType,
          size: material.size,
          extractedAt: material.extractedAt,
          extractionMode: material.extractionMode,
        } : null,
      };

      if (shouldSaveLesson) {
        await saveLesson(user.uid, {
          ...common,
          title: result.title,
          description: result.summary || result.learningObjectives?.[0],
          content: result.discussion,
          learningObjectives: result.learningObjectives,
          activities: result.activities,
          practice: result.practice,
          quiz: result.quiz,
          teacherReviewed: true,
        });
        saved.push("lesson");
      }

      if (shouldSaveGame) {
        const gameIdea = result.games?.[0] || {};
        await saveGame(user.uid, {
          ...common,
          title: gameIdea.title || `${result.title} Challenge`,
          description: `Interactive ${form.subject} practice generated from the teacher-approved lesson plan.`,
          learningGoal: gameIdea.learningGoal || common.competency,
          mechanic: gameIdea.mechanic || "Ten-question skill challenge",
          estimatedMinutes: 10,
          coverEmoji: form.subject === "Mathematics" ? "🎯" : "🎮",
          questions: Array.from({ length: 10 }, (_, index) => {
            const question = result.quiz[index % result.quiz.length];
            return {
            ...question,
            id: `generated-${index + 1}`,
            answer: question.choices?.[question.answerIndex],
            explanation: question.rationale,
          }; }),
          teacherReviewed: true,
        });
        saved.push("game");
      }

      setMessageType("success");
      setMessage(`${saved.join(" and ")} saved${form.status === "published" ? " to the public home and the matching student class" : " as a private draft"} for ${form.grade} · ${form.section}.`);
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Unable to save the generated learning content.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="teacher-studio-page">
      <header className="teacher-studio-hero">
        <div><span>SMART DOCUMENT STUDIO</span><h1>Turn a lesson plan into a lesson and game</h1><p>Import DOCX, text-based PDF, TXT, Markdown, CSV, or JSON. Jidanao reads it in this browser, prepares grade-appropriate content, and publishes only to your assigned class.</p></div>
        <div className="teacher-studio-privacy"><ShieldCheck size={20} /><div><strong>Private browser processing</strong><span>The original file is never uploaded. Only approved learning content is saved in Realtime Database.</span></div></div>
      </header>

      {!classOptions.length && <div className="alert error" role="alert">Your administrator must assign at least one grade and section before you can create learning content.</div>}
      {message && <div className={`alert ${messageType}`} role="status">{message}</div>}

      <div className="teacher-studio-layout">
        <section className="panel teacher-studio-builder">
          <div className="teacher-studio-section-heading"><span><WandSparkles size={20} /></span><div><h2>1. Source and class target</h2><p>Review extracted text before generating.</p></div></div>
          <form className="teacher-studio-form" onSubmit={generate}>
            <label className="teacher-studio-file span-2">
              <input ref={fileRef} type="file" accept=".docx,.pdf,.txt,.md,.markdown,.csv,.json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={(event) => void importFile(event.target.files?.[0])} />
              {extracting ? <LoaderCircle className="spin" size={28} /> : <FileUp size={28} />}
              <strong>{extracting ? "Reading document…" : "Import lesson-plan document"}</strong>
              <span>DOCX · text PDF · TXT · MD · CSV · JSON · maximum 8 MB</span>
            </label>

            <label>Assigned class<select value={`${form.grade}|${form.section}`} onChange={(event) => { const selected = classOptions.find((item) => `${item.grade}|${item.section}` === event.target.value); if (selected) setForm((current) => ({ ...current, grade: selected.grade, section: selected.section })); }} disabled={!classOptions.length}>{classOptions.map((item) => <option key={item.key} value={`${item.grade}|${item.section}`}>{item.label}</option>)}</select></label>
            <label>Subject<select value={form.subject} onChange={(event) => updateField("subject", event.target.value)}>{subjectOptions.map((subject) => <option key={subject}>{subject}</option>)}</select></label>
            <label className="span-2">Learning competency <small>Optional—Jidanao can infer a working competency from the document.</small><textarea rows={3} value={form.competency} onChange={(event) => updateField("competency", event.target.value)} placeholder="Example: Solve multi-step word problems using multiplication and addition." /></label>
            <label className="span-2">Extracted lesson text<textarea required rows={12} value={form.lessonPlan} onChange={(event) => updateField("lessonPlan", event.target.value)} placeholder="Import a document or paste the teacher-approved lesson plan here." /></label>
            <label>Generate<select value={form.output} onChange={(event) => updateField("output", event.target.value)}><option value="lesson-and-game">Lesson + game</option><option value="lesson-only">Lesson only</option><option value="game-only">Game only</option></select></label>
            <label>Save as<select value={form.status} onChange={(event) => updateField("status", event.target.value)}><option value="draft">Private draft</option><option value="published">Publish to class</option></select></label>
            <button className="primary-button span-2" disabled={busy || extracting || !classOptions.length}><Sparkles size={18} />{busy ? "Analyzing source…" : "Analyze and build learning content"}</button>
          </form>
        </section>

        <section className="panel teacher-studio-preview">
          <div className="teacher-studio-section-heading"><span><FileSearch size={20} /></span><div><h2>2. Teacher review</h2><p>Nothing is saved until you approve this preview.</p></div></div>
          {!result ? <div className="teacher-workspace-state"><FileSearch size={28} /><div><strong>Preview waiting</strong><p>Import or paste a lesson plan, then choose Analyze.</p></div></div> : <div className="teacher-studio-result">
            <div className="teacher-studio-result__title"><span>{form.grade} · {form.section} · {form.subject}</span><h3>{result.title}</h3><p>{result.summary}</p></div>
            <article><h4><BookOpenCheck size={17} /> Learning objectives</h4><ul>{result.learningObjectives?.map((item) => <li key={item}>{item}</li>)}</ul></article>
            <article><h4>Discussion plan</h4><ol>{result.discussion?.map((item) => <li key={item}>{item}</li>)}</ol></article>
            <div className="teacher-studio-result__metrics"><span><strong>{result.activities?.length || 0}</strong> activities</span><span><strong>{result.practice?.length || 0}</strong> guided practice</span><span><strong>{result.quiz?.length || 0}</strong> quiz items</span></div>
            <article><h4><Gamepad2 size={17} /> Generated game</h4><p><strong>{result.games?.[0]?.title}</strong> — {result.games?.[0]?.mechanic}</p></article>
            <button type="button" className="success-button" onClick={() => void saveGeneratedContent()} disabled={busy}><Rocket size={18} />{busy ? "Saving…" : form.status === "published" ? "Approve and publish to class" : "Approve into draft workspace"}</button>
            <p className="teacher-studio-approval"><CheckCircle2 size={14} /> Publishing makes the content visible only to students in {form.grade} · {form.section}.</p>
          </div>}
        </section>
      </div>
    </div>
  );
}
