import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSchoolStructure } from "../context/SchoolStructureContext";
import { activeGradeOptions, classLabel, sectionsForGrade } from "../data/schoolClasses";
import { registerStudent } from "../services/authService";

export default function Register() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const { structure, loading: structureLoading, error: structureError } = useSchoolStructure();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    gradeLevel: "Grade 3",
    section: "Section 1",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const gradeOptions = useMemo(() => activeGradeOptions(structure), [structure]);
  const sectionOptions = useMemo(() => sectionsForGrade(structure, form.gradeLevel), [form.gradeLevel, structure]);

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
    <div className="auth-page">
      <form className="login-card wide" onSubmit={submit}>
        <img
          src="/jidanao-seal.png"
          alt="Jidanao Elementary School logo"
          className="auth-logo"
        />
        <div>
          <h1>Create student account</h1>
          <p>
            Select an active grade and section configured by the school administrator.
            The student role is assigned automatically and cannot be changed here.
          </p>
        </div>

        {error && <div className="alert error">{error}</div>}

        <label>
          Student name
          <input
            required
            autoComplete="name"
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
          />
        </label>

        <label>
          Grade level
          <select
            value={form.gradeLevel}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                gradeLevel: event.target.value,
              }))
            }
          >
            {gradeOptions.map((grade) => (
              <option key={grade.key} value={grade.name}>
                {grade.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Section
          <select
            value={form.section}
            onChange={(event) =>
              setForm((current) => ({ ...current, section: event.target.value }))
            }
          >
            {sectionOptions.map((section) => (
              <option key={section.key} value={section.name}>{section.name}</option>
            ))}
          </select>
          <small className="field-help">
            Your account will appear in the teacher directory for {classLabel(form.gradeLevel, form.section)}.
          </small>
        </label>

        {structureError && <div className="alert info">The published class list is temporarily unavailable. Please try again or contact the school administrator.</div>}
        {!structureLoading && !gradeOptions.length && (
          <div className="alert info">Registration will open after the administrator adds and publishes a section.</div>
        )}

        <label>
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={(event) =>
              setForm((current) => ({ ...current, email: event.target.value }))
            }
          />
        </label>

        <label>
          Password
          <input
            type="password"
            minLength={8}
            required
            autoComplete="new-password"
            value={form.password}
            onChange={(event) =>
              setForm((current) => ({ ...current, password: event.target.value }))
            }
          />
        </label>

        <button className="primary-button" disabled={busy || structureLoading || !gradeOptions.length || !sectionOptions.length}>
          {busy ? "Creating account…" : structureLoading ? "Loading classes…" : "Register"}
        </button>

        <p className="auth-foot">
          Already registered? <Link to="/login">Login</Link>
        </p>
      </form>
    </div>
  );
}
