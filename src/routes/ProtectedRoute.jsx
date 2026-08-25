import { GraduationCap, LogOut, ShieldAlert } from "lucide-react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { logout } from "../services/authService";

const DASHBOARD_BY_ROLE = {
  student: "/student/dashboard",
  teacher: "/teacher/dashboard",
  admin: "/admin/dashboard",
};

export default function ProtectedRoute({ roles, children }) {
  const { user, profile, role, loading, profileError } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="page-state">Loading your account…</div>;
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  if (profileError || !role) {
    const studentOnlyRoute = roles?.length === 1 && roles[0] === "student";

    if (studentOnlyRoute) {
      return <Navigate to="/complete-profile" replace />;
    }

    return (
      <section className="account-error panel" role="alert">
        <ShieldAlert size={42} />
        <h1>Account profile needs attention</h1>
        <p>
          {profileError || "Your LMS role is missing from Realtime Database."}
        </p>
        <p className="account-error-help">
          Student account? Complete the learner profile now. Teacher and
          administrator roles must be provisioned by an administrator under
          <code> users/{user.uid}</code>.
        </p>
        <div className="account-error-actions">
          <Link className="primary-button" to="/complete-profile">
            <GraduationCap size={18} /> Complete student profile
          </Link>
          <button type="button" className="ghost-button" onClick={logout}>
            <LogOut size={17} /> Sign out
          </button>
        </div>
      </section>
    );
  }

  if (profile?.status === "disabled") {
    return (
      <section className="account-error panel" role="alert">
        <ShieldAlert size={42} />
        <h1>Account access is disabled</h1>
        <p>
          This LMS profile has been disabled. Please contact the school
          administrator if you believe this is an error.
        </p>
        <button type="button" className="ghost-button" onClick={logout}>
          <LogOut size={17} /> Sign out
        </button>
      </section>
    );
  }

  if (role === "student" && (!profile?.section || !profile?.classKey)) {
    return <Navigate to="/complete-profile" replace />;
  }

  if (roles && !roles.includes(role)) {
    return <Navigate to={DASHBOARD_BY_ROLE[role] || "/"} replace />;
  }

  return children;
}
