import { useEffect, useState } from "react";
import {
  Bell,
  ChevronDown,
  LogIn,
  LogOut,
  Menu,
  Search,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import ProfileAvatar from "./ProfileAvatar";
import { useAuth } from "../context/AuthContext";
import { logout } from "../services/authService";

const DASHBOARD_ROUTES = {
  admin: "/admin/dashboard",
  teacher: "/teacher/dashboard",
  student: "/student/profile",
};

export default function Navbar({ onMenu = null }) {
  const { user, profile, role } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (location.pathname === "/library" || location.pathname === "/student/search") {
      const params = new URLSearchParams(location.search);
      setQuery(params.get("search") || "");
    }

    setNotificationsOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === "Escape") setNotificationsOpen(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  function handleSearch(event) {
    event.preventDefault();
    const trimmedQuery = query.trim();
    const search = trimmedQuery ? `?search=${encodeURIComponent(trimmedQuery)}` : "";
    navigate(role === "student" ? `/student/search${search}` : `/library${search}`);
  }

  async function handleLogout() {
    if (signingOut) return;

    try {
      setSigningOut(true);
      await logout();
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Unable to sign out:", error);
    } finally {
      setSigningOut(false);
    }
  }

  const profileRoute = DASHBOARD_ROUTES[role] || "/library";
  const profileSubtitle = role === "student" ? profile?.gradeLevel : role || "member";
  const isPublicHome = location.pathname === "/";

  return (
    <header className={`lms-topbar ${role ? `role-${role}-topbar` : ""} ${isPublicHome ? "lms-public-home-topbar" : ""}`}>
      <div className="lms-topbar__left">
        {onMenu && (
          <button
            className="lms-icon-button lms-menu-button"
            type="button"
            onClick={onMenu}
            aria-label="Open navigation menu"
          >
            <Menu size={21} aria-hidden="true" />
          </button>
        )}

        <Link to="/" className="lms-mobile-brand" aria-label="Jidanao Learning Hub home">
          <img src="/school-logo.jpg" alt="" />
          <span>Jidanao Learning Hub</span>
        </Link>

        {isPublicHome && (
          <>
            <Link to="/" className="lms-public-brand" aria-label="Jidanao Elementary School home">
              <img src="/school-logo.jpg" alt="" />
              <span>Jidanao Elementary School</span>
            </Link>
            <nav className="lms-public-nav" aria-label="Public website navigation">
              <Link className={!location.hash ? "is-active" : ""} to="/">Home</Link>
              <Link className={location.hash === "#learning-games" ? "is-active" : ""} to="/#learning-games">Learning Games</Link>
              <Link className={location.hash === "#featured-lessons" ? "is-active" : ""} to="/#featured-lessons">Lessons</Link>
              <Link className={location.hash === "#about-us" ? "is-active" : ""} to="/#about-us">About</Link>
              <Link className={location.hash === "#help-center" ? "is-active" : ""} to="/#help-center">Help</Link>
            </nav>
          </>
        )}

        <form className={`lms-global-search ${isPublicHome ? "lms-global-search--home-hidden" : ""}`} role="search" onSubmit={handleSearch}>
          <Search size={18} aria-hidden="true" />
          <label className="sr-only" htmlFor="global-learning-search">
            Search lessons, games, and topics
          </label>
          <input
            id="global-learning-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search lessons, games, topics..."
            autoComplete="off"
          />
        </form>
      </div>

      <div className="lms-topbar__actions">
        {user ? (
          <>
            <div className="lms-notification-wrap">
              <button
                className="lms-icon-button"
                type="button"
                aria-label="Open notifications"
                aria-expanded={notificationsOpen}
                aria-controls="notification-panel"
                onClick={() => setNotificationsOpen((open) => !open)}
              >
                <Bell size={19} aria-hidden="true" />
              </button>

              {notificationsOpen && (
                <div id="notification-panel" className="lms-notification-panel" role="status">
                  <strong>Notifications</strong>
                  <p>You are all caught up. New school updates will appear here.</p>
                </div>
              )}
            </div>

            <Link className="lms-profile-chip" to={profileRoute} aria-label="Open profile">
              <ProfileAvatar
                uid={user.uid}
                name={profile?.name || user.email}
                size={34}
                decorative
              />
              <span>
                <strong>{profile?.name || user.email}</strong>
                <small>{profileSubtitle}</small>
              </span>
              <ChevronDown size={15} aria-hidden="true" />
            </Link>

            <button
              className="lms-signout-button"
              type="button"
              onClick={handleLogout}
              disabled={signingOut}
            >
              <LogOut size={17} aria-hidden="true" />
              <span>{signingOut ? "Signing out..." : "Sign out"}</span>
            </button>
          </>
        ) : (
          <Link className="lms-login-button" to="/login">
            <LogIn size={17} aria-hidden="true" />
            Login
          </Link>
        )}
      </div>
    </header>
  );
}
