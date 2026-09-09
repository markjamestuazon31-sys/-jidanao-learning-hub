import {
  ArrowLeft,
  BookOpenCheck,
  Eye,
  EyeOff,
  GraduationCap,
  LockKeyhole,
  LogIn,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { login } from "../services/authService";
import "../styles/login.css";

const DASHBOARD_BY_ROLE = {
  student: "/student/dashboard",
  teacher: "/teacher/dashboard",
  admin: "/admin/dashboard",
};

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshProfile } = useAuth();

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      await login(email, password);
      const profile = await refreshProfile();

      if (!profile?.role) {
        navigate("/complete-profile", { replace: true });
        return;
      }

      const fallback = DASHBOARD_BY_ROLE[profile.role] || "/";
      navigate(location.state?.from || fallback, { replace: true });
    } catch (submitError) {
      console.error("Login failed:", submitError);
      setError(
        submitError.code
          ?.replace("auth/", "")
          .replaceAll("-", " ") || "Unable to sign in.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="jidanao-login-page">
      <Link className="jidanao-login-back" to="/">
        <ArrowLeft size={18} aria-hidden="true" />
        <span>Back to home</span>
      </Link>

      <div className="jidanao-login-shell">
        <section className="jidanao-login-showcase" aria-label="Jidanao Learning Hub welcome">
          <div className="jidanao-login-glow jidanao-login-glow--one" />
          <div className="jidanao-login-glow jidanao-login-glow--two" />
          <div className="jidanao-login-dots" aria-hidden="true" />

          <div className="jidanao-login-brand">
            <span className="jidanao-login-brand__seal">
              <img src="/jidanao-seal.png" alt="Jidanao Elementary School seal" />
            </span>
            <span>
              <strong>Jidanao Elementary School</strong>
              <small>Learning Hub</small>
            </span>
          </div>

          <div className="jidanao-login-welcome">
            <span className="jidanao-login-eyebrow">
              <Sparkles size={16} aria-hidden="true" />
              Learn. Play. Grow.sssss
            </span>
            <h1>Welcome back to your learning journey.</h1>
            <p>
              Access interactive lessons, camera-powered games, class activities,
              progress, and achievements in one secure place.
            </p>
          </div>

          <div className="jidanao-login-learning-card" aria-hidden="true">
            <span className="jidanao-login-learning-card__icon">
              <GraduationCap size={42} />
            </span>
            <span>
              <small>Your classroom is ready</small>
              <strong>Continue learning today</strong>
            </span>
            <span className="jidanao-login-learning-card__badge">+10 XP</span>
          </div>

          <div className="jidanao-login-benefits">
            <div>
              <ShieldCheck size={22} aria-hidden="true" />
              <span>
                <strong>Secure access</strong>
                <small>Protected school account</small>
              </span>
            </div>
            <div>
              <BookOpenCheck size={22} aria-hidden="true" />
              <span>
                <strong>Ready to learn</strong>
                <small>Lessons and games in one hub</small>
              </span>
            </div>
          </div>
        </section>

        <section className="jidanao-login-form-panel">
          <form className="jidanao-login-form" onSubmit={submit} noValidate>
            <div className="jidanao-login-mobile-brand">
              <img src="/jidanao-seal.png" alt="" />
              <span>Jidanao Learning Hub</span>
            </div>

            <header className="jidanao-login-form__header">
              <span className="jidanao-login-form__kicker">Account access</span>
              <h2>Login to your account</h2>
              <p>Enter your school account credentials to continue.</p>
            </header>

            {location.state?.message && (
              <div className="jidanao-login-alert jidanao-login-alert--info" role="status">
                {location.state.message}
              </div>
            )}

            {error && (
              <div className="jidanao-login-alert jidanao-login-alert--error" role="alert">
                {error}
              </div>
            )}

            <div className="jidanao-login-fields">
              <label className="jidanao-login-field" htmlFor="login-email">
                <span>Email address</span>
                <span className="jidanao-login-input">
                  <Mail size={19} aria-hidden="true" />
                  <input
                    id="login-email"
                    type="email"
                    required
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Enter your email"
                    aria-describedby={error ? "login-error-help" : undefined}
                  />
                </span>
              </label>

              <label className="jidanao-login-field" htmlFor="login-password">
                <span>Password</span>
                <span className="jidanao-login-input jidanao-login-input--password">
                  <LockKeyhole size={19} aria-hidden="true" />
                  <input
                    id="login-password"
                    type={passwordVisible ? "text" : "password"}
                    minLength={6}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    aria-describedby={error ? "login-error-help" : undefined}
                  />
                  <button
                    className="jidanao-password-toggle"
                    type="button"
                    onClick={() => setPasswordVisible((visible) => !visible)}
                    aria-label={passwordVisible ? "Hide password" : "Show password"}
                    aria-pressed={passwordVisible}
                    title={passwordVisible ? "Hide password" : "Show password"}
                  >
                    {passwordVisible ? (
                      <EyeOff size={20} aria-hidden="true" />
                    ) : (
                      <Eye size={20} aria-hidden="true" />
                    )}
                  </button>
                </span>
              </label>
            </div>

            {error && (
              <span id="login-error-help" className="sr-only">
                Correct the login details and try again.
              </span>
            )}

            <button className="jidanao-login-submit" type="submit" disabled={busy}>
              <LogIn size={19} aria-hidden="true" />
              <span>{busy ? "Signing in…" : "Login securely"}</span>
            </button>

            <div className="jidanao-login-support">
              <ShieldCheck size={16} aria-hidden="true" />
              <span>Students, teachers, and administrators use the same secure login.</span>
            </div>

            <p className="jidanao-login-register">
              Student without an account? <Link to="/register">Register here</Link>
            </p>
          </form>
        </section>
      </div>
    </div>
  );
}
