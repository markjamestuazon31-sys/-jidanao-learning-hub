import { GraduationCap, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSchoolStructure } from "../context/SchoolStructureContext";
import { activeGradeOptions, classLabel, sectionsForGrade } from "../data/schoolClasses";
import { completeStudentProfile } from "../services/authService";

const DASHBOARD_BY_ROLE = {
  student: "/student/dashboard",
  teacher: "/teacher/dashboard",
  admin: "/admin/dashboard",
};

export default function CompleteProfile() {
  const navigate = useNavigate();
  const { user, profile, loading, refreshProfile } = useAuth();
  const { structure, loading: structureLoading } = useSchoolStructure();
  const suggestedName = useMemo(() => {
    if (user?.displayName) return user.displayName;
    return user?.email?.split("@")[0] || "";
  }, [user]);

  const [form, setForm] = useState({
    name: suggestedName,
    gradeLevel: profile?.gradeLevel || "Grade 3",
    section: "Section 1",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const gradeOptions = useMemo(() => {
    const active = activeGradeOptions(structure);
    if (!profile?.gradeLevel || active.some((grade) => grade.name === profile.gradeLevel)) return active;
    return [{ key: profile.gradeKey || profile.gradeLevel, name: profile.gradeLevel, sections: [] }, ...active];
  }, [profile?.gradeKey, profile?.gradeLevel, structure]);
  const sectionOptions = useMemo(() => {
    const active = sectionsForGrade(structure, form.gradeLevel);
    return active.length ? active : sectionsForGrade(structure, form.gradeLevel, { includeInactive: true });
  }, [form.gradeLevel, structure]);

  useEffect(() => {
    if (!form.name && suggestedName) {
      setForm((current) => ({ ...current, name: suggestedName }));
    }
  }, [form.name, suggestedName]);

  useEffect(() => {
    if (profile?.gradeLevel && form.gradeLevel !== profile.gradeLevel) {
      setForm((current) => ({ ...current, gradeLevel: profile.gradeLevel }));
    }
  }, [form.gradeLevel, profile?.gradeLevel]);

  useEffect(() => {
    if (!gradeOptions.length) return;
    const selectedGrade = gradeOptions.find((grade) => grade.name === form.gradeLevel) || gradeOptions[0];
    const sections = sectionsForGrade(structure, selectedGrade.name);
    const selectedSection = sections.some((section) => section.name === form.section)
      ? form.section
      : sections[0]?.name || form.section;
    if (selectedGrade.name !== form.gradeLevel || selectedSection !== form.section) {
      setForm((current) => ({ ...current, gradeLevel: selectedGrade.name, section: selectedSection }));
    }
  }, [form.gradeLevel, form.section, gradeOptions, structure]);

  if (loading) {
    return <div className="page-state">Checking your account…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const needsStudentClass = profile?.role === "student" && (!profile?.section || !profile?.classKey);

  if (profile?.role && !needsStudentClass) {
    return (
      <Navigate
        to={DASHBOARD_BY_ROLE[profile.role] || "/"}
        replace
      />
    );
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      await completeStudentProfile(form);
      const nextProfile = await refreshProfile();

      if (nextProfile?.role !== "student") {
        throw new Error("The student profile could not be verified after creation.");
      }

      navigate("/student/dashboard", { replace: true });
    } catch (submitError) {
      console.error("Unable to complete learner profile:", submitError);
      setError(
        submitError.message ||
          "Unable to create your learner profile. Check the Realtime Database rules and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page profile-setup-page">
      <form className="login-card wide profile-setup-card" onSubmit={submit}>
        <div className="profile-setup-icon" aria-hidden="true">
          <GraduationCap size={34} />
        </div>

        <div>
          <span className="eyebrow dark">{needsStudentClass ? "CLASS PLACEMENT" : "ACCOUNT RECOVERY"}</span>
          <h1>{needsStudentClass ? "Confirm your grade and section" : "Complete your learner profile"}</h1>
          <p>
            Your Firebase sign-in account is valid, but the LMS needs a student
            profile in Realtime Database before it can open your dashboard.
          </p>
        </div>

        <div className="profile-setup-note">
          <ShieldCheck size={18} />
          <span>
            This recovery form can create a <strong>student</strong> profile only.
            Teacher and administrator roles must be created by the administrator.
          </span>
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
            disabled={needsStudentClass}
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
            Your teacher directory placement will be {classLabel(form.gradeLevel, form.section)}.
          </small>
        </label>

        <label>
          Email
          <input value={user.email || ""} disabled />
        </label>

        <button className="primary-button" disabled={busy || structureLoading || !sectionOptions.length}>
          {busy ? "Creating learner profile…" : structureLoading ? "Loading classes…" : "Complete profile & open dashboard"}
        </button>
      </form>
    </div>
  );
}
