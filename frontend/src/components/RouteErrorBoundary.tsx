import { Component, useEffect, useRef, type ReactNode } from "react";
import { Brand } from "./Brand";
import "./RouteErrorBoundary.css";

function RouteRecovery() {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    document.title = "Reload this page — Vigil";
    heading.current?.focus();
  }, []);

  return (
    <main
      className="page-loader route-recovery"
      aria-labelledby="route-recovery-title"
    >
      <Brand />
      <h1 id="route-recovery-title" ref={heading} tabIndex={-1}>
        This page couldn’t open.
      </h1>
      <p>
        The app may have updated, or something interrupted this page. Reload to
        try again. Any unsaved edits on this page may need to be entered again.
      </p>
      <div className="route-recovery-actions">
        <button
          type="button"
          className="button primary"
          onClick={() => window.location.reload()}
        >
          Reload page
        </button>
        {/* Full navigation also clears a rejected lazy import cached by React. */}
        <a className="button secondary" href="/">
          Back home
        </a>
      </div>
    </main>
  );
}

export default class RouteErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? <RouteRecovery /> : this.props.children;
  }
}
