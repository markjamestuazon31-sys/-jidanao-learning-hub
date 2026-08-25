import { BookOpenCheck, ClipboardCheck, FileDown, LoaderCircle, Medal, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import VoiceSettings from "../components/student/VoiceSettings";
import { useAuth } from "../context/AuthContext";
import { getGradeExperience } from "../data/gradeExperience";
import { subscribeStudentGrades } from "../services/dataService";
import { flattenReleasedGrades, gradeRemark } from "../services/gradebookService";
import { generateReportCard } from "../utils/pdf";

export default function StudentGrades() {
  const { user, profile } = useAuth();
  const [grades, setGrades] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const experience = getGradeExperience(profile?.gradeLevel);

  useEffect(() => {
    if (!user?.uid) return undefined;
    return subscribeStudentGrades(
      user.uid,
      (value) => {
        setGrades(value);
        setLoading(false);
      },
      (loadError) => {
        setError(loadError.message || "Unable to load released grades.");
        setLoading(false);
      },
    );
  }, [user?.uid]);

  const rows = useMemo(() => flattenReleasedGrades(grades), [grades]);
  const average = rows.length
    ? Math.round((rows.reduce((sum, row) => sum + Number(row.score || 0), 0) / rows.length) * 10) / 10
    : 0;
  const highest = rows.length ? Math.max(...rows.map((row) => Number(row.score || 0))) : 0;
  const subjects = new Set(rows.map((row) => row.subject)).size;
  const grouped = useMemo(() => {
    const groups = new Map();
    rows.forEach((row) => {
      const key = `${row.schoolYear} • ${row.period}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });
    return [...groups.entries()];
  }, [rows]);

  function downloadReportCard() {
    const latestSchoolYear = rows.map((row) => row.schoolYear).sort().at(-1);
    generateReportCard({
      student: { ...profile, uid: user?.uid },
      grades: rows,
      schoolYear: latestSchoolYear,
      schoolName: "Jidanao Elementary School",
    });
  }

  return (
    <div className={`student-portal student-grades-page student-theme--${experience.theme}`}>
      <header className="student-page-hero">
        <div className="student-page-hero__icon"><ClipboardCheck size={30} /></div>
        <div><span>{profile?.gradeLevel} ACADEMIC RECORD</span><h1>My grades</h1><p>View grades released by your teacher across subjects and grading periods.</p></div>
        <div className="student-page-hero__tools"><VoiceSettings compact />{rows.length > 0 && <button className="student-report-download" type="button" onClick={downloadReportCard}><FileDown size={16} /> Report card PDF</button>}<strong>{average || "—"}</strong><small>overall average</small></div>
      </header>

      {loading ? (
        <div className="student-state-card"><LoaderCircle className="spin" size={30} /><div><strong>Loading released grades…</strong><p>Reading your official Realtime Database grade records.</p></div></div>
      ) : error ? (
        <div className="student-state-card student-state-card--error"><ClipboardCheck size={30} /><div><strong>Grades could not be loaded.</strong><p>{error}</p></div></div>
      ) : rows.length === 0 ? (
        <div className="student-state-card student-state-card--empty"><BookOpenCheck size={30} /><div><strong>No grades have been released yet.</strong><p>Your teacher’s released grading-period results will appear here automatically.</p></div></div>
      ) : (
        <>
          <section className="student-grade-metrics">
            <article><TrendingUp /><span>Overall average</span><strong>{average}</strong><small>{gradeRemark(average)}</small></article>
            <article><Medal /><span>Highest grade</span><strong>{highest}</strong><small>{gradeRemark(highest)}</small></article>
            <article><BookOpenCheck /><span>Subjects recorded</span><strong>{subjects}</strong><small>{rows.length} released results</small></article>
          </section>

          <section className="student-grade-groups">
            {grouped.map(([group, groupRows]) => (
              <article className="student-grade-card" key={group}>
                <div className="student-grade-card__header"><div><span>RELEASED RESULTS</span><h2>{group}</h2></div><strong>{Math.round(groupRows.reduce((sum, row) => sum + row.score, 0) / groupRows.length)}</strong></div>
                <div className="student-grade-table-wrap">
                  <table>
                    <thead><tr><th>Subject</th><th>Grade</th><th>Performance</th><th>Remarks</th></tr></thead>
                    <tbody>
                      {groupRows.map((row) => (
                        <tr key={row.id}>
                          <td><strong>{row.subject}</strong></td>
                          <td><span className={`student-grade-score ${row.score < 75 ? "is-low" : row.score >= 90 ? "is-high" : ""}`}>{row.score}</span></td>
                          <td><div className="student-grade-bar"><span style={{ width: `${Math.max(0, Math.min(100, row.score))}%` }} /></div></td>
                          <td>{row.remarks || gradeRemark(row.score)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
