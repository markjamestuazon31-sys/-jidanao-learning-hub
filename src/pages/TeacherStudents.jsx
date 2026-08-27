import { useEffect, useMemo, useState } from "react";
import { GraduationCap, Mail, MonitorPlay, RefreshCw, Search, ShieldCheck, Users } from "lucide-react";
import ProfileAvatar from "../components/ProfileAvatar";
import { useSchoolStructure } from "../context/SchoolStructureContext";
import { activeGradeOptions, allSectionNames, normalizeSection } from "../data/schoolClasses";
import { normalizeGradeLevel } from "../services/dataService";
import { getTeacherStudentDirectory } from "../services/directoryService";

export default function TeacherStudents() {
  const { structure } = useSchoolStructure();
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState("");
  const [grade, setGrade] = useState("All Grades");
  const [section, setSection] = useState("All Sections");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const gradeOptions = useMemo(() => activeGradeOptions(structure), [structure]);
  const sectionOptions = useMemo(() => allSectionNames(structure), [structure]);

  async function loadStudents() {
    setLoading(true);
    setError("");
    try {
      setStudents(await getTeacherStudentDirectory({ includeSharedDevice: true }));
    } catch (loadError) {
      console.error("Unable to load teacher student directory:", loadError);
      setError(loadError.message || "Student profiles could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStudents();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return students.filter((student) => {
      const matchesTerm = !term || [student.name, student.email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
      const matchesGrade = grade === "All Grades" || normalizeGradeLevel(student.gradeLevel) === grade;
      const matchesSection = section === "All Sections" || normalizeSection(student.section) === section;
      return matchesTerm && matchesGrade && matchesSection;
    });
  }, [students, search, grade, section]);

  const gradeCounts = useMemo(() => Object.fromEntries(
    gradeOptions.map((grade) => [
      grade.name,
      students.filter((student) => normalizeGradeLevel(student.gradeLevel) === grade.name).length,
    ]),
  ), [gradeOptions, students]);

  return (
    <div className="teacher-student-page">
      <header className="teacher-student-hero">
        <div>
          <span className="eyebrow dark">STUDENT MONITORING</span>
          <h1>Your learner directory</h1>
          <p>See learner identity, grade assignment, account status, and the profile picture each student has chosen.</p>
        </div>
        <button type="button" className="primary-button" onClick={loadStudents} disabled={loading}>
          <RefreshCw size={17} className={loading ? "spin" : ""} /> Refresh students
        </button>
      </header>

      {error && <div className="alert error">{error}</div>}

      <section className="teacher-grade-overview">
        {gradeOptions.map((gradeLevel) => (
          <article key={gradeLevel.key}>
            <span><GraduationCap size={18} /></span>
            <div><strong>{gradeCounts[gradeLevel.name]}</strong><small>{gradeLevel.name} learners</small></div>
          </article>
        ))}
      </section>

      <section className="panel teacher-student-directory-panel">
        <div className="teacher-student-panel-heading">
          <div><span><Users size={20} /></span><div><h2>Students</h2><p>{students.length} learner profile{students.length === 1 ? "" : "s"} available to your teacher account.</p></div></div>
          <span className="teacher-directory-security"><ShieldCheck size={15} /> School use only</span>
        </div>

        <div className="teacher-student-filters">
          <label className="teacher-student-search">
            <Search size={17} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search learner or email…" />
          </label>
          <select value={grade} onChange={(event) => setGrade(event.target.value)}>
            <option>All Grades</option>
            {gradeOptions.map((item) => <option key={item.key} value={item.name}>{item.name}</option>)}
          </select>
          <select value={section} onChange={(event) => setSection(event.target.value)}>
            <option>All Sections</option>
            {sectionOptions.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>

        <div className="teacher-student-grid">
          {filtered.map((student) => (
            <article className="teacher-student-card" key={student.uid}>
              <ProfileAvatar
                uid={student.uid}
                name={student.name}
                photoDataUrl={student.photoDataUrl}
                size={58}
              />
              <div className="teacher-student-card__identity">
                <strong>{student.name || "Unnamed learner"}</strong>
                <span>{student.source === "shared-device" ? <><MonitorPlay size={12} /> Shared-device learner</> : <><Mail size={12} /> {student.email || "No email"}</>}</span>
              </div>
              <div className="teacher-student-card__meta">
                <span>{normalizeGradeLevel(student.gradeLevel) || "Unassigned"} · {normalizeSection(student.section, "Unassigned section")}</span>
                <b className={student.status === "disabled" ? "is-disabled" : "is-active"}>{student.status === "disabled" ? "Disabled" : "Active"}</b>
              </div>
              <div className="teacher-student-card__progress" aria-label={`${student.name} progress summary`}>
                <span><strong>{student.progress?.lessonsCompleted || 0}</strong> lessons</span>
                <span><strong>{student.progress?.gameSessions || 0}</strong> games</span>
                <span><strong>{student.progress?.accuracyPercent || 0}%</strong> accuracy</span>
              </div>
            </article>
          ))}
        </div>

        {!loading && filtered.length === 0 && <div className="empty-state">No students match your current search and grade filter.</div>}
      </section>
    </div>
  );
}
