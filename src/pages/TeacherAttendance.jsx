import {
  BarChart3,
  CalendarCheck2,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FileCheck2,
  FileText,
  LoaderCircle,
  RefreshCw,
  Save,
  Search,
  UserCheck,
  UserMinus,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import ProfileAvatar from "../components/ProfileAvatar";
import { useAuth } from "../context/AuthContext";
import { useSchoolStructure } from "../context/SchoolStructureContext";
import { assignedClassOptions } from "../data/schoolClasses";
import {
  ATTENDANCE_STATUSES,
  attendanceDateKey,
  getAttendanceForDate,
  getAttendanceForMonth,
  saveAttendanceRegister,
  studentAttendanceSummary,
  summarizeAttendance,
} from "../services/attendanceService";
import { getAcademicSettings } from "../services/dataService";
import { getTeacherStudentDirectory } from "../services/directoryService";
import { exportAttendanceWordReport } from "../utils/attendanceWordReport";

function moveDate(dateValue, amount) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + amount);
  return attendanceDateKey(date);
}

function displayDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-PH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function TeacherAttendance() {
  const { user, profile } = useAuth();
  const { structure } = useSchoolStructure();
  const classOptions = useMemo(() => assignedClassOptions(profile, { includeAllSections: false, structure }), [profile, structure]);
  const [selectedClassKey, setSelectedClassKey] = useState("");
  const [date, setDate] = useState(() => attendanceDateKey(new Date()));
  const [schoolYear, setSchoolYear] = useState("2026-2027");
  const [students, setStudents] = useState([]);
  const [entries, setEntries] = useState({});
  const [monthRecords, setMonthRecords] = useState({});
  const [query, setQuery] = useState("");
  const [view, setView] = useState("register");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectedClass = useMemo(() => classOptions.find((item) => item.key === selectedClassKey) || classOptions[0] || null, [classOptions, selectedClassKey]);
  const classStudents = useMemo(() => students.filter((student) => student.classKey === selectedClass?.key && student.status === "active"), [selectedClass?.key, students]);
  const monthKey = date.slice(0, 7);

  useEffect(() => {
    if (!classOptions.length || selectedClassKey) return;
    setSelectedClassKey(classOptions[0].key);
  }, [classOptions, selectedClassKey]);

  useEffect(() => {
    Promise.all([getTeacherStudentDirectory({ includeSharedDevice: true }), getAcademicSettings()])
      .then(([directory, settings]) => {
        setStudents(directory);
        setSchoolYear(settings.schoolYear || "2026-2027");
      })
      .catch((loadError) => setError(loadError.message || "Unable to initialize the Attendance Tracker."));
  }, []);

  const loadRegister = useCallback(async () => {
    if (!selectedClass?.key) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const [daily, monthly] = await Promise.all([
        getAttendanceForDate(selectedClass.key, date),
        getAttendanceForMonth(selectedClass.key, monthKey),
      ]);
      setEntries(Object.fromEntries(classStudents.map((student) => [student.uid, {
        status: daily?.[student.uid]?.status || "",
        note: daily?.[student.uid]?.note || "",
      }])));
      setMonthRecords(monthly);
    } catch (loadError) {
      setError(loadError.message || "Unable to load attendance records.");
    } finally {
      setLoading(false);
    }
  }, [classStudents, date, monthKey, selectedClass?.key]);

  useEffect(() => { loadRegister(); }, [loadRegister]);

  const filteredStudents = useMemo(() => {
    const term = query.trim().toLowerCase();
    return classStudents.filter((student) => !term || [student.name, student.email, student.learnerNumber]
      .filter(Boolean).some((value) => String(value).toLowerCase().includes(term)));
  }, [classStudents, query]);

  const dailySummary = useMemo(() => summarizeAttendance(Object.values(entries).filter((entry) => entry.status)), [entries]);
  const monthlySummary = useMemo(() => summarizeAttendance(monthRecords), [monthRecords]);
  const recorded = dailySummary.total;
  const attendanceRate = recorded ? Math.round(((dailySummary.present + dailySummary.late) / recorded) * 100) : 0;
  const visibleSummary = view === "tracking" ? monthlySummary : dailySummary;
  const visibleRate = visibleSummary.total ? Math.round(((visibleSummary.present + visibleSummary.late) / visibleSummary.total) * 100) : 0;

  function setStudentEntry(uid, changes) {
    setEntries((current) => ({ ...current, [uid]: { ...(current[uid] || {}), ...changes } }));
    setMessage("");
  }

  function markAllPresent() {
    setEntries((current) => Object.fromEntries(classStudents.map((student) => [student.uid, {
      ...(current[student.uid] || {}),
      status: "present",
    }])));
    setMessage("All learners marked present. Select Save attendance to record the register.");
  }

  async function save() {
    if (!selectedClass) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await saveAttendanceRegister({
        teacherId: user.uid,
        grade: selectedClass.grade,
        section: selectedClass.section,
        date,
        schoolYear,
        students: classStudents,
        entries,
      });
      await loadRegister();
      setMessage(`${result.saved} attendance records saved for ${displayDate(date)}.`);
    } catch (saveError) {
      setError(saveError.message || "Unable to save attendance.");
    } finally {
      setSaving(false);
    }
  }

  async function exportMonth() {
    if (!Object.keys(monthRecords).length) {
      setError("No attendance records are available for this month.");
      return;
    }
    setExporting(true);
    setError("");
    try {
      const summaries = Object.fromEntries(classStudents.map((student) => [student.uid, studentAttendanceSummary(monthRecords, student.uid)]));
      await exportAttendanceWordReport({
        teacherName: profile?.name || user?.displayName || "Jidanao Teacher",
        classLabel: selectedClass?.label || "Assigned class",
        schoolYear,
        monthKey,
        students: classStudents,
        summaries,
      });
    } catch (exportError) {
      setError(exportError.message || "The Microsoft Word attendance report could not be created.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="teacher-attendance-page">
      <header className="teacher-attendance-hero">
        <div><span>CLASS ATTENDANCE</span><h1>Daily Attendance Tracker</h1><p>Record and review attendance only for your administrator-assigned Grade and Section. Every update is stored with the teacher, date, and school year.</p></div>
        <aside>{view === "tracking" ? <BarChart3 size={34} /> : <CalendarCheck2 size={34} />}<div><small>{view === "tracking" ? "MONTHLY TRACKING" : "TODAY’S REGISTER"}</small><strong>{view === "tracking" ? `${monthlySummary.total} attendance entries` : `${recorded}/${classStudents.length} recorded`}</strong><span>{view === "tracking" ? `${visibleRate}% monthly attendance rate` : `${attendanceRate}% attendance rate`}</span></div></aside>
      </header>

      {error && <div className="alert error" role="alert">{error}</div>}
      {message && <div className="alert success" role="status">{message}</div>}
      {!classOptions.length && <div className="alert error">No class is assigned to your teacher account. Ask the administrator to assign a Grade and Section.</div>}

      {classOptions.length > 0 && <section className="teacher-attendance-class-switcher" aria-label="Attendance class selector"><div><Users size={19} /><span><strong>Select attendance class</strong><small>Switch registers without leaving this page</small></span></div><div>{classOptions.map((item) => <button type="button" className={selectedClass?.key === item.key ? "is-active" : ""} aria-pressed={selectedClass?.key === item.key} key={item.key} onClick={() => setSelectedClassKey(item.key)}><strong>{item.section}</strong><small>{item.grade}</small></button>)}</div></section>}

      <nav className="teacher-attendance-view-tabs" aria-label="Attendance workspace views">
        <button type="button" className={view === "register" ? "is-active" : ""} onClick={() => setView("register")}><CalendarCheck2 size={18} /><span><strong>Take Attendance</strong><small>Mark today’s class register</small></span></button>
        <button type="button" className={view === "tracking" ? "is-active" : ""} onClick={() => setView("tracking")}><BarChart3 size={18} /><span><strong>Attendance Tracking</strong><small>Review monthly learner records</small></span></button>
      </nav>

      <section className="panel teacher-attendance-filters">
        {view === "register" ? <label>Attendance date<div className="teacher-attendance-date-control"><button type="button" onClick={() => setDate((current) => moveDate(current, -1))} aria-label="Previous day"><ChevronLeft size={17} /></button><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /><button type="button" onClick={() => setDate((current) => moveDate(current, 1))} aria-label="Next day"><ChevronRight size={17} /></button></div></label> : <label>Tracking month<input type="month" value={monthKey} onChange={(event) => setDate(`${event.target.value}-01`)} /></label>}
        <label>School year<input value={schoolYear} onChange={(event) => setSchoolYear(event.target.value)} /></label>
        <div className="teacher-attendance-filter-actions"><button className="ghost-button" type="button" onClick={loadRegister} disabled={loading}><RefreshCw className={loading ? "spin" : ""} size={17} /> Refresh</button>{view === "tracking" && <button className="ghost-button" type="button" onClick={() => void exportMonth()} disabled={exporting}><Download size={17} /> {exporting ? "Preparing Word…" : "Download Word report"}</button>}</div>
      </section>

      <section className="teacher-attendance-metrics">
        <article className="is-present"><UserCheck /><div><strong>{visibleSummary.present}</strong><span>Present</span></div></article>
        <article className="is-absent"><UserMinus /><div><strong>{visibleSummary.absent}</strong><span>Absent</span></div></article>
        <article className="is-late"><Clock3 /><div><strong>{visibleSummary.late}</strong><span>Late</span></div></article>
        <article className="is-excused"><FileCheck2 /><div><strong>{visibleSummary.excused}</strong><span>Excused</span></div></article>
        <article className="is-rate"><CalendarDays /><div><strong>{visibleRate}%</strong><span>{view === "tracking" ? "Monthly rate" : "Attendance rate"}</span></div></article>
      </section>

      {view === "register" ? <section className="panel teacher-attendance-register">
        <div className="teacher-attendance-heading">
          <div><span><CalendarCheck2 size={21} /></span><div><h2>{displayDate(date)}</h2><p>{selectedClass?.label || "Select an assigned class"} · {schoolYear}</p></div></div>
          <div><label><Search size={16} /><span className="sr-only">Search learners</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search learner…" /></label><button type="button" onClick={markAllPresent} disabled={!classStudents.length}><Check size={17} /> Mark all present</button><button className="primary-button" type="button" onClick={save} disabled={saving || !classStudents.length}><Save size={17} /> {saving ? "Saving…" : "Save attendance"}</button></div>
        </div>

        {loading ? (
          <div className="teacher-workspace-state"><LoaderCircle className="spin" /> Loading the class register…</div>
        ) : filteredStudents.length ? (
          <div className="teacher-attendance-table-wrap">
            <table>
              <thead><tr><th>Learner</th><th>Daily status</th><th>Teacher note</th></tr></thead>
              <tbody>{filteredStudents.map((student) => (
                  <tr key={student.uid}>
                    <td><div className="teacher-attendance-student"><ProfileAvatar uid={student.uid} name={student.name} size={38} decorative /><span><strong>{student.name}</strong><small>{student.source === "shared-device" ? "Shared-device learner" : student.email}</small></span></div></td>
                    <td><div className="teacher-attendance-statuses">{ATTENDANCE_STATUSES.map((status) => <button type="button" className={`is-${status.value} ${entries[student.uid]?.status === status.value ? "active" : ""}`} onClick={() => setStudentEntry(student.uid, { status: status.value })} key={status.value}>{status.label}</button>)}</div></td>
                    <td><input value={entries[student.uid]?.note || ""} onChange={(event) => setStudentEntry(student.uid, { note: event.target.value })} placeholder="Optional note" maxLength={300} /></td>
                  </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <div className="teacher-workspace-state"><Users size={27} /> No learners match this assigned section.</div>}
      </section> : <section className="panel teacher-attendance-register teacher-attendance-tracking">
        <div className="teacher-attendance-heading"><div><span><BarChart3 size={21} /></span><div><h2>Monthly Attendance Tracking</h2><p>{selectedClass?.label || "Select an assigned class"} · {monthKey} · {schoolYear}</p></div></div><div><label><Search size={16} /><span className="sr-only">Search learners</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search learner…" /></label><button type="button" onClick={() => void exportMonth()} disabled={exporting || !Object.keys(monthRecords).length}><FileText size={17} /> {exporting ? "Preparing…" : "Word report"}</button></div></div>
        {loading ? <div className="teacher-workspace-state"><LoaderCircle className="spin" /> Loading monthly attendance…</div> : filteredStudents.length ? <div className="teacher-attendance-table-wrap"><table className="teacher-attendance-tracking-table"><thead><tr><th>Learner</th><th>Present</th><th>Absent</th><th>Late</th><th>Excused</th><th>Days recorded</th><th>Attendance rate</th></tr></thead><tbody>{filteredStudents.map((student) => { const month = studentAttendanceSummary(monthRecords, student.uid); const rate = month.total ? Math.round(((month.present + month.late) / month.total) * 100) : 0; return <tr key={student.uid}><td><div className="teacher-attendance-student"><ProfileAvatar uid={student.uid} name={student.name} size={38} decorative /><span><strong>{student.name}</strong><small>{student.source === "shared-device" ? "Shared-device learner" : student.email}</small></span></div></td><td><span className="attendance-tracking-count is-present">{month.present}</span></td><td><span className="attendance-tracking-count is-absent">{month.absent}</span></td><td><span className="attendance-tracking-count is-late">{month.late}</span></td><td><span className="attendance-tracking-count is-excused">{month.excused}</span></td><td><strong>{month.total}</strong></td><td><div className="attendance-tracking-rate"><span><i style={{ width: `${rate}%` }} /></span><strong>{rate}%</strong></div></td></tr>; })}</tbody></table></div> : <div className="teacher-workspace-state"><Users size={27} /> No learners match this assigned section.</div>}
      </section>}
    </div>
  );
}
