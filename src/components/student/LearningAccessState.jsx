import {
  ArrowLeft,
  BookOpenCheck,
  Gamepad2,
  GraduationCap,
  LayoutDashboard,
  LockKeyhole,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { Link } from "react-router-dom";

function accessCopy(code, type, grade) {
  const noun = type === "game" ? "game" : "lesson";
  const gradeLabel = grade || "your assigned grade";

  if (code === "permission-denied") {
    return {
      eyebrow: "GRADE-PROTECTED CONTENT",
      title: `This ${noun} is outside your learning access`,
      message: `Your student account can only open published ${gradeLabel} activities. Choose another activity from your protected learning library.`,
    };
  }

  if (code === "not-found") {
    return {
      eyebrow: "CONTENT UNAVAILABLE",
      title: `This ${noun} is no longer available`,
      message: "It may have been archived, replaced, or removed from the published learning catalog.",
    };
  }

  if (code === "unauthenticated") {
    return {
      eyebrow: "SESSION EXPIRED",
      title: "Sign in again to continue",
      message: "Your secure learning session could not be verified.",
    };
  }

  return {
    eyebrow: "SECURE LEARNING ACCESS",
    title: `We couldn't open this ${noun}`,
    message: "The protected learning service could not load this activity. Check your connection and try again.",
  };
}

export default function LearningAccessState({ type = "lesson", error, grade, role }) {
  const isGame = type === "game";
  const Icon = isGame ? Gamepad2 : BookOpenCheck;
  const copy = accessCopy(error?.code, type, grade);
  const libraryPath = role === "student"
    ? isGame ? "/student/games" : "/student/lessons"
    : isGame ? "/games" : "/library";
  const dashboardPath = role === "student"
    ? "/student/dashboard"
    : role === "teacher"
      ? "/teacher/dashboard"
      : role === "admin"
        ? "/admin/dashboard"
        : "/";

  return (
    <main className="learning-access-state" role="alert" aria-live="polite">
      <section className="learning-access-state__card">
        <div className="learning-access-state__shield" aria-hidden="true">
          <ShieldAlert size={34} />
        </div>

        <div className="learning-access-state__copy">
          <span>{copy.eyebrow}</span>
          <h1>{copy.title}</h1>
          <p>{error?.message || copy.message}</p>
        </div>

        {role === "student" && (
          <div className="learning-access-state__profile">
            <div><GraduationCap size={20} /></div>
            <span>
              <small>YOUR ASSIGNED LEARNING LEVEL</small>
              <strong>{grade || "Grade profile required"}</strong>
            </span>
            <LockKeyhole size={18} aria-label="Protected" />
          </div>
        )}

        <div className="learning-access-state__notice">
          <Icon size={20} />
          <p>
            Full learning content is protected. Students receive only published
            activities assigned to their authenticated grade profile.
          </p>
        </div>

        <div className="learning-access-state__actions">
          <Link className="learning-access-state__primary" to={libraryPath}>
            <ArrowLeft size={17} /> Return to {isGame ? "my games" : "my lessons"}
          </Link>
          <Link className="learning-access-state__secondary" to={dashboardPath}>
            <LayoutDashboard size={17} /> Learning dashboard
          </Link>
          {error?.code === "unavailable" && (
            <button type="button" onClick={() => window.location.reload()}>
              <RefreshCw size={17} /> Try again
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
