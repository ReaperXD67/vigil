import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Brand } from "./components/Brand";
import { Badge, Empty } from "./components/UI";
import { api, ago, type Service } from "./api";
type StatusData = {
  workspace_name: string;
  workspace_slug: string;
  is_demo: boolean;
  updated_at: string;
  services: Service[];
};
export default function PublicStatus() {
  const { slug } = useParams();
  const [data, setData] = useState<StatusData | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    try {
      setData(await api<StatusData>(`/public/status/${slug}`));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    document.title = "Service status — Vigil";
  }, [slug]);
  const allGood =
    data?.services.length &&
    data.services.every((s) => s.status === "operational");
  return (
    <div className="public-status">
      <header>
        <Brand />
        <Link to="/">
          Powered by Vigil <ArrowUpRight size={14} />
        </Link>
      </header>
      <main>
        <div className="status-heading">
          <div>
            <h1>{data ? `${data.workspace_name} status` : "Service status"}</h1>
            <p>A public view of the services shared by this workspace.</p>
          </div>
          <button
            className="icon-button"
            disabled={loading}
            onClick={load}
            aria-label="Refresh status"
          >
            <RefreshCw size={18} className={loading ? "spin" : ""} />
          </button>
        </div>
        {data?.is_demo && (
          <div className="demo-banner">
            Demo status page · All displayed measurements are sample data.
          </div>
        )}
        {error ? (
          <div className="error-banner" role="alert">
            <CircleAlert size={18} />
            {error}
          </div>
        ) : loading && !data ? (
          <div className="workspace-loading">
            <Loader2 className="spin" />
          </div>
        ) : (
          data && (
            <>
              <div
                className={`status-summary ${allGood ? "good" : "attention"}`}
              >
                {allGood ? <CheckCircle2 size={26} /> : <Activity size={26} />}
                <span>
                  {!data.services.length
                    ? "No public services yet"
                    : allGood
                      ? "All shared services operational"
                      : "Some services need attention"}
                  <small>Based on the latest retained checks</small>
                </span>
              </div>
              <section className="public-services">
                {data.services.map((s) => (
                  <article key={s.id}>
                    <div>
                      <h2>{s.name}</h2>
                      <p>{s.description}</p>
                    </div>
                    <Badge value={s.status} />
                    <div className="public-service-meta">
                      <span>Last check: {ago(s.last_checked)}</span>
                      <span>
                        {s.uptime === null
                          ? "No availability data"
                          : `${s.uptime.toFixed(2)}% retained availability`}
                      </span>
                    </div>
                  </article>
                ))}
                {!data.services.length && (
                  <Empty
                    title="Nothing shared just yet."
                    description="The owner can choose which services appear on this page."
                  />
                )}
              </section>
              <p className="status-footnote">
                This page refreshes on request. Availability is calculated from
                retained checks and is not an uptime guarantee.
              </p>
            </>
          )
        )}
      </main>
      <footer>
        <Brand />
        <span>Clarity, in the open.</span>
      </footer>
    </div>
  );
}
