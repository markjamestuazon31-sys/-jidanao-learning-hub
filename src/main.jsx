import React from "react";
import ReactDOM from "react-dom/client";
import AppErrorBoundary from "./components/AppErrorBoundary";
import StartupError from "./components/StartupError";
import "./styles/global.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error('The application root element with id="root" was not found.');
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <main className="startup-loading" aria-live="polite">
    Loading Jidanao Learning Hub…
  </main>,
);

import("./App.jsx")
  .then(({ default: App }) => {
    root.render(
      <React.StrictMode>
        <AppErrorBoundary>
          <App />
        </AppErrorBoundary>
      </React.StrictMode>,
    );
  })
  .catch((error) => {
    console.error("Jidanao Learning Hub startup failed:", error);
    root.render(<StartupError error={error} />);
  });
