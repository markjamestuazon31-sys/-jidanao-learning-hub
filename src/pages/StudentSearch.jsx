import { BookOpenCheck, Gamepad2, LoaderCircle, Search, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import StudentLearningCard from "../components/student/StudentLearningCard";
import { useAuth } from "../context/AuthContext";
import { getGradeExperience } from "../data/gradeExperience";
import {
  normalizeProgress,
  subscribePublishedCatalogForGrade,
  subscribeUserProgress,
} from "../services/dataService";

export default function StudentSearch() {
  const { user, profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [progress, setProgress] = useState(() => normalizeProgress({}));
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const experience = getGradeExperience(profile?.gradeLevel);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setQuery(params.get("search") || "");
  }, [location.search]);

  useEffect(() => {
    if (!profile?.gradeLevel) return undefined;
    setLoading(true);
    setError("");
    return subscribePublishedCatalogForGrade(
      profile.gradeLevel,
      (catalog) => {
        setItems(catalog);
        setLoading(false);
      },
      (loadError) => {
        setError(loadError.message || "Unable to search your learning library.");
        setLoading(false);
      },
      profile.section,
    );
  }, [profile?.gradeLevel, profile?.section]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    return subscribeUserProgress(user.uid, setProgress, () => {});
  }, [user?.uid]);

  const visibleItems = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return items.filter((item) => {
      const typeMatches = type === "all" || item.type === type;
      const text = [item.title, item.description, item.subject, item.competency]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();
      return typeMatches && (!term || text.includes(term));
    });
  }, [items, query, type]);

  function submitSearch(event) {
    event.preventDefault();
    const term = query.trim();
    navigate(term ? `/student/search?search=${encodeURIComponent(term)}` : "/student/search", { replace: true });
  }

  return (
    <div className={`student-portal student-catalog-page student-theme--${experience.theme}`}>
      <header className="student-page-hero student-search-hero">
        <div className="student-page-hero__icon"><Search size={30} /></div>
        <div>
          <span>{profile?.gradeLevel} PROTECTED SEARCH</span>
          <h1>Search your learning library</h1>
          <p>Find only the lessons and games published for your authenticated grade profile.</p>
        </div>
        <div className="student-page-hero__tools student-search-verified">
          <ShieldCheck size={22} />
          <strong>Grade scoped</strong>
          <small>secure catalog</small>
        </div>
      </header>

      <form className="student-secure-search" role="search" onSubmit={submitSearch}>
        <Search size={20} />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search ${profile?.gradeLevel} lessons, games, skills, or subjects…`}
          aria-label="Search your grade learning library"
        />
        <button type="submit">Search</button>
      </form>

      <section className="student-library-summary" aria-label="Search content type">
        <button type="button" className={type === "all" ? "is-active" : ""} onClick={() => setType("all")}>
          <span>All results</span><strong>{items.length}</strong>
        </button>
        <button type="button" className={type === "lesson" ? "is-active" : ""} onClick={() => setType("lesson")}>
          <span>Lessons</span><strong>{items.filter((item) => item.type === "lesson").length}</strong>
        </button>
        <button type="button" className={type === "game" ? "is-active" : ""} onClick={() => setType("game")}>
          <span>Games</span><strong>{items.filter((item) => item.type === "game").length}</strong>
        </button>
      </section>

      {loading ? (
        <div className="student-state-card"><LoaderCircle className="spin" size={30} /><div><strong>Searching your protected library…</strong><p>Loading published {profile?.gradeLevel} learning metadata.</p></div></div>
      ) : error ? (
        <div className="student-state-card student-state-card--error"><ShieldCheck size={30} /><div><strong>Search is temporarily unavailable.</strong><p>{error}</p></div></div>
      ) : visibleItems.length ? (
        <div className="student-learning-grid-v2 student-learning-grid-v2--catalog">
          {visibleItems.map((item) => <StudentLearningCard key={`${item.type}-${item.id}`} item={item} progress={progress} />)}
        </div>
      ) : (
        <div className="student-state-card student-state-card--empty">
          {type === "game" ? <Gamepad2 size={30} /> : <BookOpenCheck size={30} />}
          <div><strong>No matching activities found.</strong><p>Try another keyword. Your search remains limited to published {profile?.gradeLevel} content.</p></div>
        </div>
      )}
    </div>
  );
}
