import { ChevronDown, ChevronUp, CircleHelp, Home, Lightbulb, MoveRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

const GUIDES = [
  {
    match: /^\/teacher\/dashboard$/,
    title: "Teacher home",
    description: "Start here to see your classes and choose what you want to do today.",
    steps: ["Choose your class", "Choose a teaching task", "Review student updates"],
    action: { label: "Create learning content", to: "/teacher/content-studio" },
  },
  {
    match: /^\/teacher\/content-studio$/,
    title: "Create lessons and games",
    description: "Make a lesson, a learning game, or both for one assigned class.",
    steps: ["Choose the class", "Enter or import the lesson", "Preview, then publish"],
    action: { label: "View my students", to: "/teacher/students" },
  },
  {
    match: /^\/teacher\/camera-content$/,
    title: "Create Camera Math and Reading",
    description: "Prepare the exact activities students will play in the camera games.",
    steps: ["Choose class and game", "Complete all 10 items", "Check answers, then publish"],
    action: { label: "Open regular content", to: "/teacher/content-studio" },
  },
  {
    match: /^\/teacher\/game-zone$/,
    title: "Teacher Game Zone",
    description: "Play every published teacher game on a shared laptop or classroom TV and save the selected learner’s answers.",
    steps: ["Choose class and published game", "Choose or add the learner", "Start TV Game and save answers"],
    action: { label: "Publish another game", to: "/teacher/content-studio" },
  },
  {
    match: /^\/teacher\/students$/,
    title: "My students",
    description: "Only learners from your assigned Grade and Section appear here.",
    steps: ["Choose a class", "Search for a learner", "Review progress"],
    action: { label: "Take attendance", to: "/teacher/attendance" },
  },
  {
    match: /^\/teacher\/attendance$/,
    title: "Attendance",
    description: "Record one class for one school day, then save the attendance sheet.",
    steps: ["Choose class and date", "Mark each learner", "Save attendance"],
    action: { label: "Open my students", to: "/teacher/students" },
  },
  {
    match: /^\/teacher\/quizzes\/new$/,
    title: "Create a quiz",
    description: "Build a familiar form-style quiz and send it only to the selected class.",
    steps: ["Add quiz details", "Add and check questions", "Preview, then publish"],
    action: { label: "Back to quizzes", to: "/teacher/quizzes" },
  },
  {
    match: /^\/teacher\/quizzes\/[^/]+\/edit$/,
    title: "Edit quiz",
    description: "Update the questions or class settings, then save your changes.",
    steps: ["Review quiz details", "Check questions and points", "Save or publish"],
    action: { label: "Back to quizzes", to: "/teacher/quizzes" },
  },
  {
    match: /^\/teacher\/quizzes\/[^/]+\/results$/,
    title: "Quiz results",
    description: "Review submitted answers, adjust scores when needed, and save feedback.",
    steps: ["Choose a response", "Review answers", "Save final score"],
    action: { label: "Back to quizzes", to: "/teacher/quizzes" },
  },
  {
    match: /^\/teacher\/quizzes$/,
    title: "Quizzes",
    description: "Create, publish, and review quizzes for your assigned classes.",
    steps: ["Choose a class", "Create or open a quiz", "Check responses"],
    action: { label: "Create a quiz", to: "/teacher/quizzes/new" },
  },
  {
    match: /^\/teacher\/grades$/,
    title: "Grades",
    description: "Record and release grading-period results for one assigned class.",
    steps: ["Choose class and period", "Enter or review grades", "Save and release"],
    action: { label: "Open quiz results", to: "/teacher/quizzes" },
  },
  {
    match: /^\/teacher\/reports$/,
    title: "Reports",
    description: "Review class performance and download records for school reporting.",
    steps: ["Choose a class", "Choose the report", "Review or download"],
    action: { label: "Open grades", to: "/teacher/grades" },
  },
];

export default function TeacherPageGuide() {
  const { pathname } = useLocation();
  const [expanded, setExpanded] = useState(() => window.localStorage.getItem("jidanao-teacher-guide-open") !== "false");
  const guide = useMemo(() => GUIDES.find((item) => item.match.test(pathname)) || GUIDES[0], [pathname]);

  useEffect(() => {
    window.localStorage.setItem("jidanao-teacher-guide-open", String(expanded));
  }, [expanded]);

  return (
    <section className={`teacher-page-guide ${expanded ? "is-open" : "is-closed"}`} aria-label="Page instructions">
      <div className="teacher-page-guide__top">
        <div className="teacher-page-guide__identity">
          <span><Lightbulb size={21} /></span>
          <div><small>YOU ARE HERE</small><strong>{guide.title}</strong></div>
        </div>
        <button type="button" onClick={() => setExpanded((current) => !current)} aria-expanded={expanded}>
          <CircleHelp size={18} />
          <span>{expanded ? "Hide guide" : "Show guide"}</span>
          {expanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
        </button>
      </div>
      {expanded && (
        <div className="teacher-page-guide__body">
          <p>{guide.description}</p>
          <ol>{guide.steps.map((step) => <li key={step}><span>{step}</span></li>)}</ol>
          <div className="teacher-page-guide__links">
            <Link to="/teacher/dashboard"><Home size={16} /> Teacher home</Link>
            <Link className="is-primary" to={guide.action.to}>{guide.action.label} <MoveRight size={16} /></Link>
          </div>
        </div>
      )}
    </section>
  );
}
