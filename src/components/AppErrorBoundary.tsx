import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props { children: ReactNode }
interface State { error: Error | null }

/** Prevents a render crash from leaving users on a blank white screen. */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("App crashed:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <h1 className="text-2xl font-bold text-foreground">Something went wrong</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          The page failed to load. Reloading usually fixes it.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground"
        >
          Reload
        </button>
      </div>
    );
  }
}

export default AppErrorBoundary;
