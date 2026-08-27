import {
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  Bot,
  Camera,
  CalendarCheck2,
  ClipboardCheck,
  FileBarChart,
  Gamepad2,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  Rocket,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  UserRound,
  Users,
} from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

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
      { name: "Dashboard", path: "/teacher/dashboard", icon: LayoutDashboard },
      { name: "Learning Content Studio", path: "/teacher/content-studio", icon: Bot },
      { name: "Camera Math", path: "/teacher/camera-content", icon: Camera },
      { name: "Students", path: "/teacher/students", icon: Users },
      { name: "Attendance", path: "/teacher/attendance", icon: CalendarCheck2 },
      { name: "Quiz Bank", path: "/teacher/quizzes", icon: ListChecks },
      { name: "Gradebook", path: "/teacher/grades", icon: ClipboardCheck },
      { name: "Reports", path: "/teacher/reports", icon: FileBarChart },
    ],
  },
  admin: {
    title: "Admin Control Center",
    subtitle: (profile) => profile?.name || "Administrator",
    icon: ShieldCheck,
    items: [
      { name: "Overview", path: "/admin/dashboard", icon: LayoutDashboard },
      { name: "Teacher Accounts", path: "/admin/teachers", icon: GraduationCap },
      { name: "Student Accounts", path: "/admin/students", icon: Users },
      { name: "Learning Content", path: "/admin/content", icon: BookOpen },
      { name: "Engagement Analytics", path: "/admin/analytics", icon: BarChart3 },
      { name: "School Reports", path: "/admin/reports", icon: FileBarChart },
      { name: "Academic Settings", path: "/admin/settings", icon: SlidersHorizontal },
      { name: "System Settings", path: "/admin/system", icon: Settings },
    ],
  },
};

export default function Sidebar({ open, onClose }) {
  const { role, profile } = useAuth();
  const menu = MENUS[role];

  if (!menu) return null;

  const PortalIcon = menu.icon;

  return (
    <>
      <aside className={`sidebar role-sidebar role-${role} ${open ? "open" : ""}`}>
        {role === "student" ? (
          <div className="sidebar-identity student-sidebar-identity">
            <img src="/jidanao-seal.png" alt="Jidanao Elementary School seal" />
            <div>
              <strong>{menu.title}</strong>
              <small>{menu.subtitle(profile)}</small>
            </div>
            <span className="student-sidebar-identity__dots" aria-hidden="true" />
          </div>
        ) : (
          <div className="sidebar-identity">
            <span className="sidebar-identity-icon" aria-hidden="true">
              <PortalIcon size={20} />
            </span>
            <div>
              <strong>{menu.title}</strong>
              <small>{menu.subtitle(profile)}</small>
            </div>
          </div>
        )}

        <div className={`sidebar-heading ${role === "student" ? "student-sidebar-heading" : ""}`}>
          {role === "student" && <Sparkles size={16} aria-hidden="true" />}
          <span>Navigation</span>
        </div>
        <nav className={role === "student" ? "student-sidebar-navigation" : undefined} aria-label={`${menu.title} navigation`}>
          {menu.items.map(({ name, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              onClick={onClose}
              className={({ isActive }) => `menu-item ${isActive ? "active" : ""}`}
            >
              <Icon size={18} />
              <span>{name}</span>
            </NavLink>
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
