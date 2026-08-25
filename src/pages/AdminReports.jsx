import { useCallback, useEffect, useState } from "react";
import { BookOpenCheck, CheckCircle2, Download, FileBarChart, FileText, RefreshCw, ShieldCheck, UsersRound } from "lucide-react";
import { getAdminOverview } from "../services/dataService";
import {
  exportAccountDirectoryWordReport,
  exportGradeEngagementWordReport,
  exportLearningContentWordReport,
} from "../utils/adminWordReports";
import "../styles/admin-reports-redesign.css";

export default function AdminReports() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setOverview(await getAdminOverview());
    } catch (loadError) {
      setError(loadError.message || "Unable to prepare reports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function exportReport(reportId, exporter) {
    if (!overview || exporting) return;
    setExporting(reportId);
    setError("");
    try {
      await exporter(overview);
    } catch (exportError) {
      setError(exportError.message || "Unable to generate the Microsoft Word report.");
    } finally {
      setExporting("");
    }
  }

  return (
    <div className="admin-page admin-reports-page">
      <header className="admin-page-header admin-reports-header">
        <div className="admin-reports-header-copy">
          <span className="admin-kicker">REPORT CENTER</span>
          <h1>Professional School Reports</h1>
          <p>Generate complete, readable Microsoft Word documents for school review, printing, signatures, and official documentation.</p>
          <div className="admin-reports-header-tags"><span><FileText size={15} /> Microsoft Word</span><span><ShieldCheck size={15} /> Protected school records</span></div>
        </div>
        <img className="admin-reports-header-seal" src="/school-logo.jpg" alt="" aria-hidden="true" />
        <button type="button" className="admin-button secondary" onClick={load} disabled={loading}>
          <RefreshCw size={18} className={loading ? "spin" : ""} /> Refresh reports
        </button>
      </header>

      {error && <div className="alert error admin-alert">{error}</div>}

      <section className="admin-reports-guide">
        <span><CheckCircle2 /></span>
        <div><strong>Choose a report below</strong><p>Each download includes the Jidanao school heading, generation date, summary totals, formatted records, privacy note, and signature lines.</p></div>
      </section>

      <section className="admin-report-grid admin-word-report-grid">
        <article className="admin-report-card admin-word-report-card">
          <div className="admin-word-report-card-heading"><span className="admin-report-icon grade"><FileBarChart /></span><span className="admin-word-badge"><FileText size={14} /> Word document</span></div>
          <div><h2>Grade Engagement Report</h2><p>Compare students, game participation, games touched, lesson completions, and activity per learner across grade levels.</p></div>
          <ul><li>Grade-level summary statistics</li><li>Professional engagement table</li><li>Administrative interpretation</li></ul>
          <button type="button" className="admin-button primary" onClick={() => void exportReport("grade", exportGradeEngagementWordReport)} disabled={!overview || Boolean(exporting)}>
            <Download size={18} /> {exporting === "grade" ? "Preparing Word report…" : "Download Word report"}
          </button>
        </article>
        <article className="admin-report-card admin-word-report-card">
          <div className="admin-word-report-card-heading"><span className="admin-report-icon accounts"><UsersRound /></span><span className="admin-word-badge"><FileText size={14} /> Word document</span></div>
          <div><h2>Account Directory Report</h2><p>Review administrator, teacher, and student profiles with Grade, Section, employee ID, account status, and creation date.</p></div>
          <ul><li>Role and account totals</li><li>Grade-and-Section placement</li><li>Authorized-use privacy notice</li></ul>
          <button type="button" className="admin-button primary" onClick={() => void exportReport("accounts", exportAccountDirectoryWordReport)} disabled={!overview || Boolean(exporting)}>
            <Download size={18} /> {exporting === "accounts" ? "Preparing Word report…" : "Download Word report"}
          </button>
        </article>
        <article className="admin-report-card admin-word-report-card">
          <div className="admin-word-report-card-heading"><span className="admin-report-icon content"><BookOpenCheck /></span><span className="admin-word-badge"><FileText size={14} /> Word document</span></div>
          <div><h2>Learning Content Report</h2><p>Document lessons and games by Grade, Section, subject, publication status, assigned teacher, and last update.</p></div>
          <ul><li>Lesson and game totals</li><li>Published and draft status</li><li>Teacher ownership details</li></ul>
          <button type="button" className="admin-button primary" onClick={() => void exportReport("content", exportLearningContentWordReport)} disabled={!overview || Boolean(exporting)}>
            <Download size={18} /> {exporting === "content" ? "Preparing Word report…" : "Download Word report"}
          </button>
        </article>
      </section>

      <footer className="admin-reports-privacy"><ShieldCheck size={18} /><span><strong>Safe administrative export</strong> Word reports do not include passwords, authentication credentials, webcam frames, or biometric data.</span></footer>
    </div>
  );
}
