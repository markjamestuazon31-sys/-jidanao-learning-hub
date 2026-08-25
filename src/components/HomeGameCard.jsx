import {
  ArrowRight,
  Award,
  BookOpenText,
  Calculator,
  Camera,
  Clock3,
  FlaskConical,
  Gamepad2,
  Languages,
  Layers3,
  LockKeyhole,
  Mic2,
  Play,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { learningHref } from "../utils/studentProgress";

const GAME_THEMES = {
  math: {
    theme: "math",
    icon: Calculator,
    companion: Camera,
    kicker: "Move • Choose • Solve",
  },
  english: {
    theme: "english",
    icon: BookOpenText,
    companion: Mic2,
    kicker: "Read • Listen • Improve",
  },
  filipino: {
    theme: "filipino",
    icon: Languages,
    companion: Mic2,
    kicker: "Basa • Bigkas • Unawa",
  },
  science: {
    theme: "science",
    icon: FlaskConical,
    companion: Sparkles,
    kicker: "Explore • Test • Discover",
  },
  general: {
    theme: "general",
    icon: Gamepad2,
    companion: Sparkles,
    kicker: "Practice • Play • Grow",
  },
};

function normalizeGrade(grade) {
  if (!grade) return "All Grades";
  const value = String(grade).trim();
  return /^grade\s/i.test(value) ? value : `Grade ${value}`;
}

function getGameTheme(item) {
  const searchValue = `${item.certificateTrack || ""} ${item.subject || ""} ${
    item.title || ""
  }`.toLowerCase();

  if (/filipino|tagalog/.test(searchValue)) return GAME_THEMES.filipino;
  if (/english|reading|literacy/.test(searchValue)) return GAME_THEMES.english;
  if (/math|number|addition|fraction|decimal/.test(searchValue)) return GAME_THEMES.math;
  if (/science|nature|living|experiment/.test(searchValue)) return GAME_THEMES.science;
  return GAME_THEMES.general;
}

export default function HomeGameCard({ item }) {
  const navigate = useNavigate();
  const { user, role, profile } = useAuth();
  const visual = getGameTheme(item);
  const MainIcon = visual.icon;
  const CompanionIcon = visual.companion;
  const destination = learningHref(item);
  const studentOnly = destination.startsWith("/student/");
  const incompatibleRole = Boolean(user && studentOnly && role !== "student");
  const wrongStudentGrade = Boolean(
    user
    && role === "student"
    && !item.builtIn
    && normalizeGrade(item.grade) !== "All Grades"
    && normalizeGrade(item.grade) !== normalizeGrade(profile?.gradeLevel),
  );
  const accessBlocked = incompatibleRole || wrongStudentGrade;
  const totalLevels = Number(item.totalLevels || 1);
  const itemCount = Number(item.itemsPerLevel || 0);
  const duration = Number(item.estimatedMinutes || 10);

  function openGame() {
    if (!user) {
      navigate("/login", {
        state: {
          from: destination,
          message: `Sign in with a student account to play ${item.title}.`,
        },
      });
      return;
    }

    if (accessBlocked) return;
    navigate(destination);
  }

  return (
    <article className={`home-game-card home-game-card--${visual.theme}`}>
      <div className="home-game-card__visual">
        <span className="home-game-card__orb home-game-card__orb--one" aria-hidden="true" />
        <span className="home-game-card__orb home-game-card__orb--two" aria-hidden="true" />

        <div className="home-game-card__art" aria-hidden="true">
          <span className="home-game-card__art-main">
            <MainIcon size={46} strokeWidth={1.8} />
          </span>
          <span className="home-game-card__art-companion">
            <CompanionIcon size={24} strokeWidth={2.1} />
          </span>
          <span className="home-game-card__art-play">
            <Play size={18} fill="currentColor" />
          </span>
        </div>

        <strong className="home-game-card__kicker">{visual.kicker}</strong>
      </div>

      <div className="home-game-card__body">
        <div className="home-game-card__visual-top">
          <span className="home-game-card__live-badge">
            <span aria-hidden="true" />
            Interactive game
          </span>
          <span className="home-game-card__grade">{normalizeGrade(item.grade)}</span>
        </div>

        <div className="home-game-card__title-row">
          <div>
            <span>{item.subject || "General Learning"}</span>
            <h3>{item.title}</h3>
          </div>
          {item.certificateTrack && (
            <span className="home-game-card__award" title="Certificate available">
              <Award size={19} aria-hidden="true" />
            </span>
          )}
        </div>

        <p>
          {item.description ||
            "Build grade-appropriate skills through a guided interactive challenge."}
        </p>

        <div className="home-game-card__facts" aria-label="Game information">
          <span>
            <Layers3 size={14} aria-hidden="true" />
            {totalLevels > 1 ? `${totalLevels} levels` : "Guided game"}
          </span>
          {itemCount > 0 && (
            <span>
              <Gamepad2 size={14} aria-hidden="true" />
              {itemCount} items/level
            </span>
          )}
          <span>
            <Clock3 size={14} aria-hidden="true" />
            About {duration} min
          </span>
        </div>

        <div className="home-game-card__footer">
          <span className="home-game-card__secure-note">
            <ShieldCheck size={15} aria-hidden="true" />
            Progress is saved after login
          </span>
          <button
            type="button"
            onClick={openGame}
            disabled={accessBlocked}
            aria-label={
              accessBlocked
                ? wrongStudentGrade
                  ? `${item.title} is assigned to ${normalizeGrade(item.grade)}`
                  : `${item.title} requires a student account`
                : `${user ? "Play" : "Login to play"} ${item.title}`
            }
          >
            {accessBlocked ? (
              <LockKeyhole size={16} aria-hidden="true" />
            ) : user ? (
              <Play size={16} fill="currentColor" aria-hidden="true" />
            ) : (
              <LockKeyhole size={16} aria-hidden="true" />
            )}
            <span>
              {accessBlocked
                ? wrongStudentGrade ? `${normalizeGrade(item.grade)} only` : "Student account required"
                : user
                  ? "Play now"
                  : "Login to play"}
            </span>
            {!accessBlocked && <ArrowRight size={16} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </article>
  );
}
