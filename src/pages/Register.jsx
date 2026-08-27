import { CheckCircle2, GraduationCap, School2, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSchoolStructure } from "../context/SchoolStructureContext";
import { activeGradeOptions, classLabel, sectionsForGrade } from "../data/schoolClasses";
import { registerStudent } from "../services/authService";
import "../styles/student-register.css";

export default function Register() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const { structure, loading: structureLoading, error: structureError } = useSchoolStructure();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    gradeLevel: "",
    section: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const gradeOptions = useMemo(() => activeGradeOptions(structure), [structure]);
  const sectionOptions = useMemo(() => sectionsForGrade(structure, form.gradeLevel), [form.gradeLevel, structure]);

  function chooseGrade(gradeName) {
    const sections = sectionsForGrade(structure, gradeName);
    setForm((current) => ({ ...current, gradeLevel: gradeName, section: sections[0]?.name || "" }));
  }

  useEffect(() => {
    if (!gradeOptions.length) return;
    const selectedGrade = gradeOptions.find((grade) => grade.name === form.gradeLevel) || gradeOptions[0];
    const sections = sectionsForGrade(structure, selectedGrade.name);
    const selectedSection = sections.some((section) => section.name === form.section)
      ? form.section
      : sections[0]?.name || "";
    if (selectedGrade.name !== form.gradeLevel || selectedSection !== form.section) {
      setForm((current) => ({ ...current, gradeLevel: selectedGrade.name, section: selectedSection }));
    }
  }, [form.gradeLevel, form.section, gradeOptions, structure]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      await registerStudent(form);

      // Firebase Auth changes state before the Realtime Database profile write
      // has necessarily been observed by AuthContext. Refresh explicitly after
      // the profile is persisted to eliminate the Auth/profile race condition.
      const profile = await refreshProfile();

      if (profile?.role !== "student") {
        throw new Error(
          "The account was created, but the learner profile could not be verified.",
        );
      }

      navigate("/student/dashboard", { replace: true });
    } catch (submitError) {
      console.error("Student registration failed:", submitError);
      setError(submitError.message || "Registration failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="student-register-page">
      <aside className="student-register-intro">
        <img src="/jidanao-seal.png" alt="Jidanao Elementary School logo" />
        <span>JIDANAO ELEMENTARY SCHOOL</span>
        <h1>Join your digital classroom</h1>
        <p>Create a learner account for Grades 3–6. Your selected Grade and Section connect you to the correct teachers, lessons, quizzes, games, and attendance records.</p>
        <div className="student-register-benefits">
          <div><GraduationCap /><span><strong>Grades 3–6</strong><small>Choose the learner’s current grade</small></span></div>
          <div><School2 /><span><strong>Correct class directory</strong><small>Sections update after choosing a grade</small></span></div>
          <div><ShieldCheck /><span><strong>Student account only</strong><small>Teacher and administrator roles stay protected</small></span></div>
        </div>
      </aside>

      <form className="student-register-card" onSubmit={submit}>
        <header>
          <span><UserRound size={19} /> STUDENT REGISTRATION</span>
          <h2>Create your learner account</h2>
          <p>Complete the four steps below. Grade and Section cannot be changed by the learner after registration.</p>
        </header>

        {error && <div className="alert error">{error}</div>}

        <label className="student-register-field">
          <span>1. Student’s complete name</span>
          <input
            required
            autoComplete="name"
            placeholder="Example: Maria Santos"
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
          />
        </label>

        <fieldset className="student-register-choice-group">
          <legend>2. Choose the grade level</legend>
          <p>Selecting a grade immediately loads only its sections.</p>
          <div className="student-register-grade-grid">
            {gradeOptions.map((grade) => <button type="button" className={form.gradeLevel === grade.name ? "is-selected" : ""} onClick={() => chooseGrade(grade.name)} key={grade.key}><GraduationCap size={21} /><span><strong>{grade.name}</strong><small>{grade.sections.length} section{grade.sections.length === 1 ? "" : "s"} available</small></span>{form.gradeLevel === grade.name && <CheckCircle2 size={18} />}</button>)}
          </div>
        </fieldset>

        <fieldset className="student-register-choice-group">
          <legend>3. Choose the section</legend>
          <p>{form.gradeLevel ? `Available sections for ${form.gradeLevel}` : "Choose a grade first"}</p>
          <div className="student-register-section-grid">
            {sectionOptions.map((section) => <button type="button" className={form.section === section.name ? "is-selected" : ""} onClick={() => setForm((current) => ({ ...current, section: section.name }))} key={section.key}><School2 size={17} /><strong>{section.name}</strong>{form.section === section.name && <CheckCircle2 size={16} />}</button>)}
          </div>
          {form.gradeLevel && form.section && <div className="student-register-class-confirmation"><CheckCircle2 size={18} /><span>Your account will join <strong>{classLabel(form.gradeLevel, form.section)}</strong>.</span></div>}
        </fieldset>

        {structureError && <div className="alert info">The published class list is temporarily unavailable. Please try again or contact the school administrator.</div>}
        {!structureLoading && !gradeOptions.length && (
          <div className="alert info">Registration will open after the administrator adds and publishes a section.</div>
        )}

        <div className="student-register-access">
          <div><strong>4. Create the login</strong><span>Use an email the learner or parent can access.</span></div>
          <label>Email address<input type="email" required autoComplete="email" placeholder="student@example.com" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></label>
          <label>Password<input type="password" minLength={8} required autoComplete="new-password" placeholder="At least 8 characters" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} /></label>
        </div>

        <button className="student-register-submit" disabled={busy || structureLoading || !gradeOptions.length || !sectionOptions.length || !form.gradeLevel || !form.section}>
          {busy ? "Creating account…" : structureLoading ? "Loading classes…" : "Register"}
        </button>

        <p className="student-register-foot">
          Already registered? <Link to="/login">Login</Link>
        </p>
      </form>
    </div>
  );
}
