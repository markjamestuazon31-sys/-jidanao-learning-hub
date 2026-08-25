import { Database, KeyRound, ShieldCheck } from "lucide-react";

export default function AdminSystem() {
  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <span className="admin-kicker">SYSTEM CONTROL</span>
          <h1>System settings</h1>
          <p>Production configuration summary for Jidanao Learning Hub.</p>
        </div>
      </header>
      <section className="admin-system-grid">
        <article className="admin-panel admin-system-card"><Database /><div><h2>Realtime Database</h2><p>Primary LMS data store. Firebase Storage is not used by this build.</p><span className="admin-status-pill active">Configured</span></div></article>
        <article className="admin-panel admin-system-card"><KeyRound /><div><h2>Firebase Authentication</h2><p>Single sign-in system for administrators, teachers, and students.</p><span className="admin-status-pill active">Required</span></div></article>
        <article className="admin-panel admin-system-card"><ShieldCheck /><div><h2>Role access</h2><p>Dashboard routes and Realtime Database writes are checked against role and status.</p><span className="admin-status-pill active">Protected</span></div></article>
      </section>
    </div>
  );
}
