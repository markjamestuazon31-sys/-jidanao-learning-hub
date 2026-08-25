export default function StartupError({ error }) {
  return (
    <main className="fatal-error-page" role="alert">
      <section className="fatal-error-card">
        <img
          className="startup-error-logo"
          src="/school-logo.jpg"
          alt="Jidanao Elementary School logo"
        />
        <p className="eyebrow dark">STARTUP DIAGNOSTIC</p>
        <h1>The learning hub could not start</h1>
        <p>
          The browser stopped while loading an application module. The message
          below identifies the problem instead of leaving a blank white page.
        </p>
        <pre>{error?.message || String(error)}</pre>
        <button
          type="button"
          className="primary-button"
          onClick={() => window.location.reload()}
        >
          Reload application
        </button>
      </section>
    </main>
  );
}
