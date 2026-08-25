import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BellRing,
  BookOpenCheck,
  CalendarCheck2,
  CalendarX2,
  CheckCircle2,
  DatabaseBackup,
  Download,
  FileQuestion,
  Gamepad2,
  GraduationCap,
  History,
  LoaderCircle,
  Megaphone,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  UserRoundCog,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  deleteAnnouncement,
  exportAdminWordReport,
  getAdminOperations,
  publishAnnouncement,
} from "../services/adminOperationsService";

const EMPTY_FORM = {
  title: "",
  message: "",
  audience: "all",
  grade: "",
  section: "",
  priority: "normal",
  expiresAt: "",
};

const ACTION_FILTERS = [
  { id: "all", label: "All" },
  { id: "attendance", label: "Attendance" },
  { id: "content", label: "Content drafts" },
];

function formatDate(value) {
  return value
    ? new Date(value).toLocaleString("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";
}

function isAttendanceTask(task) {
  return task.kind === "attendance";
}

function isContentTask(task) {
  return task.kind === "content" || task.kind === "quiz";
}

function TaskIcon({ task }) {
  if (task.kind === "attendance") return <CalendarX2 />;
  if (task.kind === "quiz") return <FileQuestion />;
  if (task.kind === "teacher") return <UserRoundCog />;
  if (task.kind === "student") return <GraduationCap />;
  if (String(task.detail || "").toLowerCase().startsWith("game")) return <Gamepad2 />;
  return <BookOpenCheck />;
}

function taskType(task) {
  if (task.kind === "attendance") return "Attendance";
  if (task.kind === "quiz") return "Quiz";
  if (task.kind === "teacher") return "Teacher account";
  if (task.kind === "student") return "Student placement";
  if (String(task.detail || "").toLowerCase().startsWith("game")) return "Game";
  return "Lesson";
}

function ActionTaskCard({ task, index }) {
  const attendance = isAttendanceTask(task);
  const content = isContentTask(task);
  const actionLabel = content ? "Review" : "Resolve";

  return (
    <article
      className={`admin-action-card admin-action-card--${attendance ? "attendance" : content ? "content" : "record"}`}
      key={`${task.kind}-${index}`}
    >
      <span className="admin-action-card-icon" aria-hidden="true">
        <TaskIcon task={task} />
      </span>
      <div className="admin-action-card-copy">
        <div className="admin-action-card-meta">
          <span className="admin-task-type">{taskType(task)}</span>
          {attendance ? <span className="admin-task-today">Today</span> : null}
          {content ? <span className="admin-task-draft">Draft</span> : null}
          {!attendance && !content && task.severity === "high" ? (
            <span className="admin-task-attention">Needs attention</span>
          ) : null}
        </div>
        <strong>{task.title}</strong>
        <p>{task.detail}</p>
      </div>
      <Link to={task.route}>{actionLabel}</Link>
    </article>
  );
}

function TaskGroup({ icon, title, description, tone, tasks }) {
  if (!tasks.length) return null;

  return (
    <section className={`admin-task-group admin-task-group--${tone}`}>
      <header className="admin-task-group-heading">
        <span aria-hidden="true">{icon}</span>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <strong>{tasks.length}</strong>
      </header>
      <div className="admin-action-list">
        {tasks.map((task, index) => (
          <ActionTaskCard task={task} index={index} key={`${task.kind}-${task.title}-${index}`} />
        ))}
      </div>
    </section>
  );
}

function OperationsMetrics({ data, loading, todayAttendance }) {
  const metrics = [
    { className: "attention", icon: <AlertTriangle />, value: data?.tasks.length || 0, label: "Items needing attention" },
    { className: "attendance", icon: <CalendarCheck2 />, value: `${todayAttendance.length}/${data?.publishedClasses.length || 0}`, label: "Classes with attendance today" },
    { className: "announcements", icon: <BellRing />, value: data?.announcements.length || 0, label: "Announcements" },
    { className: "audit", icon: <History />, value: data?.audit.length || 0, label: "Recorded admin actions" },
  ];

  return (
    <section className="admin-operations-metrics" aria-label="School operations summary">
      {metrics.map((metric) => (
        <article className={`admin-operation-metric admin-operation-metric--${metric.className}`} key={metric.className}>
          <span className="admin-operation-metric-icon">{metric.icon}</span>
          <div><strong>{loading ? "—" : metric.value}</strong><span>{metric.label}</span></div>
        </article>
      ))}
    </section>
  );
}

function AttendancePanel({ classes, todayAttendance }) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-heading">
        <div>
          <span className="admin-section-icon"><CalendarCheck2 /></span>
          <div><h2>Today&apos;s attendance status</h2><p>Monitor submissions across every published Grade and Section.</p></div>
        </div>
      </div>
      <div className="admin-attendance-overview">
        {classes.map((classItem) => {
          const record = todayAttendance.find((item) => item.classKey === classItem.classKey);
          return (
            <article className={record ? "is-complete" : "is-missing"} key={classItem.classKey}>
              <div>
                <strong>{classItem.grade} · {classItem.section}</strong>
                <span>{record ? `${record.count} learner records submitted` : "Not submitted today"}</span>
              </div>
              {record ? <CheckCircle2 /> : <AlertTriangle />}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default function AdminOperations() {
  const { user, profile } = useAuth();
  const administrator = { uid: user?.uid, name: profile?.name, email: profile?.email || user?.email };
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("actions");
  const [taskFilter, setTaskFilter] = useState("all");
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await getAdminOperations());
    } catch (loadError) {
      setError(loadError.message || "Unable to load school operations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const todayAttendance = useMemo(
    () => data?.attendanceDays.filter((item) => item.date === new Date().toISOString().slice(0, 10)) || [],
    [data],
  );

  const taskGroups = useMemo(() => {
    const tasks = data?.tasks || [];
    return {
      attendance: tasks.filter(isAttendanceTask),
      content: tasks.filter(isContentTask),
      records: tasks.filter((task) => !isAttendanceTask(task) && !isContentTask(task)),
    };
  }, [data]);

  const filterCounts = {
    all: data?.tasks.length || 0,
    attendance: taskGroups.attendance.length,
    content: taskGroups.content.length,
  };

  async function submitAnnouncement(event) {
    event.preventDefault();
    setBusy(true); setMessage(""); setError("");
    try {
      await publishAnnouncement(administrator, form);
      setForm(EMPTY_FORM);
      setMessage("Announcement published successfully.");
      await load();
    } catch (saveError) {
      setError(saveError.message || "Unable to publish the announcement.");
    } finally {
      setBusy(false);
    }
  }

  async function removeAnnouncement(item) {
    if (!window.confirm(`Delete “${item.title}”? Students and teachers will no longer see it.`)) return;
    setBusy(true); setMessage(""); setError("");
    try {
      await deleteAnnouncement(administrator, item);
      setMessage("Announcement deleted.");
      await load();
    } catch (deleteError) {
      setError(deleteError.message || "Unable to delete the announcement.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-page admin-operations-page">
      <header className="admin-hero-header admin-operations-hero">
        <div className="admin-operations-hero-copy">
          <span className="admin-kicker">SCHOOL OPERATIONS</span>
          <h1>Administrator Action Center</h1>
          <p>See what needs attention, monitor daily records, communicate with users, and protect school data from one workspace.</p>
        </div>
        <img className="admin-operations-hero-seal" src="/school-logo.jpg" alt="" aria-hidden="true" />
        <div className="admin-header-actions">
          <button className="admin-button secondary" onClick={() => void load()} disabled={loading} type="button"><RefreshCw className={loading ? "spin" : ""} size={18} />Refresh</button>
          <button className="admin-button primary" onClick={() => exportAdminWordReport(data)} disabled={!data} type="button"><Download size={18} />Export Word report</button>
        </div>
      </header>

      {error ? <div className="alert error admin-alert">{error}</div> : null}
      {message ? <div className="alert success admin-alert">{message}</div> : null}
      <OperationsMetrics data={data} loading={loading} todayAttendance={todayAttendance} />

      <nav className="admin-operations-tabs" aria-label="Administrator operations">
        <button className={tab === "actions" ? "is-active" : ""} onClick={() => setTab("actions")} type="button"><AlertTriangle /><span>Action Center</span><strong>{data?.tasks.length || 0}</strong></button>
        <button className={tab === "attendance" ? "is-active" : ""} onClick={() => setTab("attendance")} type="button"><CalendarCheck2 /><span>Attendance Overview</span></button>
        <button className={tab === "announcements" ? "is-active" : ""} onClick={() => setTab("announcements")} type="button"><Megaphone /><span>Announcements</span></button>
        <button className={tab === "audit" ? "is-active" : ""} onClick={() => setTab("audit")} type="button"><History /><span>Audit &amp; Backup</span></button>
      </nav>

      {loading ? <div className="admin-panel admin-operations-loading"><LoaderCircle className="spin" />Preparing school operations…</div> : null}

      {!loading && tab === "actions" ? (
        <section className="admin-panel admin-action-center-panel">
          <div className="admin-panel-heading admin-action-center-heading">
            <div><span className="admin-section-icon"><ShieldCheck /></span><div><h2>Tasks requiring attention</h2><p>Open the correct admin page and resolve each school record.</p></div></div>
          </div>
          {data.tasks.length ? (
            <>
              <div className="admin-task-filter-row" aria-label="Filter Action Center tasks">
                <span>Show:</span>
                {ACTION_FILTERS.map((filter) => (
                  <button className={taskFilter === filter.id ? "is-active" : ""} key={filter.id} onClick={() => setTaskFilter(filter.id)} type="button">{filter.label}<strong>{filterCounts[filter.id]}</strong></button>
                ))}
              </div>
              {taskFilter === "all" || taskFilter === "attendance" ? <TaskGroup icon={<CalendarX2 />} title="Attendance missing today" description="Published classes that still need today’s attendance register." tone="attendance" tasks={taskGroups.attendance} /> : null}
              {taskFilter === "all" || taskFilter === "content" ? <TaskGroup icon={<BookOpenCheck />} title="Content waiting for review" description="Draft lessons, games, and quizzes that have not reached students." tone="content" tasks={taskGroups.content} /> : null}
              {taskFilter === "all" ? <TaskGroup icon={<UserRoundCog />} title="Other school records" description="Accounts and class placements that need administrator action." tone="records" tasks={taskGroups.records} /> : null}
              {(taskFilter === "attendance" && !taskGroups.attendance.length) || (taskFilter === "content" && !taskGroups.content.length) ? <div className="admin-empty-state admin-filter-empty-state"><CheckCircle2 />No tasks are waiting in this category.</div> : null}
            </>
          ) : (
            <div className="admin-empty-state admin-action-center-empty"><CheckCircle2 /><div><strong>Everything is up to date.</strong><span>No urgent administrator tasks were detected.</span></div></div>
          )}
        </section>
      ) : null}

      {!loading && tab === "attendance" ? <AttendancePanel classes={data.publishedClasses} todayAttendance={todayAttendance} /> : null}

      {!loading && tab === "announcements" ? (
        <div className="admin-operations-columns">
          <section className="admin-panel">
            <div className="admin-panel-heading compact"><div><span className="admin-section-icon"><Megaphone /></span><div><h2>Publish announcement</h2><p>Send a notice to the intended school audience.</p></div></div></div>
            <form className="admin-form" onSubmit={submitAnnouncement}>
              <label>Title<input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} maxLength={120} required /></label>
              <label>Message<textarea rows={6} value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} maxLength={2000} required /></label>
              <div className="admin-announcement-grid">
                <label>Audience<select value={form.audience} onChange={(event) => setForm((current) => ({ ...current, audience: event.target.value }))}><option value="all">All users</option><option value="teachers">Teachers only</option><option value="students">Students only</option><option value="class">Specific class</option></select></label>
                <label>Priority<select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}><option value="normal">Normal</option><option value="important">Important</option><option value="urgent">Urgent</option></select></label>
              </div>
              {form.audience === "class" ? <div className="admin-announcement-grid"><label>Grade<input value={form.grade} onChange={(event) => setForm((current) => ({ ...current, grade: event.target.value }))} placeholder="Grade 3" required /></label><label>Section<input value={form.section} onChange={(event) => setForm((current) => ({ ...current, section: event.target.value }))} placeholder="Section Rizal" required /></label></div> : null}
              <label>Expiry date (optional)<input type="date" value={form.expiresAt} onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))} /></label>
              <button className="admin-button primary" disabled={busy}><Send />{busy ? "Publishing…" : "Publish announcement"}</button>
            </form>
          </section>
          <section className="admin-panel">
            <div className="admin-panel-heading compact"><div><span className="admin-section-icon"><BellRing /></span><div><h2>Published announcements</h2><p>{data.announcements.length} announcement records</p></div></div></div>
            <div className="admin-announcement-list">
              {data.announcements.map((item) => <article key={item.id}><div><span className={`priority-${item.priority}`}>{item.priority}</span><strong>{item.title}</strong><p>{item.message}</p><small>{item.audience} · {formatDate(item.createdAt)}</small></div><button onClick={() => void removeAnnouncement(item)} disabled={busy} aria-label={`Delete ${item.title}`} type="button"><Trash2 /></button></article>)}
              {!data.announcements.length ? <div className="admin-empty-state">No announcements have been published.</div> : null}
            </div>
          </section>
        </div>
      ) : null}

      {!loading && tab === "audit" ? (
        <div className="admin-operations-columns">
          <section className="admin-panel admin-backup-card"><DatabaseBackup /><div><h2>School operations Word report</h2><p>Download a readable Microsoft Word report containing the operational summary, attendance, users, learning content, announcements, and audit history.</p><button className="admin-button primary" onClick={() => exportAdminWordReport(data)} type="button"><Download />Download Word report</button><small>The report is ready to read or print and excludes passwords and webcam data.</small></div></section>
          <section className="admin-panel">
            <div className="admin-panel-heading compact"><div><span className="admin-section-icon"><History /></span><div><h2>Recent administrator actions</h2><p>Accountability history for protected admin operations.</p></div></div></div>
            <div className="admin-audit-list">{data.audit.slice(0, 50).map((item) => <article key={item.id}><History /><div><strong>{item.summary || item.action}</strong><span>{item.administratorName || "Administrator"} · {formatDate(item.createdAt)}</span></div></article>)}{!data.audit.length ? <div className="admin-empty-state">New administrator actions will appear here.</div> : null}</div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
