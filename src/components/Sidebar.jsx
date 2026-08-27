import {
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  Bot,
  Camera,
  CalendarCheck2,
  CircleAlert,
  ClipboardCheck,
  FileBarChart,
  Gamepad2,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  MonitorPlay,
  Rocket,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  UserRound,
  Users,
  ChevronLeft,
  ChevronRight,
  LogOut,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSchoolStructure } from "../context/SchoolStructureContext";
import { assignedClassOptions } from "../data/schoolClasses";
import { logout } from "../services/authService";

const MENUS = {
  student: {
    title: "Jidanao LearnSpace",
    subtitle: (profile) => [profile?.gradeLevel, profile?.section].filter(Boolean).join(" · ") || "Learner",
    icon: Rocket,
    items: [
      { name: "Dashboard", path: "/student/dashboard", icon: LayoutDashboard },
      { name: "Lessons", path: "/student/lessons", icon: BookOpen },
      { name: "Learning Games", path: "/student/games", icon: Gamepad2 },
      { name: "My Quizzes", path: "/student/quizzes", icon: ListChecks },
      { name: "Progress", path: "/student/progress", icon: BarChart3 },
      { name: "Achievements", path: "/student/achievements", icon: Award },
      { name: "Grades", path: "/student/grades", icon: ClipboardCheck },
      { name: "Profile", path: "/student/profile", icon: UserRound },
      { name: "Settings", path: "/student/settings", icon: Settings },
    ],
  },
  teacher: {
    title: "Teacher Workspace",
    subtitle: (profile) => profile?.name || "Faculty",
    icon: BookOpen,
    items: [
      { name: "Teacher Home", path: "/teacher/dashboard", icon: LayoutDashboard, group: "START" },
      { name: "Create Lessons & Games", path: "/teacher/content-studio", icon: Bot, group: "TEACH" },
      { name: "Camera Math & Reading", path: "/teacher/camera-content", icon: Camera, group: "TEACH" },
      { name: "Teacher Game Zone", path: "/teacher/game-zone", icon: MonitorPlay, group: "TEACH" },
      { name: "My Students", path: "/teacher/students", icon: Users, group: "MANAGE CLASS" },
      { name: "Take Attendance", path: "/teacher/attendance", icon: CalendarCheck2, group: "MANAGE CLASS" },
      { name: "Create & Check Quizzes", path: "/teacher/quizzes", icon: ListChecks, group: "ASSESS" },
      { name: "Record Grades", path: "/teacher/grades", icon: ClipboardCheck, group: "ASSESS" },
      { name: "View Reports", path: "/teacher/reports", icon: FileBarChart, group: "ASSESS" },
    ],
  },
  admin: {
    title: "Admin Control Center",
    subtitle: (profile) => profile?.name || "Administrator",
    icon: ShieldCheck,
    items: [
      { name: "Admin Home", path: "/admin/dashboard", icon: LayoutDashboard, group: "START" },
      { name: "Action Center", path: "/admin/operations", icon: CircleAlert, group: "START" },
      { name: "Teachers & Assignments", path: "/admin/teachers", icon: GraduationCap, group: "PEOPLE" },
      { name: "Students & Placement", path: "/admin/students", icon: Users, group: "PEOPLE" },
      { name: "Classes & Sections", path: "/admin/settings", icon: SlidersHorizontal, group: "SCHOOL" },
      { name: "Learning Content", path: "/admin/content", icon: BookOpen, group: "SCHOOL" },
      { name: "Analytics", path: "/admin/analytics", icon: BarChart3, group: "RECORDS" },
      { name: "Reports & Export", path: "/admin/reports", icon: FileBarChart, group: "RECORDS" },
      { name: "System Settings", path: "/admin/system", icon: Settings, group: "SYSTEM" },
    ],
  },
};

export default function Sidebar({ open, onClose, collapsed = false, onToggleCollapsed = null }) {
  const { role, profile } = useAuth();
  const { structure } = useSchoolStructure();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const teacherClasses = useMemo(
    () => role === "teacher" ? assignedClassOptions(profile, { includeAllSections: false, structure }) : [],
    [profile, role, structure],
  );
  const [selectedClassKey, setSelectedClassKey] = useState(() => window.localStorage.getItem("jidanao-teacher-active-class") || "");
  const menu = MENUS[role];

  if (!menu) return null;

  const activeTeacherClass = teacherClasses.find((item) => item.key === selectedClassKey) || teacherClasses[0] || null;

  function selectTeacherClass(event) {
    const classKey = event.target.value;
    setSelectedClassKey(classKey);
    window.localStorage.setItem("jidanao-teacher-active-class", classKey);
    window.dispatchEvent(new CustomEvent("jidanao:teacher-class-change", { detail: { classKey } }));
  }

  async function handleSignOut() {
    if (signingOut) return;
    try {
      setSigningOut(true);
      await logout();
      navigate("/", { replace: true });
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <>
      <aside className={`sidebar role-sidebar role-${role} ${open ? "open" : ""} ${role === "teacher" && collapsed ? "teacher-sidebar-collapsed" : ""} ${role === "admin" && collapsed ? "admin-sidebar-collapsed" : ""}`}>
        {(role === "teacher" || role === "admin") && (
          <button type="button" className={`${role}-sidebar-mobile-close`} onClick={onClose} aria-label={`Close ${role} navigation`}>
            <X size={20} />
          </button>
        )}
        {role === "student" ? (
          <div className="sidebar-identity student-sidebar-identity">
            <img src="/jidanao-seal.png" alt="Jidanao Elementary School seal" />
            <div>
              <strong>{menu.title}</strong>
              <small>{menu.subtitle(profile)}</small>
            </div>
            <span className="student-sidebar-identity__dots" aria-hidden="true" />
          </div>
        ) : role === "teacher" ? (
          <div className="teacher-sidebar-identity">
            <img src="/school-logo.jpg" alt="Jidanao Elementary School seal" />
            <div className="teacher-sidebar-identity-copy">
              <strong>Jidanao LearnSpace</strong>
              <small>Teacher Portal · {menu.subtitle(profile)}</small>
            </div>
            <button type="button" className="teacher-sidebar-toggle" onClick={onToggleCollapsed} aria-label={collapsed ? "Expand teacher sidebar" : "Collapse teacher sidebar"} aria-expanded={!collapsed}>
              {collapsed ? <ChevronRight size={21} /> : <ChevronLeft size={21} />}
            </button>
          </div>
        ) : role === "admin" ? (
          <div className="admin-sidebar-identity">
            <img src="/school-logo.jpg" alt="Jidanao Elementary School seal" />
            <div className="admin-sidebar-identity-copy">
              <strong>Jidanao LearnSpace</strong>
              <small>Administrator Portal</small>
            </div>
            <button type="button" className="admin-sidebar-toggle" onClick={onToggleCollapsed} aria-label={collapsed ? "Expand administrator sidebar" : "Collapse administrator sidebar"} aria-expanded={!collapsed}>
              {collapsed ? <ChevronRight size={21} /> : <ChevronLeft size={21} />}
            </button>
          </div>
        ) : null}

        {role === "teacher" && (
          <div className="teacher-sidebar-class">
            <label htmlFor="teacher-sidebar-class-select">Active class</label>
            {collapsed ? (
              <span title={activeTeacherClass?.label || "No assigned class"}>{activeTeacherClass ? `${activeTeacherClass.grade.replace("Grade ", "")}-${activeTeacherClass.section.replace(/^Section\s*/i, "")}` : "—"}</span>
            ) : (
              <select id="teacher-sidebar-class-select" value={activeTeacherClass?.key || ""} onChange={selectTeacherClass} disabled={!teacherClasses.length}>
                {!teacherClasses.length && <option value="">No assigned class</option>}
                {teacherClasses.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
              </select>
            )}
          </div>
        )}

        <div className={`sidebar-heading ${role === "student" ? "student-sidebar-heading" : ""}`}>
          {role === "student" && <Sparkles size={16} aria-hidden="true" />}
          <span>Navigation</span>
        </div>
        <nav className={role === "student" ? "student-sidebar-navigation" : undefined} aria-label={`${menu.title} navigation`}>
          {menu.items.map(({ name, path, icon: Icon, group }, index) => (
            <div className="sidebar-menu-row" key={path}>
              {(role === "teacher" || role === "admin") && group && menu.items[index - 1]?.group !== group && <span className={`${role}-sidebar-group`}>{group}</span>}
              <NavLink
                to={path}
                onClick={onClose}
                className={({ isActive }) => `menu-item ${isActive ? "active" : ""}`}
                title={(role === "teacher" || role === "admin") && collapsed ? name : undefined}
              >
                <Icon size={18} />
                <span>{name}</span>
              </NavLink>
            </div>
          ))}
        </nav>

        {role === "student" ? (
          <div className="student-sidebar-adventure">
            <div className="student-sidebar-adventure__art" aria-hidden="true">
              <span className="student-sidebar-star"><Star size={68} fill="currentColor" /></span>
              <Sparkles className="student-sidebar-sparkle student-sidebar-sparkle--one" size={16} />
              <Sparkles className="student-sidebar-sparkle student-sidebar-sparkle--two" size={12} />
            </div>
            <div className="student-sidebar-adventure__copy">
              <strong>Keep Learning! <span aria-hidden="true">🚀</span></strong>
              <p>Every lesson brings you closer to your goals.</p>
              <Link to="/student/lessons" onClick={onClose}>
                Let&apos;s Go! <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        ) : role === "teacher" ? (
          <div className="teacher-sidebar-footer">
            <div className="teacher-sidebar-inspiration">
              <img src="/school-logo.jpg" alt="" aria-hidden="true" />
              <div><strong>Jidanao Elementary School</strong><span>Create <b>•</b> Teach <b>•</b> Inspire</span></div>
            </div>
            <button type="button" onClick={handleSignOut} disabled={signingOut} title={collapsed ? "Sign out" : undefined}>
              <LogOut size={19} /><span>{signingOut ? "Signing out…" : "Sign out"}</span>
            </button>
          </div>
        ) : role === "admin" ? (
          <div className="admin-sidebar-footer">
            <div className="admin-sidebar-school">
              <img src="/school-logo.jpg" alt="" aria-hidden="true" />
              <div>
                <strong>Jidanao Elementary School</strong>
                <span>Inspire <b>•</b> Learn <b>•</b> Lead <b>•</b> Serve</span>
              </div>
            </div>
            <button type="button" onClick={handleSignOut} disabled={signingOut} title={collapsed ? "Sign out" : undefined}>
              <LogOut size={19} /><span>{signingOut ? "Signing out…" : "Sign out"}</span>
            </button>
          </div>
        ) : (
          <div className="sidebar-footer-note">
            <strong>Jidanao Learning Hub</strong>
            <span>Learn • Play • Achieve</span>
          </div>
        )}
      </aside>

      {open && (
        <button
          type="button"
          className="sidebar-overlay"
          onClick={onClose}
          aria-label="Close dashboard navigation"
        />
      )}
    </>
  );
}
