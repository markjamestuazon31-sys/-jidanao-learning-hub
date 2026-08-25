import {
  ArrowRight,
  Atom,
  BookOpenCheck,
  BrainCircuit,
  Calculator,
  Clock3,
  Gamepad2,
  Languages,
  Play,
  Sparkles,
  Star,
} from "lucide-react";
import { Link } from "react-router-dom";
import { difficultyForGrade, getGradeExperience, subjectTone } from "../../data/gradeExperience";
import { learningHref } from "../../utils/studentProgress";

function SubjectIcon({ subject, size = 28 }) {
  const tone = subjectTone(subject);
  if (tone === "math") return <Calculator size={size} />;
  if (tone === "science") return <Atom size={size} />;
  if (tone === "english" || tone === "reading") return <BookOpenCheck size={size} />;
  return <Languages size={size} />;
}

function progressForItem(item, progress) {
  if (item.type === "game") {
    const record = progress?.game?.[item.id] || {};
    const stars = Number(record.bestStars || record.stars || 0);
    if (Number(item.totalLevels) === 10) {
      const unlocked = Math.max(1, Math.min(10, Number(record.maxUnlockedLevel || 1)));
      const completedLevels = Object.values(record.levels || {}).filter((level) => level?.passed).length;
      return {
        percent: record.certificateEligible ? 100 : completedLevels * 10,
        label: record.certificateEligible
          ? "Level 10 certificate earned"
          : `Level ${unlocked} of 10 unlocked`,
        completed: Boolean(record.certificateEligible),
        score: Number(record.bestScore || record.score || 0),
      };
    }
    return {
      percent: record.lastPlayedAt ? (stars >= 3 ? 100 : Math.max(20, stars * 33)) : 0,
      label: record.lastPlayedAt
        ? `Best score ${Number(record.bestScore || record.score || 0)}`
        : "Not played yet",
      completed: stars >= 3,
      score: Number(record.bestScore || record.score || 0),
    };
  }
  const record = progress?.lesson?.[item.id] || {};
  return {
    percent: Number(record.percent || 0),
    label: record.completed
      ? "Completed"
      : record.startedAt
        ? `${Number(record.percent || 0)}% complete`
        : "Ready to begin",
    completed: Boolean(record.completed),
    score: Number(record.bestQuizScore || record.quizScore || 0),
  };
}

export default function StudentLearningCard({ item, progress, featured = false }) {
  const isGame = item.type === "game";
  const tone = subjectTone(item.subject);
  const activityProgress = progressForItem(item, progress);
  const difficulty = difficultyForGrade(item.grade, item.difficulty);
  const estimatedMinutes = Number(item.estimatedMinutes || (isGame ? 10 : 20));
  const lessonXp = getGradeExperience(item.grade).lessonXp;
  const href = learningHref(item);

  return (
    <article className={`student-learning-card student-learning-card--${tone} ${featured ? "is-featured" : ""}`}>
      <div className="student-learning-card__cover">
        <div className="student-learning-card__orb student-learning-card__orb--one" />
        <div className="student-learning-card__orb student-learning-card__orb--two" />
        <span className="student-learning-card__type">
          {isGame ? <Gamepad2 size={14} /> : <BookOpenCheck size={14} />}
          {isGame ? "Game" : "Lesson"}
        </span>
        <div className="student-learning-card__subject-icon">
          <SubjectIcon subject={item.subject} size={32} />
        </div>
        <span className="student-learning-card__grade">{item.grade}</span>
      </div>

      <div className="student-learning-card__body">
        <div className="student-learning-card__meta">
          <span>{item.subject || "General"}</span>
          <span><Clock3 size={13} /> {estimatedMinutes} min</span>
        </div>
        <h3>{item.title}</h3>
        <p>{item.description || "Teacher-approved learning activity."}</p>
        <div className="student-learning-card__skills">
          <span><BrainCircuit size={13} /> {difficulty}</span>
          {isGame ? (
            <span><Star size={13} /> {activityProgress.score} pts</span>
          ) : (
            <span><Sparkles size={13} /> +{lessonXp} XP</span>
          )}
        </div>
        <div className="student-learning-card__progress-row">
          <div className="student-learning-card__progress-track" aria-hidden="true">
            <span style={{ width: `${activityProgress.percent}%` }} />
          </div>
          <small>{activityProgress.label}</small>
        </div>
        <Link className="student-learning-card__action" to={href}>
          {activityProgress.completed ? (
            <>Review activity <ArrowRight size={16} /></>
          ) : activityProgress.percent > 0 ? (
            <>Continue <Play size={16} /></>
          ) : (
            <>{isGame ? "Play now" : "Start lesson"} <Play size={16} /></>
          )}
        </Link>
      </div>
    </article>
  );
}
