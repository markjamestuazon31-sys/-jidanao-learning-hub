import { Component } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Jidanao Learning Hub crashed:", error, errorInfo);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="fatal-error-page">
        <section className="fatal-error-card">
          <AlertTriangle size={48} />
          <h1>The learning hub could not start</h1>
          <p>
            The application encountered an unexpected browser error. Open the
            browser console for technical details, then reload after correcting
            the configuration.
          </p>
          <pre>{this.state.error.message}</pre>
          <button
            className="primary-button"
            onClick={() => window.location.reload()}
          >
            <RotateCcw size={17} /> Reload application
          </button>
        </section>
      </main>
    );
  }
}
