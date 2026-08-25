import {
  ArrowRight,
  BookOpen,
  BookOpenText,
  CirclePercent,
  FlaskConical,
  Gamepad2,
  Languages,
  LockKeyhole,
  Play,
  Puzzle,
  Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { learningHref } from "../utils/studentProgress";

const SUBJECT_VISUALS = {
  Mathematics: {
    theme: "math",
    icon: CirclePercent,
    cue: "12 / 14",
  },
  English: {
    theme: "language",
    icon: BookOpenText,
    cue: "Aa Bb",
  },
  "Reading Comprehension": {
    theme: "reading",
    icon: BookOpenText,
    cue: "Read • Think",
  },
  Science: {
    theme: "science",
    icon: FlaskConical,
    cue: "Explore",
  },
  Filipino: {
    theme: "filipino",
    icon: Languages,
    cue: "Salita",
  },
};

function getGradeLabel(grade) {
  if (!grade) return "All Grades";

  const value = String(grade).trim();
  return /^grade\s/i.test(value) ? value : `Grade ${value}`;
}

export default function FeaturedLearningCard({ item }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isGame = item.type === "game";
  const visual = SUBJECT_VISUALS[item.subject] || {
    theme: isGame ? "game" : "general",
    icon: isGame ? Puzzle : BookOpen,
    cue: isGame ? "Play & Learn" : "Discover",
  };
  const VisualIcon = isGame ? Gamepad2 : visual.icon;
  const destination = learningHref(item);
  const gradeLabel = getGradeLabel(item.grade);

  function openContent() {
    if (user) {
      navigate(destination);
      return;
    }

    navigate("/login", { state: { from: destination } });
  }

  return (
    <article className="home-feature-card">
      <div
        className={`home-feature-card__cover home-feature-card__cover--${visual.theme} ${
          isGame ? "is-game" : "is-lesson"
        }`}
      >
        <span className="home-feature-card__type">
          {isGame ? <Gamepad2 size={13} /> : <BookOpen size={13} />}
          {isGame ? "Game" : "Lesson"}
        </span>

        <span className="home-feature-card__cover-icon">
          <VisualIcon size={21} />
        </span>

        <div className="home-feature-card__art">
          <span className="home-feature-card__art-icon">
            <VisualIcon size={52} strokeWidth={1.8} />
          </span>
          <strong>{visual.cue}</strong>
          <span className="home-feature-card__sparkle home-feature-card__sparkle--one">
            <Sparkles size={18} />
          </span>
          <span className="home-feature-card__sparkle home-feature-card__sparkle--two">
            <Sparkles size={13} />
          </span>
        </div>
      </div>

      <div className="home-feature-card__body">
        <h3>{item.title}</h3>
        <p>
          {item.description ||
            item.summary ||
            "Explore this teacher-created learning activity."}
        </p>

        <div className="home-feature-card__meta">
          <span>{item.subject || "General Learning"}</span>
          <span>{gradeLabel}</span>
        </div>

        <button
          className="home-feature-card__action"
          type="button"
          onClick={openContent}
          aria-label={`${user ? "Open" : "Login to access"} ${item.title}`}
        >
          {user ? <Play size={16} /> : <LockKeyhole size={16} />}
          <span>{user ? "Open activity" : "Login to access"}</span>
          <ArrowRight size={16} className="home-feature-card__action-arrow" />
        </button>
      </div>
    </article>
  );
}
