import {
  Activity,
  Award,
  BookOpenCheck,
  Flame,
  FileQuestion,
  Gamepad2,
  LoaderCircle,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import StudentBadge from "../components/student/StudentBadge";
import VoiceSettings from "../components/student/VoiceSettings";
import { useAuth } from "../context/AuthContext";
import { deriveBadges, getGradeExperience, subjectTone } from "../data/gradeExperience";
import {
  normalizeProgress,
  subscribePublishedCatalogForGrade,
  subscribeUserProgress,
} from "../services/dataService";
import { activityHref, buildSubjectProgress, formatRelativeTime, getRecentActivities } from "../utils/studentProgress";

export default function StudentProgress() {
  const { user, profile } = useAuth();
  const [progress, setProgress] = useState(() => normalizeProgress({}));
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const experience = getGradeExperience(profile?.gradeLevel);

  useEffect(() => {
    if (!user?.uid) return undefined;
    setLoading(true);
    return subscribeUserProgress(
      user.uid,
      (value) => {
        setProgress(value);
        setLoading(false);
      },
      (loadError) => {
        setError(loadError.message || "Unable to load learning progress.");
        setLoading(false);
      },
    );
  }, [user?.uid]);

  useEffect(() => {
    if (!profile?.gradeLevel) return undefined;
    return subscribePublishedCatalogForGrade(profile.gradeLevel, setCatalog, () => {}, profile.section);
  }, [profile?.gradeLevel, profile?.section]);

  const summary = progress.summary;
  const badges = useMemo(() => deriveBadges(summary), [summary]);
  const subjectProgress = useMemo(() => buildSubjectProgress(catalog, progress), [catalog, progress]);
  const activities = useMemo(() => getRecentActivities(progress), [progress]);
  const nextLevels = [summary.level, summary.level + 1, summary.level + 2, summary.level + 3];

  return (
    <div className={`student-portal student-progress-page student-theme--${experience.theme}`}>
      <header className="student-page-hero">
        <div className="student-page-hero__icon"><TrendingUp size={30} /></div>
        <div>
          <span>{profile?.gradeLevel} PROGRESS CENTER</span>
          <h1>Your learning journey</h1>
          <p>See your XP, levels, streaks, subject mastery, scores, and recent activity.</p>
        </div>
        <div className="student-page-hero__tools"><VoiceSettings compact /><strong>Level {summary.level}</strong><small>{summary.totalXp} XP earned</small></div>
      </header>

      {loading ? (
        <div className="student-state-card"><LoaderCircle className="spin" size={30} /><div><strong>Calculating your progress…</strong><p>Reading your saved Realtime Database activity.</p></div></div>
      ) : error ? (
        <div className="student-state-card student-state-card--error"><Activity size={30} /><div><strong>Progress could not be loaded.</strong><p>{error}</p></div></div>
      ) : (
        <>
          <section className="student-progress-overview">
            <article className="student-progress-level-card">
              <div className="student-progress-level-card__medal"><Trophy size={38} /></div>
              <div><span>CURRENT LEVEL</span><h2>Level {summary.level}</h2><p>{experience.title}</p></div>
              <div className="student-progress-level-card__bar"><span style={{ width: `${summary.levelPercent}%` }} /></div>
              <small>{summary.currentLevelXp} of {summary.requiredXp} XP to Level {summary.level + 1}</small>
            </article>
            <article><BookOpenCheck /><strong>{summary.lessonsCompleted}</strong><span>Lessons completed</span></article>
            <article><Gamepad2 /><strong>{summary.gameSessions}</strong><span>Game sessions</span></article>
            <article><Target /><strong>{summary.accuracyPercent}%</strong><span>Answer accuracy</span></article>
            <article><Flame /><strong>{summary.currentStreak}</strong><span>Day streak</span></article>
          </section>

          <section className="student-progress-layout">
            <article className="student-dashboard-panel">
              <div className="student-panel-heading"><span className="student-panel-icon student-panel-icon--green"><Target size={21} /></span><div><small>SUBJECT MASTERY</small><h2>Progress by subject</h2></div></div>
              {subjectProgress.length ? (
                <div className="student-subject-progress-list">
                  {subjectProgress.map((row) => (
                    <div className={`student-subject-progress student-subject-progress--${subjectTone(row.subject)}`} key={row.subject}>
                      <div><strong>{row.subject}</strong><span>{row.completed}/{row.total} completed</span></div>
                      <div className="student-subject-progress__track"><span style={{ width: `${row.percent}%` }} /></div>
                      <b>{row.percent}%</b>
                    </div>
                  ))}
                </div>
              ) : <p className="student-panel-empty">Published grade content will appear after the administrator syncs the student catalog.</p>}
            </article>

            <article className="student-dashboard-panel">
              <div className="student-panel-heading"><span className="student-panel-icon student-panel-icon--violet"><Award size={21} /></span><div><small>ACHIEVEMENTS</small><h2>Badge collection</h2></div></div>
              <div className="student-badge-grid">
                {badges.map((badge) => <StudentBadge key={badge.id} badge={badge} compact />)}
              </div>
              <Link className="student-panel-link" to="/student/achievements">Open achievement center</Link>
            </article>
          </section>

          <section className="student-dashboard-panel student-level-roadmap">
            <div className="student-panel-heading"><span className="student-panel-icon student-panel-icon--orange"><Trophy size={21} /></span><div><small>LEVEL ROADMAP</small><h2>Keep earning XP</h2></div></div>
            <div className="student-level-roadmap__steps">
              {nextLevels.map((level, index) => (
                <div className={index === 0 ? "is-current" : ""} key={level}>
                  <span>{level}</span><strong>{index === 0 ? "You are here" : `Level ${level}`}</strong><small>{index === 0 ? `${summary.totalXp} XP` : "Complete activities to unlock"}</small>
                </div>
              ))}
            </div>
          </section>

          <section className="student-dashboard-panel">
            <div className="student-panel-heading"><span className="student-panel-icon student-panel-icon--blue"><Activity size={21} /></span><div><small>ACTIVITY TIMELINE</small><h2>Recent learning</h2></div></div>
            {activities.length ? (
              <div className="student-progress-timeline">
                {activities.slice(0, 20).map((activity) => (
                  <Link key={activity.eventId || `${activity.type}-${activity.id}-${activity.timestamp}`} to={activityHref(activity)}>
                    <span className={`is-${activity.type}`}>{activity.type === "game" ? <Gamepad2 size={18} /> : activity.type === "quiz" ? <FileQuestion size={18} /> : <BookOpenCheck size={18} />}</span>
                    <div><strong>{activity.title}</strong><p>{activity.subject} • {activity.status}</p></div>
                    <time>{formatRelativeTime(activity.timestamp)}</time>
                  </Link>
                ))}
              </div>
            ) : <p className="student-panel-empty">Complete your first lesson, quiz, or game to begin your timeline.</p>}
          </section>
        </>
      )}
    </div>
  );
}
