import {
  BookOpenCheck,
  Brain,
  Camera,
  Compass,
  Flame,
  Footprints,
  Gamepad2,
  Medal,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from "lucide-react";

const ICONS = {
  footprints: Footprints,
  books: BookOpenCheck,
  gamepad: Gamepad2,
  trophy: Trophy,
  brain: Brain,
  flame: Flame,
  camera: Camera,
  target: Target,
  sparkles: Sparkles,
  compass: Compass,
  medal: Medal,
  zap: Zap,
};

export default function StudentBadge({ badge, compact = false }) {
  const Icon = ICONS[badge.icon] || Sparkles;
  return (
    <article
      className={`student-badge ${badge.unlocked ? "is-unlocked" : "is-locked"} ${compact ? "is-compact" : ""}`}
      title={badge.description}
    >
      <span className="student-badge__icon"><Icon size={compact ? 20 : 26} /></span>
      <div>
        <strong>{badge.title}</strong>
        {!compact && <p>{badge.description}</p>}
        <small>{badge.unlocked ? "Unlocked" : "Keep learning"}</small>
      </div>
    </article>
  );
}
