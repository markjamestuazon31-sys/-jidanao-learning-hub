import { useCallback, useEffect, useMemo, useState } from "react";
import {
  GraduationCap,
  Mail,
  MonitorPlay,
  RefreshCw,
  Search,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import ProfileAvatar from "../components/ProfileAvatar";
import { useSchoolStructure } from "../context/SchoolStructureContext";
import { activeGradeOptions, allSectionNames, normalizeSection, sectionsForGrade } from "../data/schoolClasses";
import { normalizeGradeLevel, updateStudentClass, updateUserStatus } from "../services/dataService";
import { getAdminStudentDirectory } from "../services/directoryService";
import "../styles/teacher-game-zone.css";

export default function AdminStudents() {
  const { structure } = useSchoolStructure();
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState("");
  const [grade, setGrade] = useState("All Grades");
  const [section, setSection] = useState("All Sections");
  const [status, setStatus] = useState("All Statuses");
  const [access, setAccess] = useState("All Access Types");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const gradeOptions = useMemo(() => activeGradeOptions(structure), [structure]);
  const filterSectionOptions = useMemo(() => grade === "All Grades"
    ? allSectionNames(structure)
    : sectionsForGrade(structure, grade).map((item) => item.name), [grade, structure]);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      setStudents(await getAdminStudentDirectory());
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Unable to load student accounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const filteredStudents = useMemo(() => {
    const term = search.trim().toLowerCase();
    return students.filter((student) => {
      const matchesSearch = !term || [student.name, student.email, student.uid]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
      const matchesGrade = grade === "All Grades" || normalizeGradeLevel(student.gradeLevel) === grade;
      const matchesSection = section === "All Sections" || normalizeSection(student.section) === section;
      const studentStatus = student.status === "disabled" ? "Disabled" : "Active";
      const matchesStatus = status === "All Statuses" || studentStatus === status;
      const accessType = student.source === "shared-device" ? "Shared Device" : "Student Account";
      const matchesAccess = access === "All Access Types" || accessType === access;
      return matchesSearch && matchesGrade && matchesSection && matchesStatus && matchesAccess;
    });
  }, [access, students, search, grade, section, status]);

  async function changeClass(student, gradeLevel, sectionLevel) {
    try {
      await updateStudentClass(student.uid, gradeLevel, sectionLevel);
      setMessageType("success");
      setMessage(`${student.name || student.email} moved to ${gradeLevel} · ${sectionLevel}.`);
      await loadStudents();
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Unable to change learner grade level.");
    }
  }

  async function toggleStatus(student) {
    const nextStatus = student.status === "disabled" ? "active" : "disabled";
    try {
      await updateUserStatus(student.uid, nextStatus);
      setMessageType("success");
      setMessage(`${student.name || student.email} is now ${nextStatus}.`);
      await loadStudents();
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Unable to update student account status.");
    }
  }

  const gradeCounts = useMemo(
    () => gradeOptions.map((item) => ({
      grade: item.name,
      count: students.filter((student) => normalizeGradeLevel(student.gradeLevel) === item.name).length,
    })),
    [gradeOptions, students],
  );

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <span className="admin-kicker">LEARNER DIRECTORY</span>
          <h1>Student accounts</h1>
          <p>Review learner profiles, grade placement, and LMS access status.</p>
        </div>
        <button type="button" className="admin-button secondary" onClick={loadStudents} disabled={loading}>
          <RefreshCw size={17} className={loading ? "spin" : ""} /> Refresh
        </button>
      </header>

      {message && <div className={`alert ${messageType} admin-alert`}>{message}</div>}

      <section className="admin-grade-summary-grid">
        {gradeCounts.map((item) => (
          <article key={item.grade} className="admin-grade-summary-card">
            <span><GraduationCap size={18} /></span>
            <div><strong>{item.count}</strong><small>{item.grade} learners</small></div>
          </article>
        ))}
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div><span className="admin-section-icon"><Users size={19} /></span><div><h2>Student directory</h2><p>{students.length} registered learner profile{students.length === 1 ? "" : "s"}</p></div></div>
        </div>

        <div className="admin-filter-row">
          <label className="admin-search-box">
            <Search size={17} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search learner or email…" />
          </label>
          <select value={grade} onChange={(e) => { setGrade(e.target.value); setSection("All Sections"); }}>
            <option>All Grades</option>
            {gradeOptions.map((item) => <option key={item.key} value={item.name}>{item.name}</option>)}
          </select>
          <select value={section} onChange={(e) => setSection(e.target.value)}>
            <option>All Sections</option>
            {filterSectionOptions.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option>All Statuses</option>
            <option>Active</option>
            <option>Disabled</option>
          </select>
          <select value={access} onChange={(e) => setAccess(e.target.value)}>
            <option>All Access Types</option>
            <option>Student Account</option>
            <option>Shared Device</option>
          </select>
        </div>

        <div className="admin-responsive-table">
          <table>
            <thead>
              <tr>
                <th>Learner</th>
                <th>Grade level</th>
                <th>Section</th>
                <th>Access type</th>
                <th>Status</th>
                <th>Account created</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => (
                <tr key={student.uid}>
                  <td>
                    <div className="admin-table-person">
                      <ProfileAvatar
                        uid={student.uid}
                        name={student.name}
                        photoDataUrl={student.photoDataUrl}
                        size={42}
                        className="admin-avatar-photo"
                      />
                      <div><strong>{student.name || "Unnamed learner"}</strong><small>{student.source === "shared-device" ? <><MonitorPlay size={12} /> Added by {student.createdByName || "teacher"}</> : <><Mail size={12} /> {student.email}</>}</small></div>
                    </div>
                  </td>
                  <td>
                    {student.source === "shared-device" ? <strong>{normalizeGradeLevel(student.gradeLevel)}</strong> : <select
                        className="admin-table-select"
                        value={normalizeGradeLevel(student.gradeLevel) || gradeOptions[0]?.name || ""}
                        onChange={(event) => {
                          const nextSections = sectionsForGrade(structure, event.target.value);
                          if (nextSections[0]) void changeClass(student, event.target.value, nextSections[0].name);
                        }}
                      >
                        {!gradeOptions.some((item) => item.name === normalizeGradeLevel(student.gradeLevel)) && <option value={normalizeGradeLevel(student.gradeLevel)}>{normalizeGradeLevel(student.gradeLevel)} (inactive)</option>}
                        {gradeOptions.map((item) => <option key={item.key} value={item.name}>{item.name}</option>)}
                      </select>}
                  </td>
                  <td>
                    {student.source === "shared-device" ? <strong>{normalizeSection(student.section)}</strong> : <select
                        className="admin-table-select"
                        value={normalizeSection(student.section)}
                        onChange={(e) => changeClass(student, normalizeGradeLevel(student.gradeLevel), e.target.value)}
                      >
                        {!sectionsForGrade(structure, student.gradeLevel).some((item) => item.name === normalizeSection(student.section)) && <option value={normalizeSection(student.section)}>{normalizeSection(student.section)} (inactive)</option>}
                        {sectionsForGrade(structure, student.gradeLevel).map((item) => <option key={item.key} value={item.name}>{item.name}</option>)}
                      </select>}
                  </td>
                  <td><span className={`admin-status-pill ${student.source === "shared-device" ? "shared-device" : "active"}`}>{student.source === "shared-device" ? "Shared device" : "LMS account"}</span></td>
                  <td><span className={`admin-status-pill ${student.status === "disabled" ? "disabled" : "active"}`}>{student.status === "disabled" ? "Disabled" : "Active"}</span></td>
                  <td>{student.createdAt ? new Date(student.createdAt).toLocaleDateString() : "—"}</td>
                  <td>
                    {student.source === "shared-device" ? <span className="admin-shared-device-note"><MonitorPlay size={14} /> Teacher-managed</span> : <button type="button" className={`admin-text-button ${student.status === "disabled" ? "positive" : "danger"}`} onClick={() => toggleStatus(student)}>
                        {student.status === "disabled" ? <UserCheck size={15} /> : <UserX size={15} />}
                        {student.status === "disabled" ? "Activate" : "Disable"}
                      </button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && filteredStudents.length === 0 && <div className="admin-empty-state">No students match the selected filters.</div>}
      </section>
    </div>
  );
}
