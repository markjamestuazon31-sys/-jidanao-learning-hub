import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  BookOpenCheck,
  Gamepad2,
  GraduationCap,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getAdminOverview } from "../services/dataService";

const EMPTY_OVERVIEW = {
  users: [],
  students: [],
  teachers: [],
  content: [],
  gradeEngagement: [],
  topGames: [],
  recentActivity: [],
  totals: {
    administrators: 0,
    teachers: 0,
    students: 0,
    activeAccounts: 0,
    lessons: 0,
    games: 0,
    publishedContent: 0,
    gamePlays: 0,
    lessonCompletions: 0,
  },
};

function formatRelativeTime(timestamp) {
  if (!timestamp) return "—";
  const diffMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const hours = Math.floor(diffMinutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [overview, setOverview] = useState(EMPTY_OVERVIEW);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setOverview(await getAdminOverview());
    } catch (loadError) {
      console.error("Unable to load administrator overview:", loadError);
      setError(
        loadError.message ||
          "Unable to load school analytics. Confirm your Realtime Database rules are deployed.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const mostActiveGrade = useMemo(() => {
    return [...overview.gradeEngagement].sort((a, b) => b.gamePlays - a.gamePlays)[0] || null;
  }, [overview.gradeEngagement]);

  const maxPlays = Math.max(1, ...overview.gradeEngagement.map((item) => item.gamePlays));
  const contentMap = useMemo(
    () => Object.fromEntries(overview.content.map((item) => [`${item.type}:${item.id}`, item.title])),
    [overview.content],
  );
  const totalAccounts = overview.users.length;
  const accountHealthPercent = totalAccounts
    ? Math.round((overview.totals.activeAccounts / totalAccounts) * 100)
    : 0;
  const showMetric = (value) => loading ? "—" : value;

  return (
    <div className={`admin-page admin-dashboard-page ${loading ? "is-loading" : ""}`} aria-busy={loading}>
      <header className="admin-hero-header admin-dashboard-hero">
        <div className="admin-dashboard-hero-copy">
          <span className="admin-kicker">ADMINISTRATOR CONTROL CENTER</span>
          <h1>Good day, {profile?.name || "Administrator"}</h1>
          <p>
            Monitor school learning activity, manage accounts, review content,
            and keep Jidanao LearnSpace running smoothly.
          </p>
        </div>
        <div className="admin-header-actions admin-dashboard-hero-actions">
          <button type="button" className="admin-button secondary" onClick={loadOverview} disabled={loading}>
            <RefreshCw size={17} className={loading ? "spin" : ""} /> Refresh
          </button>
          <Link className="admin-button primary" to="/admin/teachers">
            <UserPlus size={17} /> Add teacher
          </Link>
        </div>
        <span className="admin-dashboard-hero-seal" aria-hidden="true">
          <img src="/school-logo.jpg" alt="" />
        </span>
      </header>

      {error && <div className="alert error admin-alert">{error}</div>}

      <section className="admin-metric-grid admin-dashboard-metrics" aria-label="School overview metrics">
        <article className="admin-metric-card tone-blue">
          <span className="admin-metric-icon"><Users /></span>
          <div><small>Students</small><strong>{showMetric(overview.totals.students)}</strong><span>Grades 3–6 school roster</span></div>
        </article>
        <article className="admin-metric-card tone-cobalt">
          <span className="admin-metric-icon"><GraduationCap /></span>
          <div><small>Teachers</small><strong>{showMetric(overview.totals.teachers)}</strong><span>Active faculty profiles</span></div>
        </article>
        <article className="admin-metric-card tone-green">
          <span className="admin-metric-icon"><BookOpenCheck /></span>
          <div><small>Published content</small><strong>{showMetric(overview.totals.publishedContent)}</strong><span>{overview.totals.lessons} lessons • {overview.totals.games} games</span></div>
        </article>
        <article className="admin-metric-card tone-orange">
          <span className="admin-metric-icon"><Gamepad2 /></span>
          <div><small>Recorded game plays</small><strong>{showMetric(overview.totals.gamePlays)}</strong><span>Student game sessions</span></div>
        </article>
      </section>

      <div className="admin-dashboard-grid admin-dashboard-layout">
        <section className="admin-panel admin-panel-wide admin-engagement-panel">
          <div className="admin-panel-heading">
            <div>
              <span className="admin-section-icon"><TrendingUp size={19} /></span>
              <div><h2>Game engagement by grade</h2><p>See which grade level is playing learning games the most.</p></div>
            </div>
            <Link to="/admin/analytics">Full analytics <ArrowRight size={15} /></Link>
          </div>

          {overview.gradeEngagement.length === 0 ? (
            <div className="admin-empty-state">No student engagement data has been recorded yet.</div>
          ) : (
            <div className="admin-grade-chart">
              {overview.gradeEngagement.map((item) => (
                <div className="admin-grade-row" key={item.grade}>
                  <div className="admin-grade-label">
                    <strong>{item.grade}</strong>
                    <span>{item.students} learner{item.students === 1 ? "" : "s"}</span>
                  </div>
                  <div className="admin-grade-track" aria-label={`${item.grade}: ${item.gamePlays} game plays`}>
                    <div className="admin-grade-fill" style={{ width: `${(item.gamePlays / maxPlays) * 100}%` }} />
                  </div>
                  <strong className="admin-grade-value">{item.gamePlays}</strong>
                </div>
              ))}
            </div>
          )}

          <div className="admin-insight-strip">
            <span className="admin-insight-icon"><Activity size={20} /></span>
            <div>
              <small>MOST ACTIVE GRADE</small>
              <strong>{mostActiveGrade?.gamePlays ? mostActiveGrade.grade : "Waiting for activity"}</strong>
              <span>
                {mostActiveGrade?.gamePlays
                  ? `${mostActiveGrade.gamePlays} recorded game plays`
                  : "Play data will appear after students open learning games."}
              </span>
            </div>
          </div>
        </section>

        <section className="admin-panel admin-top-games-panel">
          <div className="admin-panel-heading compact">
            <div><span className="admin-section-icon"><Gamepad2 size={19} /></span><div><h2>Top learning games</h2><p>By recorded play sessions</p></div></div>
          </div>
          <div className="admin-ranked-list">
            {overview.topGames.length ? overview.topGames.map((game, index) => (
              <div className="admin-ranked-item" key={game.id}>
                <span className={`admin-rank rank-${index + 1}`}>{index + 1}</span>
                <div><strong>{game.title}</strong><small>{game.grade || "Grade not set"}</small></div>
                <b>{game.plays}</b>
              </div>
            )) : <div className="admin-empty-state compact">No game sessions yet.</div>}
          </div>
        </section>

        <section className="admin-panel admin-account-health-panel">
          <div className="admin-panel-heading compact">
            <div><span className="admin-section-icon"><ShieldCheck size={19} /></span><div><h2>Account health</h2><p>Realtime Database profile status</p></div></div>
          </div>
          <div className="admin-health-summary">
            <div className="admin-health-ring" style={{ "--admin-health-percent": accountHealthPercent }}>
              <div>
                <ShieldCheck size={27} />
                <strong>{loading ? "—" : `${accountHealthPercent}%`}</strong>
                <span>Active profiles</span>
              </div>
            </div>
            <div className="admin-health-list">
              <div><span><i className="health-dot active" />Active accounts</span><strong>{showMetric(overview.totals.activeAccounts)}</strong></div>
              <div><span><i className="health-dot admin" />Administrators</span><strong>{showMetric(overview.totals.administrators)}</strong></div>
              <div><span><i className="health-dot teacher" />Teachers</span><strong>{showMetric(overview.totals.teachers)}</strong></div>
              <div><span><i className="health-dot student" />Students</span><strong>{showMetric(overview.totals.students)}</strong></div>
            </div>
          </div>
        </section>

        <section className="admin-panel admin-panel-wide admin-recent-activity-panel">
          <div className="admin-panel-heading">
            <div><span className="admin-section-icon"><Activity size={19} /></span><div><h2>Recent learning activity</h2><p>Latest lesson completions and game sessions.</p></div></div>
          </div>
          <div className="admin-activity-list">
            {overview.recentActivity.length ? overview.recentActivity.slice(0, 8).map((item, index) => (
              <div className="admin-activity-item" key={`${item.uid}-${item.contentId}-${item.timestamp}-${index}`}>
                <span className={`admin-activity-dot ${item.type}`} aria-hidden="true" />
                <div>
                  <strong>{item.studentName}</strong>
                  <span>{item.type === "game" ? "Played" : "Completed"} {contentMap[`${item.type}:${item.contentId}`] || (item.type === "game" ? "a learning game" : "a lesson")}</span>
                </div>
                <small>{item.grade} • {formatRelativeTime(item.timestamp)}</small>
              </div>
            )) : <div className="admin-empty-state">No recent learning activity yet.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
