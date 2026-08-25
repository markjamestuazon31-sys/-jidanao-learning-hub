import {
  Atom,
  BookOpenCheck,
  Calculator,
  Clock3,
  Gamepad2,
  Languages,
  Play,
  Shapes,
} from "lucide-react";
import { Link } from "react-router-dom";
import { subjectTone } from "../../data/gradeExperience";
import { learningHref } from "../../utils/studentProgress";

function TileIcon({ subject, isGame }) {
  if (isGame) return <Gamepad2 size={28} />;
  const tone = subjectTone(subject);
  if (tone === "math") return <Calculator size={28} />;
  if (tone === "science") return <Atom size={28} />;
  if (tone === "english" || tone === "reading") return <BookOpenCheck size={28} />;
  if (tone === "filipino") return <Languages size={28} />;
  return <Shapes size={28} />;
}

function itemProgress(item, progress) {
  if (item.type === "game") {
    const record = progress?.game?.[item.id] || {};
    return {
      percent: record.lastPlayedAt ? Math.min(100, Math.max(12, Number(record.bestStars || record.stars || 0) * 33)) : 0,
      label: record.lastPlayedAt ? `${Number(record.bestScore || record.score || 0)} pts` : "Play & earn XP",
    };
  }

  const record = progress?.lesson?.[item.id] || {};
  return {
    percent: Number(record.percent || 0),
    label: record.completed ? "Completed" : record.startedAt ? `${Number(record.percent || 0)}% complete` : `${Number(item.estimatedMinutes || 15)} min`,
  };
}

export default function DashboardLearningTile({ item, progress, game = false }) {
  const isGame = game || item.type === "game";
  const tone = subjectTone(item.subject);
  const activity = itemProgress(item, progress);
  const href = learningHref(item);

  return (
    <Link className={`dashboard-learning-tile is-${tone} ${isGame ? "is-game" : ""}`} to={href}>
      <div className="dashboard-learning-tile__art">
        <span className="dashboard-learning-tile__shape one" />
        <span className="dashboard-learning-tile__shape two" />
        <span className="dashboard-learning-tile__icon"><TileIcon subject={item.subject} isGame={isGame} /></span>
        {isGame && <span className="dashboard-learning-tile__play"><Play size={15} fill="currentColor" /></span>}
      </div>
      <div className="dashboard-learning-tile__copy">
        <strong>{item.title}</strong>
        <small>
          {isGame ? activity.label : <><Clock3 size={11} /> {activity.label}</>}
        </small>
        {!isGame && (
          <span className="dashboard-learning-tile__track" aria-hidden="true">
            <i style={{ width: `${activity.percent}%` }} />
          </span>
        )}
      </div>
    </Link>
  );
}
