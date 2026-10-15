import { lazy, Suspense, useEffect, useState } from "react";
import {
  Navigate,
  Route,
  Routes,
  useNavigate,
  useLocation,
  Link,
  useSearchParams,
} from "react-router-dom";
import { ArrowLeft, ArrowUpRight, Loader2 } from "lucide-react";
const Landing = lazy(() => import("./Landing"));
import { Brand } from "./components/Brand";
import { api, post, type User } from "./api";
const Workspace = lazy(() => import("./Workspace"));
const PublicStatus = lazy(() => import("./PublicStatus"));
let pendingSession: Promise<{ user: User }> | null = null;
function workspaceSession(demo: boolean) {
  if (!pendingSession) {
    pendingSession = api<{ user: User }>("/auth/me")
      .catch((error) => {
        if (error.status === 401 && demo)
          return post<{ user: User }>("/auth/demo");
        throw error;
      })
      .finally(() => {
        pendingSession = null;
      });
  }
  return pendingSession;
}

function Login() {
  const [params] = useSearchParams();
  const [register, setRegister] = useState(params.get("mode") === "register");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    document.title = register
      ? "Create your Vigil workspace"
      : "Sign in — Vigil";
  }, [register]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await post<{ user: User }>(
        register ? "/auth/register" : "/auth/login",
        data,
      );
      navigate("/app");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <Brand />
      <Link to="/" className="back-link">
        <ArrowLeft size={15} /> Back to home
      </Link>
      <div className="auth-layout">
        <div className="auth-statement">
          <span className="signal-dot" />
          <h1>
            A clearer view.
            <br />
            <span>A calmer response.</span>
          </h1>
          <p>
            Your services, incidents, and recovery work.
            <br />
            All connected.
          </p>
          <div className="auth-orbit" aria-hidden="true" />
        </div>
        <section className="auth-form">
          <h2>{register ? "Make room for reliability." : "Welcome back."}</h2>
          <p>
            {register
              ? "Create your private Vigil workspace."
              : "Your workspace is right where you left it."}
          </p>
          <form onSubmit={submit}>
            {register && (
              <label>
                Your name
                <input
                  name="name"
                  autoComplete="name"
                  maxLength={80}
                  required
                  placeholder="Alex Chen"
                />
              </label>
            )}
            <label>
              Email
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete={register ? "new-password" : "current-password"}
                required
                minLength={register ? 12 : 1}
                maxLength={128}
                placeholder={
                  register ? "At least 12 characters" : "Your password"
                }
              />
            </label>
            {register && (
              <p className="form-hint">
                Use a unique password of at least 12 characters. Email
                verification and password recovery are not yet available.
              </p>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="button primary full-width" disabled={busy}>
              {busy ? (
                <Loader2 className="spin" size={17} />
              ) : (
                <>
                  {register ? "Create workspace" : "Sign in"}
                  <ArrowUpRight size={17} />
                </>
              )}
            </button>
          </form>
          <p className="auth-switch">
            {register ? "Already have a workspace?" : "New to Vigil?"}{" "}
            <button
              onClick={() => {
                setRegister(!register);
                setError("");
              }}
            >
              {register ? "Sign in" : "Create an account"}
            </button>
          </p>
          <div className="auth-divider">
            <span>or take a look around</span>
          </div>
          <Link className="button secondary full-width" to="/app?demo=1">
            Explore an isolated demo <ArrowUpRight size={17} />
          </Link>
          <p className="form-hint centered">
            Demo data is separate from every other workspace.
          </p>
        </section>
      </div>
    </main>
  );
}
function ProtectedWorkspace() {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const route = useLocation();
  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        let result;
        try {
          result = await workspaceSession(params.get("demo") === "1");
        } catch (error) {
          if ((error as { status: number }).status === 401) {
            if (active) navigate("/login", { replace: true });
            return;
          }
          throw error;
        }
        if (active) {
          setUser(result.user);
          if (params.has("demo")) {
            const remaining = new URLSearchParams(params);
            remaining.delete("demo");
            navigate(
              {
                pathname: route.pathname,
                search: remaining.toString(),
                hash: route.hash,
              },
              { replace: true },
            );
          }
        }
      } catch (e) {
        if (active) setError((e as Error).message);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, []);
  if (error)
    return (
      <div className="page-loader">
        <Brand />
        <h2>We couldn’t open your workspace.</h2>
        <p role="alert">{error}</p>
        <button className="button primary" onClick={() => location.reload()}>
          Try again
        </button>
        <Link to="/">Back to home</Link>
      </div>
    );
  return user ? (
    <Workspace user={user} />
  ) : (
    <div className="page-loader">
      <Brand />
      <Loader2 className="spin" />
      <p>Getting your workspace ready…</p>
    </div>
  );
}
export default function App() {
  return (
    <Suspense
      fallback={
        <div className="page-loader">
          <Brand />
          <Loader2 className="spin" />
          <p>Opening Vigil…</p>
        </div>
      }
    >
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/app/*" element={<ProtectedWorkspace />} />
        <Route path="/status/:slug" element={<PublicStatus />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
