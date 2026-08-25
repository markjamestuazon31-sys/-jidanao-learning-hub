import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  BookOpenCheck,
  Gamepad2,
  RefreshCw,
  Trophy,
  Users,
} from "lucide-react";
import { getAdminOverview } from "../services/dataService";

export default function Analytics() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setOverview(await getAdminOverview());
    } catch (loadError) {
      setError(loadError.message || "Unable to load engagement analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const mostActiveGrade = useMemo(() => {
    if (!overview) return null;
    return [...overview.gradeEngagement].sort((a, b) => b.gamePlays - a.gamePlays)[0] || null;
  }, [overview]);

  if (!overview && loading) return <div className="page-state">Loading analytics…</div>;

  const rows = overview?.gradeEngagement || [];
  const maxGamePlays = Math.max(1, ...rows.map((row) => row.gamePlays));
  const maxCompletions = Math.max(1, ...rows.map((row) => row.lessonCompletions));

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <span className="admin-kicker">SCHOOL ANALYTICS</span>
          <h1>Learning engagement</h1>
          <p>Compare game activity, lesson completion, and learner distribution by grade.</p>
        </div>
        <button type="button" className="admin-button secondary" onClick={load} disabled={loading}>
          <RefreshCw size={17} className={loading ? "spin" : ""} /> Refresh
        </button>
      </header>

      {error && <div className="alert error admin-alert">{error}</div>}

      <section className="admin-metric-grid">
        <article className="admin-metric-card tone-blue"><span className="admin-metric-icon"><Users /></span><div><small>Total learners</small><strong>{overview?.totals.students || 0}</strong><span>Registered students</span></div></article>
        <article className="admin-metric-card tone-orange"><span className="admin-metric-icon"><Gamepad2 /></span><div><small>Game plays</small><strong>{overview?.totals.gamePlays || 0}</strong><span>Recorded game sessions</span></div></article>
        <article className="admin-metric-card tone-green"><span className="admin-metric-icon"><BookOpenCheck /></span><div><small>Lesson completions</small><strong>{overview?.totals.lessonCompletions || 0}</strong><span>Marked complete</span></div></article>
        <article className="admin-metric-card tone-purple"><span className="admin-metric-icon"><Trophy /></span><div><small>Most active grade</small><strong className="admin-metric-text-value">{mostActiveGrade?.gamePlays ? mostActiveGrade.grade : "—"}</strong><span>{mostActiveGrade?.gamePlays || 0} game plays</span></div></article>
      </section>

      <div className="admin-two-column">
        <section className="admin-panel">
          <div className="admin-panel-heading compact"><div><span className="admin-section-icon"><Gamepad2 size={19} /></span><div><h2>Game plays by grade</h2><p>Higher bars indicate more game sessions.</p></div></div></div>
          <div className="admin-analytics-bars">
            {rows.map((row) => (
              <div className="admin-analytics-row" key={row.grade}>
                <div><strong>{row.grade}</strong><span>{row.students} students</span></div>
                <div className="admin-analytics-track"><span style={{ width: `${(row.gamePlays / maxGamePlays) * 100}%` }} /></div>
                <b>{row.gamePlays}</b>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-heading compact"><div><span className="admin-section-icon"><BookOpenCheck size={19} /></span><div><h2>Lesson completions by grade</h2><p>Completed learning modules recorded in progress.</p></div></div></div>
          <div className="admin-analytics-bars completion">
            {rows.map((row) => (
              <div className="admin-analytics-row" key={row.grade}>
                <div><strong>{row.grade}</strong><span>{row.students} students</span></div>
                <div className="admin-analytics-track"><span style={{ width: `${(row.lessonCompletions / maxCompletions) * 100}%` }} /></div>
                <b>{row.lessonCompletions}</b>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="admin-panel admin-analytics-table-panel">
        <div className="admin-panel-heading"><div><span className="admin-section-icon"><BarChart3 size={19} /></span><div><h2>Grade engagement summary</h2><p>Operational view for school administrators.</p></div></div></div>
        <div className="admin-responsive-table">
          <table>
            <thead><tr><th>Grade</th><th>Students</th><th>Game plays</th><th>Unique games touched</th><th>Lesson completions</th></tr></thead>
            <tbody>
              {rows.map((row) => <tr key={row.grade}><td><strong>{row.grade}</strong></td><td>{row.students}</td><td>{row.gamePlays}</td><td>{row.gamesTouched}</td><td>{row.lessonCompletions}</td></tr>)}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-insight-banner">
        <Activity size={22} />
        <div><strong>How play monitoring works</strong><span>Each time a signed-in student opens a learning game, the LMS increments a Realtime Database play counter for that student and game. Admin analytics then aggregates those counters by the student&apos;s grade level.</span></div>
      </section>
    </div>
  );
}
