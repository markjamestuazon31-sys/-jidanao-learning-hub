import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import TeacherPageGuide from "../components/TeacherPageGuide";
import { useAuth } from "../context/AuthContext";
import "../styles/home-ui.css";

const DASHBOARD_ROUTE = /^\/(student|teacher|admin)(\/|$)/;

export default function MainLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [teacherSidebarCollapsed, setTeacherSidebarCollapsed] = useState(() => (
    window.localStorage.getItem("jidanao-teacher-sidebar-collapsed") === "true"
  ));
  const [adminSidebarCollapsed, setAdminSidebarCollapsed] = useState(() => (
    window.localStorage.getItem("jidanao-admin-sidebar-collapsed") === "true"
  ));
  const { pathname } = useLocation();
  const { role } = useAuth();
  const isDashboardRoute = DASHBOARD_ROUTE.test(pathname);
  const isStandaloneLogin = pathname === "/login";

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    window.localStorage.setItem("jidanao-teacher-sidebar-collapsed", String(teacherSidebarCollapsed));
  }, [teacherSidebarCollapsed]);

  useEffect(() => {
    window.localStorage.setItem("jidanao-admin-sidebar-collapsed", String(adminSidebarCollapsed));
  }, [adminSidebarCollapsed]);

  const sidebarCollapsed = role === "teacher"
    ? teacherSidebarCollapsed
    : role === "admin" && adminSidebarCollapsed;

  function toggleSidebarCollapsed() {
    if (role === "teacher") setTeacherSidebarCollapsed((current) => !current);
    if (role === "admin") setAdminSidebarCollapsed((current) => !current);
  }

  if (isStandaloneLogin) {
    return (
      <div className="app-container auth-app-shell">
        <a className="lms-skip-link" href="#main-content">
          Skip to login
        </a>
        <main id="main-content" className="auth-content-area">
          <Outlet />
        </main>
      </div>
    );
  }

  // Public pages intentionally do not render the role dashboard sidebar.
  if (!isDashboardRoute) {
    return (
      <div className="app-container public-app-shell">
        <a className="lms-skip-link" href="#main-content">
          Skip to main content
        </a>
        <Navbar />
        <main id="main-content" className="content-area public-content-area">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className={`app-container dashboard-app-shell ${role ? `role-${role}-shell` : ""}`}>
      <a className="lms-skip-link" href="#main-content">
        Skip to main content
      </a>
      <Navbar onMenu={() => setMenuOpen(true)} />
      <div className={`main-wrapper dashboard-main-wrapper ${role === "teacher" && teacherSidebarCollapsed ? "teacher-sidebar-is-collapsed" : ""} ${role === "admin" && adminSidebarCollapsed ? "admin-sidebar-is-collapsed" : ""}`}>
        <Sidebar
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={toggleSidebarCollapsed}
        />
        <main id="main-content" className={`content-area dashboard-content-area ${role ? `role-${role}-content` : ""}`}>
          {role === "teacher" && <TeacherPageGuide />}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
