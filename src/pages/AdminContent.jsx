import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  BookOpen,
  CheckCircle2,
  Database,
  Gamepad2,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import {
  getAllLearningContent,
  getPublishedCatalogHealth,
  syncPublishedCatalog,
  updateContentStatus,
} from "../services/dataService";

export default function AdminContent() {
  const [content, setContent] = useState([]);
  const [catalogHealth, setCatalogHealth] = useState({ catalogCount: 0, publishedSourceCount: 0, needsSync: false });
  const [search, setSearch] = useState("");
  const [type, setType] = useState("All Types");
  const [status, setStatus] = useState("All Statuses");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  const loadContent = useCallback(async () => {
    setLoading(true);
    try {
      const [items, health] = await Promise.all([
        getAllLearningContent(),
        getPublishedCatalogHealth(),
      ]);
      setContent(items.sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0)));
      setCatalogHealth(health);
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Unable to load learning content.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return content.filter((item) => {
      const matchesSearch = !term || [item.title, item.subject, item.grade, item.gradeLevel, item.section]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
      const matchesType = type === "All Types" || item.type === type.toLowerCase();
      const matchesStatus = status === "All Statuses" || item.status === status.toLowerCase();
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [content, search, type, status]);

  async function changeStatus(item, nextStatus) {
    setMessage("");
    try {
      await updateContentStatus(item.type, item.id, nextStatus);
      setMessageType("success");
      setMessage(`${item.title || "Content"} is now ${nextStatus}. The student grade catalog was updated automatically.`);
      await loadContent();
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Unable to update content status.");
    }
  }

  async function syncCatalog() {
    setSyncing(true);
    setMessage("");
    try {
      const result = await syncPublishedCatalog();
      setMessageType("success");
      setMessage(`Student catalog synchronized: ${result.publishedCount} published item${result.publishedCount === 1 ? "" : "s"} available by grade${result.skippedCount ? `; ${result.skippedCount} item(s) skipped because the grade was invalid` : ""}.`);
      await loadContent();
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Unable to synchronize the student catalog. Publish the included database rules first.");
    } finally {
      setSyncing(false);
    }
  }

  const summary = {
    lessons: content.filter((item) => item.type === "lesson").length,
    games: content.filter((item) => item.type === "game").length,
    published: content.filter((item) => item.status === "published").length,
    drafts: content.filter((item) => item.status === "draft").length,
  };

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <span className="admin-kicker">CONTENT GOVERNANCE</span>
          <h1>Learning content</h1>
          <p>Review lessons and games, control publication, and synchronize grade-specific student libraries.</p>
        </div>
        <div className="admin-header-actions">
          <button type="button" className="admin-button secondary" onClick={loadContent} disabled={loading || syncing}>
            <RefreshCw size={17} className={loading ? "spin" : ""} /> Refresh
          </button>
          <button type="button" className="admin-button primary" onClick={syncCatalog} disabled={loading || syncing}>
            {syncing ? <RefreshCw size={17} className="spin" /> : <Database size={17} />} {syncing ? "Syncing…" : "Sync student catalog"}
          </button>
        </div>
      </header>

      {message && <div className={`alert ${messageType} admin-alert`}>{message}</div>}

      <section className={`admin-catalog-health ${catalogHealth.needsSync ? "needs-sync" : "is-healthy"}`}>
        <span>{catalogHealth.needsSync ? <RefreshCw size={22} /> : <ShieldCheck size={22} />}</span>
        <div>
          <strong>{catalogHealth.needsSync ? "Student catalog needs synchronization" : "Student catalog is synchronized"}</strong>
          <p>
            Source has {catalogHealth.publishedSourceCount} published item{catalogHealth.publishedSourceCount === 1 ? "" : "s"}; the grade catalog has {catalogHealth.catalogCount}. Student pages read the grade catalog and no longer use the failing status-index query.
          </p>
        </div>
        {catalogHealth.needsSync && <button type="button" onClick={syncCatalog} disabled={syncing}>Synchronize now</button>}
      </section>

      <section className="admin-mini-metric-grid">
        <article><BookOpen size={19} /><div><strong>{summary.lessons}</strong><span>Lessons</span></div></article>
        <article><Gamepad2 size={19} /><div><strong>{summary.games}</strong><span>Games</span></div></article>
        <article><CheckCircle2 size={19} /><div><strong>{summary.published}</strong><span>Published</span></div></article>
        <article><Archive size={19} /><div><strong>{summary.drafts}</strong><span>Drafts</span></div></article>
      </section>

      <section className="admin-panel">
        <div className="admin-filter-row">
          <label className="admin-search-box">
            <Search size={17} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, subject, grade…" />
          </label>
          <select value={type} onChange={(event) => setType(event.target.value)}>
            <option>All Types</option><option>Lesson</option><option>Game</option>
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option>All Statuses</option><option>Published</option><option>Draft</option><option>Archived</option>
          </select>
        </div>

        <div className="admin-responsive-table">
          <table>
            <thead><tr><th>Content</th><th>Grade</th><th>Subject</th><th>Status</th><th>Publication control</th></tr></thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={`${item.type}-${item.id}`}>
                  <td><div className="admin-table-person"><span className={`admin-avatar ${item.type}`}>{item.type === "game" ? <Gamepad2 size={17} /> : <BookOpen size={17} />}</span><div><strong>{item.title || "Untitled content"}</strong><small>{item.type === "game" ? "Educational game" : "Learning lesson"}</small></div></div></td>
                  <td>{item.grade || item.gradeLevel || "—"}<small>{item.section || "All Sections"}</small></td>
                  <td>{item.subject || "—"}</td>
                  <td><span className={`admin-status-pill ${item.status || "draft"}`}>{item.status || "draft"}</span></td>
                  <td><select className="admin-table-select" value={item.status || "draft"} onChange={(event) => changeStatus(item, event.target.value)}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length === 0 && <div className="admin-empty-state">No learning content matches the selected filters.</div>}
      </section>
    </div>
  );
}
