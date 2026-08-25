import { BookOpen, Gamepad2, LoaderCircle, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import FeaturedLearningCard from "../components/FeaturedLearningCard";
import FilterBar from "../components/FilterBar";
import HomeGameCard from "../components/HomeGameCard";
import { GRADES } from "../data/catalog";
import { systemCatalogForGrade } from "../data/gradeExperience";
import { getPublishedCatalog } from "../services/dataService";

const BUILT_IN_GAMES = GRADES.flatMap((grade) => systemCatalogForGrade(grade));

function normalizedGrade(value) {
  const grade = String(value || "").trim();
  return /^grade\s/i.test(grade) ? grade : grade ? `Grade ${grade}` : "";
}

function uniqueCatalog(items) {
  const catalog = new Map();
  items.forEach((item) => {
    if (!item?.id || !["lesson", "game"].includes(item.type)) return;
    const key = `${item.type}:${item.id}`;
    if (!catalog.has(key)) catalog.set(key, item);
  });
  return [...catalog.values()];
}

export default function Library({ gamesOnly = false }) {
  const location = useLocation();
  const [items, setItems] = useState(BUILT_IN_GAMES);
  const [search, setSearch] = useState("");
  const [grade, setGrade] = useState("All Grades");
  const [subject, setSubject] = useState("All Subjects");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearch(params.get("search") || "");
  }, [location.search]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getPublishedCatalog()
      .then((publishedItems) => {
        if (active) setItems(uniqueCatalog(publishedItems));
      })
      .catch((loadError) => {
        if (!active) return;
        console.info("Published catalog is unavailable; showing built-in games.", loadError);
        setItems(BUILT_IN_GAMES);
        setError("Teacher-published activities are temporarily unavailable. Built-in games are still ready.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return items
      .filter((item) => {
        const searchText = [item.title, item.description, item.subject, item.competency]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return (
          (!gamesOnly || item.type === "game")
          && (grade === "All Grades" || normalizedGrade(item.grade) === grade)
          && (subject === "All Subjects" || item.subject === subject)
          && (!normalizedSearch || searchText.includes(normalizedSearch))
        );
      })
      .sort((first, second) => {
        if (first.type !== second.type) return first.type === "game" ? -1 : 1;
        const gradeOrder = normalizedGrade(first.grade).localeCompare(normalizedGrade(second.grade));
        if (gradeOrder !== 0) return gradeOrder;
        return String(first.title || "").localeCompare(String(second.title || ""));
      });
  }, [gamesOnly, grade, items, search, subject]);

  const gameCount = items.filter((item) => item.type === "game").length;
  const lessonCount = items.filter((item) => item.type === "lesson").length;

  return (
    <div className="home-v2 public-learning-library">
      <header className="public-learning-library__hero">
        <span className="public-learning-library__icon">{gamesOnly ? <Gamepad2 size={30} /> : <BookOpen size={30} />}</span>
        <div>
          <span>JIDANAO GRADE 3–6 LEARNING LIBRARY</span>
          <h1>{gamesOnly ? "Educational games" : "Learning library"}</h1>
          <p>{gamesOnly ? "Preview every available game, then sign in with a student account to play at the assigned grade level." : "Browse teacher-published lessons and professional learning games for Grades 3–6."}</p>
        </div>
        <div className="public-learning-library__stats">
          <strong>{gamesOnly ? gameCount : lessonCount + gameCount}</strong>
          <small>{gamesOnly ? "games available" : "activities available"}</small>
        </div>
      </header>

      {error && <div className="public-learning-library__notice"><ShieldCheck size={18} /><span>{error}</span></div>}

      <FilterBar search={search} setSearch={setSearch} grade={grade} setGrade={setGrade} subject={subject} setSubject={setSubject} />

      {loading ? (
        <div className="public-learning-library__loading"><LoaderCircle className="spin" size={30} /><strong>Loading available learning activities…</strong></div>
      ) : filtered.length ? gamesOnly ? (
        <div className="home-game-grid public-learning-library__games">
          {filtered.map((item) => <HomeGameCard key={`${item.type}-${item.id}`} item={item} />)}
        </div>
      ) : (
        <div className="home-feature-grid public-learning-library__content">
          {filtered.map((item) => <FeaturedLearningCard key={`${item.type}-${item.id}`} item={item} />)}
        </div>
      ) : (
        <div className="home-game-empty">
          {gamesOnly ? <Gamepad2 size={30} /> : <BookOpen size={30} />}
          <strong>No matching {gamesOnly ? "games" : "activities"} found.</strong>
          <p>Change the grade, subject, or search filters to see more content.</p>
        </div>
      )}
    </div>
  );
}
