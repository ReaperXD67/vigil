import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowRight,
  CircleAlert,
  GitBranch,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  api,
  post,
  remove,
  ago,
  type Incident,
  type Service,
  type ServiceDependency,
} from "../api";
import { Badge, Empty, Modal } from "./UI";
import { dependencyLayout, downstreamImpact } from "./topologyGraph";
import "./Topology.css";

type Props = {
  services: Service[];
  incidents: Incident[];
  onAddService: () => void;
  onChanged: () => Promise<void>;
  notify: (message: string, error?: boolean) => void;
};

export default function Topology({
  services,
  incidents,
  onAddService,
  onChanged,
  notify,
}: Props) {
  const [edges, setEdges] = useState<ServiceDependency[] | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<ServiceDependency | null>(null);
  const [upstream, setUpstream] = useState("");
  const [dependent, setDependent] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const marker = `topology-arrow-${useId().replaceAll(":", "")}`;
  const viewport = useRef<HTMLDivElement>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await api<ServiceDependency[]>("/dependencies", {
        signal,
      });
      if (!signal?.aborted) {
        setEdges(result);
        setError("");
      }
    } catch (failure) {
      if (!signal?.aborted) setError((failure as Error).message);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, services]);
  useEffect(() => {
    if (!services.some((service) => service.id === selected)) {
      setSelected(
        (
          services.find((service) =>
            ["down", "degraded"].includes(service.status),
          ) ?? services[0]
        )?.id ?? "",
      );
    }
  }, [services, selected]);

  const ordered = useMemo(
    () => [...services].sort((a, b) => a.name.localeCompare(b.name)),
    [services],
  );
  const byId = useMemo(
    () => new Map(services.map((service) => [service.id, service])),
    [services],
  );
  const links = useMemo(
    () =>
      (edges ?? []).filter(
        (edge) => byId.has(edge.upstream_id) && byId.has(edge.service_id),
      ),
    [edges, byId],
  );
  const impact = useMemo(
    () =>
      downstreamImpact(
        ordered.map((service) => service.id),
        links,
        selected,
      ),
    [ordered, links, selected],
  );
  const affected = useMemo(
    () => new Set(impact.map((service) => service.id)),
    [impact],
  );
  const layout = useMemo(
    () =>
      dependencyLayout(
        ordered.map((service) => service.id),
        links,
      ),
    [ordered, links],
  );
  useEffect(() => {
    const point = layout.positions.get(selected),
      element = viewport.current;
    if (!point || !element) return;
    element.scrollTo({
      left: Math.max(0, point.x - (element.clientWidth - 208) / 2),
      top: Math.max(0, point.y - (element.clientHeight - 88) / 2),
      behavior: "auto",
    });
  }, [selected, layout]);
  const activeIncidents = incidents.filter(
    (incident) => incident.status !== "resolved",
  );
  const chosen = byId.get(selected);
  const direct = impact.filter((service) => service.hops === 1).length;
  const atRiskIncidents = activeIncidents.filter(
    (incident) => incident.service_id && affected.has(incident.service_id),
  );
  const latestSeverity = (serviceId: string) => {
    const rank = { critical: 3, major: 2, minor: 1 };
    return activeIncidents
      .filter((incident) => incident.service_id === serviceId)
      .sort((a, b) => rank[b.severity] - rank[a.severity])[0]?.severity;
  };

  function openAdd() {
    setUpstream(selected || ordered[0]?.id || "");
    setDependent(
      ordered.find((service) => service.id !== (selected || ordered[0]?.id))
        ?.id || "",
    );
    setFormError("");
    setAdding(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      const edge = await post<ServiceDependency>("/dependencies", {
        upstream_id: upstream,
        service_id: dependent,
      });
      setEdges((previous) => [...(previous ?? []), edge]);
      setAdding(false);
      setSelected(upstream);
      notify("Dependency added. Potential impact updated.");
      await onChanged();
    } catch (failure) {
      setFormError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteEdge() {
    if (!removing) return;
    setBusy(true);
    setFormError("");
    try {
      await remove(`/dependencies/${removing.id}`);
      setEdges((previous) =>
        (previous ?? []).filter((edge) => edge.id !== removing.id),
      );
      setRemoving(null);
      notify("Dependency removed.");
      await onChanged();
    } catch (failure) {
      setFormError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (edges === null && !error)
    return (
      <div className="workspace-loading">
        <Loader2 className="spin" />
        <span>Loading service dependencies…</span>
      </div>
    );

  return (
    <section
      className="topology"
      aria-label="Service dependencies and potential impact"
    >
      {error && (
        <div className="error-banner" role="alert">
          <CircleAlert size={18} />
          <span>{error}</span>
          <button onClick={() => void load()}>Try again</button>
        </div>
      )}
      {edges !== null && (
        <>
          <div className="topology-toolbar">
            <div>
              <GitBranch size={18} />
              <span>
                <strong>{services.length}</strong> services{" "}
                <span aria-hidden="true">/</span>{" "}
                <strong>{links.length}</strong> dependencies
              </span>
            </div>
            <button
              className="button secondary"
              onClick={openAdd}
              disabled={services.length < 2 || links.length >= 100}
            >
              <Plus size={16} />
              Add dependency
            </button>
          </div>
          {!services.length ? (
            <Empty
              title="Start with your services"
              description="Add at least two services, then describe which one depends on the other."
              action="Add service"
              onAction={onAddService}
            />
          ) : (
            <>
              <div className="topology-disclaimer">
                <CircleAlert size={15} />
                <p>
                  <strong>Potential impact, not a confirmed outage.</strong>{" "}
                  These paths follow dependencies you declare. They do not prove
                  that failures propagate or identify a root cause.
                </p>
              </div>
              <div className="topology-grid">
                <div className="topology-map-panel">
                  <div className="topology-panel-heading">
                    <div>
                      <h2>Service map</h2>
                      <p>
                        Upstream <ArrowRight size={13} /> dependent service
                      </p>
                    </div>
                    <button
                      className="icon-button"
                      aria-label="Refresh dependencies"
                      onClick={() => void load()}
                    >
                      <RefreshCw size={16} />
                    </button>
                  </div>
                  <div
                    className="topology-canvas-scroll"
                    ref={viewport}
                    tabIndex={0}
                    role="group"
                    aria-label="Scrollable dependency map. Select a service to show its downstream dependents."
                  >
                    <div
                      className="topology-canvas"
                      style={{ width: layout.width, height: layout.height }}
                    >
                      <svg
                        className="topology-lines"
                        width={layout.width}
                        height={layout.height}
                        aria-hidden="true"
                      >
                        <defs>
                          <marker
                            id={marker}
                            viewBox="0 0 10 10"
                            refX="9"
                            refY="5"
                            markerWidth="5"
                            markerHeight="5"
                            orient="auto-start-reverse"
                          >
                            <path
                              d="M 0 0 L 10 5 L 0 10 z"
                              fill="context-stroke"
                            />
                          </marker>
                        </defs>
                        {links.map((edge) => {
                          const start = layout.positions.get(edge.upstream_id)!,
                            end = layout.positions.get(edge.service_id)!;
                          const x1 = start.x + 208,
                            y1 = start.y + 44,
                            x2 = end.x - 7,
                            y2 = end.y + 44;
                          const active =
                            (edge.upstream_id === selected ||
                              affected.has(edge.upstream_id)) &&
                            affected.has(edge.service_id);
                          return (
                            <path
                              key={edge.id}
                              d={`M${x1},${y1} C${x1 + 32},${y1} ${x2 - 32},${y2} ${x2},${y2}`}
                              className={active ? "impact-path" : ""}
                              markerEnd={`url(#${marker})`}
                            />
                          );
                        })}
                      </svg>
                      {ordered.map((service) => {
                        const point = layout.positions.get(service.id)!;
                        const severity = latestSeverity(service.id);
                        return (
                          <button
                            key={service.id}
                            className={`topology-node ${service.id === selected ? "is-selected" : affected.has(service.id) ? "is-affected" : ""}`}
                            style={{ left: point.x, top: point.y }}
                            onClick={() => setSelected(service.id)}
                            aria-pressed={service.id === selected}
                            aria-label={`${service.name}, ${service.status}${severity ? `, ${severity} incident` : ""}. Show potential downstream impact.`}
                          >
                            <span className="topology-node-title">
                              <span>{service.name}</span>
                              {service.is_sample && <small>Sample</small>}
                            </span>
                            <span className="topology-node-meta">
                              <Badge value={service.status} />
                              {severity && (
                                <span
                                  className={`topology-severity ${severity}`}
                                >
                                  {severity} incident
                                </span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="topology-map-footer">
                    <span>
                      <i className="topology-key selected" />
                      Selected
                    </span>
                    <span>
                      <i className="topology-key affected" />
                      Potential downstream impact
                    </span>
                    <span>
                      Scroll to explore <ArrowRight size={12} />
                    </span>
                  </div>
                  {links.length === 0 && (
                    <p className="topology-empty-links">
                      Your services are not connected yet. Add a dependency to
                      explore possible downstream impact.
                    </p>
                  )}
                </div>
                <aside
                  className="topology-impact"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <span className="topology-eyebrow">
                    Potential blast radius
                  </span>
                  <h2>{chosen?.name ?? "Select a service"}</h2>
                  {chosen && (
                    <>
                      <div className="topology-impact-count">
                        <strong>{impact.length}</strong>
                        <span>
                          downstream service{impact.length === 1 ? "" : "s"}
                          <small>
                            {direct} direct · {impact.length - direct} indirect
                          </small>
                        </span>
                      </div>
                      <p className="topology-impact-context">
                        If this service is disrupted, these dependents may need
                        attention. Their current measured states appear below.
                      </p>
                      <div className="topology-selected-status">
                        <Badge value={chosen.status} />
                        <span>
                          {ago(chosen.last_checked)}
                          {chosen.is_sample ? " · Sample" : ""}
                        </span>
                      </div>
                      {impact.length ? (
                        <ul className="topology-impact-list">
                          {impact.map(({ id, hops }) => {
                            const service = byId.get(id)!;
                            return (
                              <li key={id}>
                                <button onClick={() => setSelected(id)}>
                                  <span>
                                    {service.name}
                                    <small>
                                      {hops === 1
                                        ? "Direct dependent"
                                        : `${hops} dependency hops`}
                                    </small>
                                  </span>
                                  <Badge value={service.status} />
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="topology-no-impact">
                          No downstream dependents are declared. This does not
                          guarantee the service has no consumers.
                        </p>
                      )}
                      {atRiskIncidents.length > 0 && (
                        <p className="topology-incident-note">
                          <CircleAlert size={14} />
                          {atRiskIncidents.length} active incident
                          {atRiskIncidents.length === 1 ? "" : "s"} already
                          recorded downstream.
                        </p>
                      )}
                    </>
                  )}
                </aside>
              </div>
              <section
                className="topology-connections"
                aria-label="Declared dependency list"
              >
                <div className="topology-panel-heading">
                  <div>
                    <h2>Declared dependencies</h2>
                    <p>
                      Private to your workspace. Removing a service also removes
                      its connections.
                    </p>
                  </div>
                  <span className="topology-connection-count">
                    {links.length} / 100
                  </span>
                </div>
                {links.length ? (
                  <ul>
                    {links.map((edge) => (
                      <li key={edge.id}>
                        <div>
                          <button onClick={() => setSelected(edge.upstream_id)}>
                            {byId.get(edge.upstream_id)!.name}
                          </button>
                          <ArrowRight
                            size={15}
                            aria-label="is an upstream dependency of"
                          />
                          <button onClick={() => setSelected(edge.service_id)}>
                            {byId.get(edge.service_id)!.name}
                          </button>
                          {edge.is_sample && <small>Sample</small>}
                        </div>
                        <button
                          className="icon-button"
                          aria-label={`Remove dependency from ${byId.get(edge.upstream_id)!.name} to ${byId.get(edge.service_id)!.name}`}
                          onClick={() => {
                            setFormError("");
                            setRemoving(edge);
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="topology-empty-links">
                    Dependencies are explicit relationships, not automatically
                    discovered connections.
                  </p>
                )}
              </section>
            </>
          )}
        </>
      )}
      <Modal
        title="Add a service dependency"
        description="Choose an upstream service and the service that depends on it. Arrows follow the direction of potential impact."
        open={adding}
        onClose={() => {
          if (!busy) setAdding(false);
        }}
      >
        <form className="editor-form" onSubmit={save}>
          <label>
            Upstream service
            <select
              required
              value={upstream}
              onChange={(event) => setUpstream(event.target.value)}
            >
              {ordered.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
          </label>
          <div className="topology-form-arrow">
            <ArrowRight size={16} /> provides a dependency for
          </div>
          <label>
            Dependent service
            <select
              required
              value={dependent}
              onChange={(event) => setDependent(event.target.value)}
            >
              {ordered.map((service) => (
                <option
                  key={service.id}
                  value={service.id}
                  disabled={service.id === upstream}
                >
                  {service.name}
                </option>
              ))}
            </select>
          </label>
          <p className="topology-form-note">
            Self-dependencies, duplicates, and cycles are rejected. This
            relationship does not change either service’s measured status.
          </p>
          {upstream === dependent && (
            <p className="form-error" role="alert">
              Choose two different services.
            </p>
          )}
          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}
          <div className="dialog-actions">
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => setAdding(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button primary"
              disabled={
                busy || !upstream || !dependent || upstream === dependent
              }
            >
              {busy && <Loader2 size={15} className="spin" />}
              {busy ? "Saving…" : "Add dependency"}
            </button>
          </div>
        </form>
      </Modal>
      <Modal
        title="Remove this dependency?"
        description="Only the declared relationship is removed. Both services and their check history remain."
        open={!!removing}
        onClose={() => {
          if (!busy) setRemoving(null);
        }}
      >
        {removing && (
          <div className="topology-remove-summary">
            {byId.get(removing.upstream_id)?.name ?? "Upstream service"}
            <ArrowRight size={16} />
            {byId.get(removing.service_id)?.name ?? "Dependent service"}
          </div>
        )}
        {formError && (
          <p className="form-error" role="alert">
            {formError}
          </p>
        )}
        <div className="dialog-actions">
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => setRemoving(null)}
          >
            Cancel
          </button>
          <button
            className="button primary"
            disabled={busy}
            onClick={() => void deleteEdge()}
          >
            {busy ? (
              <Loader2 size={15} className="spin" />
            ) : (
              <Trash2 size={15} />
            )}
            Remove dependency
          </button>
        </div>
      </Modal>
    </section>
  );
}
