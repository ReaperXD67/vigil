import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  Activity,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check as CheckIcon,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  Command,
  ExternalLink,
  Globe2,
  LayoutDashboard,
  ListTodo,
  Loader2,
  LogOut,
  Menu,
  MoreHorizontal,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { Brand, Github } from "./components/Brand";
import { Badge, Empty, Modal, Submit } from "./components/UI";
import {
  api,
  post,
  patch,
  remove,
  download,
  ago,
  label,
  type User,
  type Service,
  type Incident,
  type Task,
  type Stats,
  type ActivityEntry,
  type Check,
} from "./api";

type Editor =
  | { kind: "service"; value?: Service }
  | { kind: "incident"; value?: Incident }
  | { kind: "task"; value?: Task; status?: Task["status"] }
  | null;
const navItems = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "services", label: "Services", icon: Radio },
  { id: "incidents", label: "Incidents", icon: CircleAlert },
  { id: "tasks", label: "Recovery tasks", icon: ListTodo },
  { id: "activity", label: "Activity", icon: Activity },
];
const statusOptions = ["investigating", "identified", "monitoring", "resolved"];
const taskStates = ["todo", "in_progress", "done"] as const;
const taskLabels = {
  todo: "To do",
  in_progress: "In progress",
  done: "Completed",
};
const emptyStats: Stats = {
  total_services: 0,
  operational_services: 0,
  active_incidents: 0,
  open_tasks: 0,
  uptime: null,
  average_latency_ms: null,
  total_checks: 0,
  is_demo: false,
};
function dateTime(s: string) {
  return new Date(s).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function Workspace({ user }: { user: User }) {
  const location = useLocation(),
    navigate = useNavigate();
  const section = location.pathname.split("/")[2] || "overview";
  const [services, setServices] = useState<Service[]>([]),
    [incidents, setIncidents] = useState<Incident[]>([]),
    [tasks, setTasks] = useState<Task[]>([]),
    [activity, setActivity] = useState<ActivityEntry[]>([]),
    [stats, setStats] = useState<Stats>(emptyStats);
  const [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(""),
    [refreshing, setRefreshing] = useState(false),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all");
  const [editor, setEditor] = useState<Editor>(null),
    [detail, setDetail] = useState<Incident | null>(null),
    [serviceDetail, setServiceDetail] = useState<Service | null>(null),
    [checks, setChecks] = useState<Check[]>([]),
    [checksLoading, setChecksLoading] = useState(false);
  const [busy, setBusy] = useState(false),
    [formError, setFormError] = useState(""),
    [checking, setChecking] = useState<string | null>(null),
    [toast, setToast] = useState<{ message: string; error?: boolean } | null>(
      null,
    ),
    [mobile, setMobile] = useState(false),
    [command, setCommand] = useState(false),
    [commandQuery, setCommandQuery] = useState("");
  const [confirm, setConfirm] = useState<{
    kind: string;
    id: string;
    name: string;
  } | null>(null);
  const notify = useCallback(
    (message: string, error = false) => setToast({ message, error }),
    [],
  );
  const reload = useCallback(async () => {
    setRefreshing(true);
    try {
      const [s, i, t, a, st] = await Promise.all([
        api<Service[]>("/services"),
        api<Incident[]>("/incidents"),
        api<Task[]>("/tasks"),
        api<ActivityEntry[]>("/activity?limit=60"),
        api<Stats>("/stats"),
      ]);
      setServices(s);
      setIncidents(i);
      setTasks(t);
      setActivity(a);
      setStats(st);
      setLoadError("");
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  useEffect(() => {
    document.title = `${section === "tasks" ? "Recovery tasks" : label(section)} — Vigil`;
    setSearch("");
    setFilter("all");
    setMobile(false);
  }, [section]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommand((v) => !v);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    setFormError("");
  }, [editor, detail, serviceDetail]);
  const matches = (text: string) =>
    text.toLowerCase().includes(search.toLowerCase());
  const filteredServices = services.filter(
    (s) =>
      matches(s.name + " " + s.url) &&
      (filter === "all" || s.status === filter),
  );
  const filteredIncidents = incidents.filter(
    (i) =>
      matches(i.title + " " + i.description) &&
      (filter === "all" ||
        (filter === "active" ? i.status !== "resolved" : i.status === filter)),
  );
  const filteredTasks = tasks.filter(
    (t) =>
      matches(t.title + " " + t.description) &&
      (filter === "all" || t.priority === filter),
  );
  const openIncidents = incidents.filter((i) => i.status !== "resolved");
  const title =
    section === "overview"
      ? "The whole picture."
      : section === "services"
        ? "Keep your services in sight."
        : section === "incidents"
          ? "A clear path to resolution."
          : section === "tasks"
            ? "Close every loose end."
            : section === "activity"
              ? "Your workspace, in motion."
              : "Make it yours.";

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    setBusy(true);
    setFormError("");
    const data: Record<string, unknown> = Object.fromEntries(
      new FormData(event.currentTarget),
    );
    if (editor.kind === "service") data.is_public = data.is_public === "on";
    if ("service_id" in data && !data.service_id) data.service_id = null;
    if ("incident_id" in data && !data.incident_id) data.incident_id = null;
    try {
      const path = `/${editor.kind}s${editor.value ? `/${editor.value.id}` : ""}`;
      await (editor.value ? patch(path, data) : post(path, data));
      notify(`${label(editor.kind)} ${editor.value ? "updated" : "created"}.`);
      setEditor(null);
      await reload();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function updateTask(task: Task, status: Task["status"]) {
    try {
      await patch(`/tasks/${task.id}`, { status });
      setTasks((ts) =>
        ts.map((t) => (t.id === task.id ? { ...t, status } : t)),
      );
      notify(
        status === "done"
          ? "One less loose end. Task completed."
          : "Task moved.",
      );
      await reload();
    } catch (e) {
      notify((e as Error).message, true);
    }
  }
  async function checkService(service: Service) {
    setChecking(service.id);
    try {
      const result = await post<Check>(`/services/${service.id}/check`);
      notify(
        result.status === "operational"
          ? `${service.name} responded in ${Math.round(result.latency_ms ?? 0)} ms.`
          : `Check recorded: ${result.error || label(result.status)}.`,
        result.status === "down",
      );
      await reload();
      if (serviceDetail?.id === service.id) {
        const updated = await api<Service>(`/services/${service.id}`);
        setServiceDetail(updated);
        setChecks(await api<Check[]>(`/services/${service.id}/checks`));
      }
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setChecking(null);
    }
  }
  async function openService(service: Service) {
    setServiceDetail(service);
    setChecks([]);
    setChecksLoading(true);
    try {
      setChecks(await api<Check[]>(`/services/${service.id}/checks`));
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setChecksLoading(false);
    }
  }
  async function addUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail) return;
    setBusy(true);
    setFormError("");
    const form = event.currentTarget;
    try {
      const result = await post<Incident>(
        `/incidents/${detail.id}/updates`,
        Object.fromEntries(new FormData(form)),
      );
      setDetail(result);
      form.reset();
      notify("Incident timeline updated.");
      await reload();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function exportReport(incident: Incident) {
    try {
      const { markdown } = await api<{ markdown: string }>(
        `/incidents/${incident.id}/postmortem`,
      );
      download(
        markdown,
        `vigil-postmortem-${incident.id.slice(0, 8)}.md`,
        "text/markdown",
      );
      notify("Postmortem downloaded.");
    } catch (e) {
      notify((e as Error).message, true);
    }
  }
  async function exportWorkspace() {
    try {
      const data = await api("/export");
      download(
        JSON.stringify(data, null, 2),
        "vigil-workspace.json",
        "application/json",
      );
      notify("Your workspace export is ready.");
    } catch (e) {
      notify((e as Error).message, true);
    }
  }
  async function deleteItem() {
    if (!confirm) return;
    setBusy(true);
    try {
      await remove(`/${confirm.kind}s/${confirm.id}`);
      notify(`${label(confirm.kind)} deleted.`);
      setConfirm(null);
      setDetail(null);
      setServiceDetail(null);
      await reload();
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    try {
      await post("/auth/logout");
      navigate("/");
    } catch (e) {
      notify((e as Error).message, true);
    }
  }
  const commandResults = useMemo(
    () =>
      [
        ...navItems.map((n) => ({
          id: n.id,
          title: n.label,
          type: "Navigate",
          action: () => navigate(n.id === "overview" ? "/app" : `/app/${n.id}`),
        })),
        ...services.map((s) => ({
          id: s.id,
          title: s.name,
          type: "Service",
          action: () => openService(s),
        })),
        ...incidents.map((i) => ({
          id: i.id,
          title: i.title,
          type: "Incident",
          action: () => setDetail(i),
        })),
        ...tasks.map((t) => ({
          id: t.id,
          title: t.title,
          type: "Task",
          action: () => setEditor({ kind: "task", value: t }),
        })),
      ]
        .filter((r) =>
          r.title.toLowerCase().includes(commandQuery.toLowerCase()),
        )
        .slice(0, 12),
    [commandQuery, services, incidents, tasks],
  );
  const serviceRows = (list: Service[], compact = false) => (
    <div className="service-table">
      <div className="table-head">
        <span>Service</span>
        <span>Status</span>
        <span>Response</span>
        <span>Last check</span>
        <span />
      </div>
      {list.map((service) => (
        <div className="service-row" key={service.id}>
          <button className="service-name" onClick={() => openService(service)}>
            <div className={`service-icon ${service.status}`}>
              <Globe2 size={18} />
            </div>
            <span>
              <strong>{service.name}</strong>
              <small>
                {new URL(service.url).hostname}
                {service.is_sample ? " · Sample" : ""}
              </small>
            </span>
          </button>
          <Badge value={service.status} />
          <span className="numeric">
            {service.latency_ms === null
              ? "—"
              : `${Math.round(service.latency_ms)} ms`}
          </span>
          <span className="muted time-cell">{ago(service.last_checked)}</span>
          <button
            className="icon-button"
            onClick={() => openService(service)}
            aria-label={`View ${service.name}`}
          >
            <ArrowUpRight size={17} />
          </button>
        </div>
      ))}
      {!compact && list.length === 0 && (
        <Empty
          title="No matching services"
          description="Try another search or connect a new HTTPS service."
          action="Add service"
          onAction={() => setEditor({ kind: "service" })}
        />
      )}
    </div>
  );
  return (
    <div className="workspace">
      <a className="skip-link" href="#workspace-main">
        Skip to workspace
      </a>
      {mobile && (
        <button
          className="sidebar-scrim"
          onClick={() => setMobile(false)}
          aria-label="Close navigation"
        />
      )}
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <Brand />
        <button
          className="workspace-switch"
          onClick={() => navigate("/app/settings")}
        >
          <div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div>
          <span>
            {user.is_demo
              ? "Demo workspace"
              : `${user.name.split(" ")[0]}’s workspace`}
            <small>
              {user.is_demo ? "Your private sandbox" : "Personal workspace"}
            </small>
          </span>
          <ChevronDown size={14} />
        </button>
        <button className="sidebar-search" onClick={() => setCommand(true)}>
          <Search size={15} /> Quick search <kbd>⌘ K</kbd>
        </button>
        <div className="nav-group-label">WORKSPACE</div>
        <nav aria-label="Workspace navigation">
          {navItems.map(({ id, label: navLabel, icon: Icon }) => (
            <Link
              key={id}
              to={id === "overview" ? "/app" : `/app/${id}`}
              className={section === id ? "active" : ""}
            >
              <Icon size={17} />
              {navLabel}
              {id === "incidents" && stats.active_incidents > 0 && (
                <span className="nav-count">{stats.active_incidents}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link to={`/status/${user.workspace_slug}`} target="_blank">
            <Globe2 size={17} /> Public status page <ArrowUpRight size={13} />
          </Link>
          <Link
            to="/app/settings"
            className={section === "settings" ? "active" : ""}
          >
            <Settings size={17} /> Settings & exports
          </Link>
          <a
            href="https://github.com/ReaperXD67/vigil"
            target="_blank"
            rel="noreferrer"
          >
            <Github size={17} /> Source code <ArrowUpRight size={13} />
          </a>
          <div className="sidebar-user">
            <div className="avatar user-avatar">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
            <span>
              {user.name}
              <small>{user.is_demo ? "Demo session" : user.email}</small>
            </span>
            <button
              className="icon-button"
              onClick={logout}
              aria-label="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="workspace-header">
          <div>
            <button
              className="icon-button mobile-nav-button"
              onClick={() => setMobile(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <span className="breadcrumb-slash">/</span>
            <strong>
              {section === "tasks" ? "Recovery tasks" : label(section)}
            </strong>
          </div>
          <div>
            <button
              className="icon-button"
              onClick={reload}
              disabled={refreshing}
              aria-label="Refresh workspace"
            >
              <RefreshCw size={15} className={refreshing ? "spin" : ""} />
            </button>
            <span className="header-date">
              {new Date().toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            <div className="avatar small-avatar">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
          </div>
        </header>
        {user.is_demo && (
          <div className="demo-banner">
            <span>
              <span className="signal-dot blue" />
              <strong>Make yourself at home.</strong> This is your isolated
              demo. All seeded data is sample data.
            </span>
            <Link to="/login?mode=register">
              Create your workspace <ArrowUpRight size={14} />
            </Link>
          </div>
        )}
        <main className="workspace-main" id="workspace-main">
          <div className="page-heading">
            <div>
              <h1>{title}</h1>
              <p>
                {section === "overview"
                  ? "A connected view of service health, active incidents, and what’s next."
                  : section === "services"
                    ? "HTTPS monitoring with check history and a shareable status page."
                    : section === "incidents"
                      ? "Keep the timeline, context, and response in one place."
                      : section === "tasks"
                        ? "Turn what happened into what happens next."
                        : section === "activity"
                          ? "A durable trail of changes across your workspace."
                          : "Your workspace, your data, your infrastructure."}
              </p>
            </div>
            {["overview", "services"].includes(section) ? (
              <button
                className="button primary"
                onClick={() => setEditor({ kind: "service" })}
              >
                <Plus size={16} /> Add service
              </button>
            ) : section === "incidents" ? (
              <button
                className="button primary"
                onClick={() => setEditor({ kind: "incident" })}
              >
                <Plus size={16} /> Declare incident
              </button>
            ) : section === "tasks" ? (
              <button
                className="button primary"
                onClick={() => setEditor({ kind: "task" })}
              >
                <Plus size={16} /> Create task
              </button>
            ) : null}
          </div>
          {loadError && (
            <div className="error-banner" role="alert">
              <CircleAlert size={18} />
              <span>{loadError}</span>
              <button onClick={reload}>Try again</button>
            </div>
          )}
          {loading ? (
            <div className="workspace-loading">
              <Loader2 className="spin" />
              <span>Connecting the dots…</span>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={section}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                {section === "overview" && (
                  <>
                    <div className="metric-grid">
                      <div>
                        <span>
                          Services operational <Radio size={15} />
                        </span>
                        <strong>
                          {stats.operational_services}
                          <small>/ {stats.total_services}</small>
                        </strong>
                        <p>
                          {stats.total_services === 0
                            ? "Connect your first service"
                            : stats.operational_services ===
                                stats.total_services
                              ? "All connected services healthy"
                              : "Some services need attention"}
                        </p>
                      </div>
                      <div>
                        <span>
                          Active incidents <CircleAlert size={15} />
                        </span>
                        <strong
                          className={stats.active_incidents ? "warm" : ""}
                        >
                          {stats.active_incidents}
                          <span
                            className={`metric-light ${stats.active_incidents ? "amber" : ""}`}
                          />
                        </strong>
                        <p>
                          {stats.active_incidents
                            ? "Investigation in progress"
                            : "No active incidents"}
                        </p>
                      </div>
                      <div>
                        <span>
                          Measured availability <Activity size={15} />
                        </span>
                        <strong>
                          {stats.uptime === null
                            ? "—"
                            : stats.uptime.toFixed(2)}
                          {stats.uptime !== null && <small>%</small>}
                        </strong>
                        <p>
                          {stats.total_checks} retained{" "}
                          {user.is_demo ? "sample " : ""}checks
                        </p>
                      </div>
                      <div>
                        <span>
                          Recovery tasks <ListTodo size={15} />
                        </span>
                        <strong>
                          {stats.open_tasks}
                          <small>open</small>
                        </strong>
                        <p>
                          {tasks.filter((t) => t.status === "done").length}{" "}
                          completed follow-ups
                        </p>
                      </div>
                    </div>
                    <div className="overview-grid">
                      <section className="panel services-panel">
                        <div className="panel-title">
                          <h2>
                            Service health <span>{services.length}</span>
                          </h2>
                          <Link to="/app/services">
                            View all <ArrowRight size={14} />
                          </Link>
                        </div>
                        {services.length ? (
                          serviceRows(services.slice(0, 5), true)
                        ) : (
                          <Empty
                            title="Your first signal starts here."
                            description="Add an HTTPS service to begin tracking health and response time."
                            action="Connect a service"
                            onAction={() => setEditor({ kind: "service" })}
                          />
                        )}
                        <div className="panel-footer">
                          <span className="signal-dot" />{" "}
                          {user.is_demo
                            ? "Illustrative sample checks. Sign up to run live probes."
                            : "Measurements reflect retained checks, not an SLA."}
                        </div>
                      </section>
                      <section className="panel incident-panel">
                        <div className="panel-title">
                          <h2>Needs attention</h2>
                          <CircleAlert size={16} />
                        </div>
                        {openIncidents.length ? (
                          openIncidents.slice(0, 3).map((i) => (
                            <button
                              key={i.id}
                              className="incident-summary"
                              onClick={() => setDetail(i)}
                            >
                              <div>
                                <Badge value={i.severity} />
                                <span>{ago(i.created_at)}</span>
                              </div>
                              <h3>{i.title}</h3>
                              <p>{i.description}</p>
                              <div>
                                <Badge value={i.status} />
                                <ArrowUpRight size={16} />
                              </div>
                            </button>
                          ))
                        ) : (
                          <Empty
                            title="A quiet moment."
                            description="No active incidents. Your next signal will have a home here."
                          />
                        )}
                      </section>
                      <section className="panel activity-panel">
                        <div className="panel-title">
                          <h2>Recent activity</h2>
                          <Link to="/app/activity">
                            See timeline <ArrowRight size={14} />
                          </Link>
                        </div>
                        <ActivityList entries={activity.slice(0, 5)} />
                      </section>
                      <section className="panel next-panel">
                        <div className="panel-title">
                          <h2>Up next</h2>
                          <Link to="/app/tasks">
                            All tasks <ArrowRight size={14} />
                          </Link>
                        </div>
                        {tasks
                          .filter((t) => t.status !== "done")
                          .slice(0, 4)
                          .map((task) => (
                            <div className="next-task" key={task.id}>
                              <button
                                className="task-checkbox"
                                onClick={() => updateTask(task, "done")}
                                aria-label={`Complete ${task.title}`}
                              >
                                <CheckIcon size={12} />
                              </button>
                              <button
                                onClick={() =>
                                  setEditor({ kind: "task", value: task })
                                }
                              >
                                <strong>{task.title}</strong>
                                <span>
                                  {label(task.priority)} priority ·{" "}
                                  {taskLabels[task.status]}
                                </span>
                              </button>
                            </div>
                          ))}
                        {!tasks.some((t) => t.status !== "done") && (
                          <Empty
                            title="Nothing left hanging."
                            description="Create a task to plan your next reliability improvement."
                          />
                        )}
                      </section>
                    </div>
                  </>
                )}
                {section === "services" && (
                  <>
                    <Toolbar
                      search={search}
                      setSearch={setSearch}
                      placeholder="Search services…"
                      filter={filter}
                      setFilter={setFilter}
                      options={[
                        "all",
                        "operational",
                        "degraded",
                        "down",
                        "unknown",
                      ]}
                      count={filteredServices.length}
                      noun="services"
                    />
                    {services.length ? (
                      <section className="panel">
                        {serviceRows(filteredServices)}
                      </section>
                    ) : (
                      <Empty
                        title="Every service has a story."
                        description="Connect your first HTTPS endpoint. Vigil will keep the check history with you."
                        action="Add your first service"
                        onAction={() => setEditor({ kind: "service" })}
                      />
                    )}
                    <div className="context-note">
                      <ShieldCheck size={17} />
                      <p>
                        {user.is_demo
                          ? "Demo endpoints are samples. Create an account to run real external checks."
                          : "Checks allow public HTTPS endpoints on port 443. Private network targets and redirects are blocked."}
                      </p>
                    </div>
                  </>
                )}
                {section === "incidents" && (
                  <>
                    <Toolbar
                      search={search}
                      setSearch={setSearch}
                      placeholder="Search incidents…"
                      filter={filter}
                      setFilter={setFilter}
                      options={[
                        "all",
                        "active",
                        "investigating",
                        "identified",
                        "monitoring",
                        "resolved",
                      ]}
                      count={filteredIncidents.length}
                      noun="incidents"
                    />
                    <div className="incident-list">
                      {filteredIncidents.map((incident) => (
                        <button
                          key={incident.id}
                          className="incident-list-row"
                          onClick={() => setDetail(incident)}
                        >
                          <div className={`incident-symbol ${incident.status}`}>
                            <CircleAlert size={20} />
                          </div>
                          <div className="incident-title">
                            <strong>{incident.title}</strong>
                            <span>
                              {incident.service_name || "Workspace incident"} ·{" "}
                              {dateTime(incident.created_at)}
                              {incident.is_sample ? " · Sample" : ""}
                            </span>
                          </div>
                          <Badge value={incident.severity} />
                          <Badge value={incident.status} />
                          <ArrowUpRight size={17} />
                        </button>
                      ))}
                    </div>
                    {!filteredIncidents.length && (
                      <Empty
                        title={
                          search
                            ? "No matching incidents."
                            : "Keep calm. Stay ready."
                        }
                        description={
                          search
                            ? "Try a different search."
                            : "Declare an incident when something needs a coordinated response."
                        }
                        action="Declare incident"
                        onAction={() => setEditor({ kind: "incident" })}
                      />
                    )}
                  </>
                )}
                {section === "tasks" && (
                  <>
                    <Toolbar
                      search={search}
                      setSearch={setSearch}
                      placeholder="Search recovery tasks…"
                      filter={filter}
                      setFilter={setFilter}
                      options={["all", "urgent", "high", "medium", "low"]}
                      count={filteredTasks.length}
                      noun="tasks"
                    />
                    <div className="task-board">
                      {taskStates.map((state) => (
                        <section className="task-column" key={state}>
                          <div className="task-column-title">
                            <span>
                              <i className={state} />
                              {taskLabels[state]}{" "}
                              <small>
                                {
                                  filteredTasks.filter(
                                    (t) => t.status === state,
                                  ).length
                                }
                              </small>
                            </span>
                            <button
                              className="icon-button"
                              aria-label={`Add task to ${taskLabels[state]}`}
                              onClick={() =>
                                setEditor({ kind: "task", status: state })
                              }
                            >
                              <Plus size={16} />
                            </button>
                          </div>
                          <div className="task-column-body">
                            {filteredTasks
                              .filter((t) => t.status === state)
                              .map((task) => (
                                <motion.article
                                  layout
                                  className="task-card"
                                  key={task.id}
                                >
                                  <button
                                    className="task-card-title"
                                    onClick={() =>
                                      setEditor({ kind: "task", value: task })
                                    }
                                  >
                                    {task.title}
                                    <MoreHorizontal size={16} />
                                  </button>
                                  {task.description && (
                                    <p>{task.description}</p>
                                  )}
                                  {task.incident_id && (
                                    <div className="task-incident">
                                      <CircleAlert size={12} /> Linked to
                                      incident
                                    </div>
                                  )}
                                  <div className="task-card-footer">
                                    <Badge value={task.priority} />
                                    <select
                                      value={task.status}
                                      onChange={(e) =>
                                        updateTask(
                                          task,
                                          e.target.value as Task["status"],
                                        )
                                      }
                                      aria-label={`Move ${task.title}`}
                                    >
                                      {taskStates.map((s) => (
                                        <option value={s} key={s}>
                                          {taskLabels[s]}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </motion.article>
                              ))}
                            {!filteredTasks.some((t) => t.status === state) && (
                              <div className="empty-column">
                                {state === "done"
                                  ? "Your finished work lands here."
                                  : "Room for your next move."}
                              </div>
                            )}
                          </div>
                        </section>
                      ))}
                    </div>
                  </>
                )}
                {section === "activity" && (
                  <section className="panel full-activity">
                    <div className="panel-title">
                      <h2>Workspace timeline</h2>
                      <span className="muted">
                        Latest {activity.length} events
                      </span>
                    </div>
                    <ActivityList entries={activity} />
                  </section>
                )}
                {section === "settings" && (
                  <div className="settings-sections">
                    <section className="settings-section">
                      <div>
                        <h2>Your workspace</h2>
                        <p>A home for your service reliability.</p>
                      </div>
                      <dl>
                        <div>
                          <dt>Name</dt>
                          <dd>{user.name}</dd>
                        </div>
                        <div>
                          <dt>Account</dt>
                          <dd>
                            {user.is_demo
                              ? "Isolated demo workspace"
                              : user.email}
                          </dd>
                        </div>
                        <div>
                          <dt>Workspace ID</dt>
                          <dd className="mono">{user.workspace_slug}</dd>
                        </div>
                      </dl>
                      {user.is_demo && (
                        <Link
                          to="/login?mode=register"
                          className="button primary"
                        >
                          Create a permanent workspace{" "}
                          <ArrowUpRight size={16} />
                        </Link>
                      )}
                    </section>
                    <section className="settings-section">
                      <div>
                        <h2>A status page for your services</h2>
                        <p>
                          Only services you explicitly mark public appear here.
                          Service URLs and private workspace data are never
                          included.
                        </p>
                      </div>
                      <div className="public-url">
                        <Globe2 size={17} />
                        <code>
                          {locationOrigin()}/status/{user.workspace_slug}
                        </code>
                        <button
                          className="button secondary small"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(
                                `${locationOrigin()}/status/${user.workspace_slug}`,
                              );
                              notify("Status page link copied.");
                            } catch {
                              notify("Copy the URL from this field.", true);
                            }
                          }}
                        >
                          Copy link
                        </button>
                      </div>
                      <Link
                        to={`/status/${user.workspace_slug}`}
                        target="_blank"
                        className="text-link"
                      >
                        Open public status page <ArrowUpRight size={16} />
                      </Link>
                    </section>
                    <section className="settings-section">
                      <div>
                        <h2>Your data goes with you</h2>
                        <p>
                          Download services, check history, incidents, tasks,
                          and activity as JSON. Passwords and session tokens are
                          excluded.
                        </p>
                      </div>
                      <button
                        className="button secondary"
                        onClick={exportWorkspace}
                      >
                        <ArrowDownToLine size={16} /> Export workspace
                      </button>
                    </section>
                    <section className="settings-section">
                      <div>
                        <h2>Built in the open</h2>
                        <p>
                          Vigil is MIT licensed. Inspect the code, report an
                          issue, or deploy it on your own infrastructure.
                        </p>
                      </div>
                      <a
                        className="button secondary"
                        href="https://github.com/ReaperXD67/vigil"
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Github size={16} /> View source{" "}
                        <ArrowUpRight size={16} />
                      </a>
                    </section>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </main>
        <footer className="workspace-footer">
          <span>
            <span className="signal-dot blue" />{" "}
            {user.is_demo ? "Sample workspace" : "Your private workspace"}
          </span>
          <span>Vigil · Built in the open</span>
        </footer>
      </div>
      <Modal
        open={!!editor}
        onClose={() => !busy && setEditor(null)}
        title={`${editor?.value ? "Edit" : editor?.kind === "incident" ? "Declare" : "New"} ${editor?.kind ?? ""}`}
        description={
          editor?.kind === "service"
            ? "Connect a public HTTPS endpoint to your workspace."
            : editor?.kind === "incident"
              ? "Give the response a clear starting point."
              : "A small action for a more reliable tomorrow."
        }
      >
        {editor && (
          <form
            className="editor-form"
            onSubmit={save}
            key={`${editor.kind}-${editor.value?.id ?? "new"}`}
          >
            <label>
              {editor.kind === "service" ? "Service name" : "Title"}
              <input
                name={editor.kind === "service" ? "name" : "title"}
                defaultValue={
                  editor.kind === "service"
                    ? editor.value?.name
                    : editor.value?.title
                }
                required
                maxLength={editor.kind === "service" ? 80 : 160}
                autoFocus
                placeholder={
                  editor.kind === "service"
                    ? "Production API"
                    : editor.kind === "incident"
                      ? "Elevated response times on API"
                      : "Add a retry policy to the event worker"
                }
              />
            </label>
            {editor.kind === "service" && (
              <label>
                HTTPS endpoint
                <input
                  name="url"
                  type="url"
                  pattern="https://.*"
                  defaultValue={editor.value?.url}
                  required
                  placeholder="https://api.example.com/health"
                  maxLength={2000}
                />
              </label>
            )}
            <label>
              Description <span className="optional">optional</span>
              <textarea
                name="description"
                defaultValue={editor.value?.description}
                rows={3}
                maxLength={editor.kind === "incident" ? 8000 : 4000}
                placeholder="Add useful context…"
              />
            </label>
            {editor.kind === "service" && (
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="is_public"
                  defaultChecked={editor.value?.is_public ?? false}
                />
                <span>
                  Show on public status page
                  <small>
                    Publishes the service name, description, and status. The
                    endpoint stays private.
                  </small>
                </span>
              </label>
            )}
            {editor.kind === "incident" && (
              <div className="form-grid">
                <label>
                  Severity
                  <select
                    name="severity"
                    defaultValue={editor.value?.severity ?? "minor"}
                  >
                    <option value="minor">Minor</option>
                    <option value="major">Major</option>
                    <option value="critical">Critical</option>
                  </select>
                </label>
                <label>
                  Affected service
                  <select
                    name="service_id"
                    defaultValue={editor.value?.service_id ?? ""}
                  >
                    <option value="">Workspace-wide</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            {editor.kind === "task" && (
              <>
                <div className="form-grid">
                  <label>
                    Priority
                    <select
                      name="priority"
                      defaultValue={editor.value?.priority ?? "medium"}
                    >
                      {["low", "medium", "high", "urgent"].map((p) => (
                        <option key={p} value={p}>
                          {label(p)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Status
                    <select
                      name="status"
                      defaultValue={
                        editor.value?.status ?? editor.status ?? "todo"
                      }
                    >
                      {taskStates.map((s) => (
                        <option value={s} key={s}>
                          {taskLabels[s]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  Related incident
                  <select
                    name="incident_id"
                    defaultValue={editor.value?.incident_id ?? ""}
                  >
                    <option value="">No linked incident</option>
                    {incidents.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.title}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            {formError && (
              <p role="alert" className="form-error">
                {formError}
              </p>
            )}
            <div className="dialog-actions">
              {editor.value && (
                <button
                  type="button"
                  className="button danger subtle"
                  onClick={() => {
                    setConfirm({
                      kind: editor.kind,
                      id: editor.value!.id,
                      name:
                        editor.kind === "service"
                          ? (editor.value as Service).name
                          : (editor.value as Task).title,
                    });
                    setEditor(null);
                  }}
                >
                  <Trash2 size={15} /> Delete
                </button>
              )}
              <button
                type="button"
                className="button secondary"
                onClick={() => setEditor(null)}
                disabled={busy}
              >
                Cancel
              </button>
              <Submit busy={busy}>
                {editor.value
                  ? "Save changes"
                  : editor.kind === "service"
                    ? "Connect service"
                    : editor.kind === "incident"
                      ? "Declare incident"
                      : "Create task"}
                <ArrowRight size={15} />
              </Submit>
            </div>
          </form>
        )}
      </Modal>
      <Modal
        open={!!detail}
        onClose={() => !busy && setDetail(null)}
        title={detail?.title ?? "Incident"}
        description={
          detail
            ? `${detail.service_name || "Workspace incident"} · Opened ${dateTime(detail.created_at)}`
            : ""
        }
        wide
      >
        {detail && (
          <>
            <div className="detail-badges">
              <Badge value={detail.severity} />
              <Badge value={detail.status} />
              {detail.is_sample && (
                <span className="sample-label">Sample incident</span>
              )}
            </div>
            <p className="detail-description">
              {detail.description || "No description added."}
            </p>
            <div className="detail-actions">
              <button
                className="button secondary small"
                onClick={() => exportReport(detail)}
              >
                <ArrowDownToLine size={15} /> Export postmortem
              </button>
              <button
                className="button secondary small"
                onClick={() => {
                  setEditor({ kind: "incident", value: detail });
                  setDetail(null);
                }}
              >
                Edit incident
              </button>
            </div>
            <h3 className="timeline-heading">Response timeline</h3>
            <div className="incident-timeline">
              <div>
                <i />
                <span>
                  <strong>Incident declared</strong>
                  <small>{dateTime(detail.created_at)}</small>
                </span>
              </div>
              {detail.updates.map((u) => (
                <div key={u.id}>
                  <i className={u.status} />
                  <span>
                    <Badge value={u.status} />
                    <p>{u.message}</p>
                    <small>{dateTime(u.created_at)}</small>
                  </span>
                </div>
              ))}
            </div>
            <form className="update-form" onSubmit={addUpdate}>
              <h3>Move the response forward</h3>
              <label>
                Update
                <textarea
                  name="message"
                  required
                  maxLength={4000}
                  rows={3}
                  placeholder="What changed? What happens next?"
                />
              </label>
              <div className="update-form-footer">
                <label>
                  Status
                  <select
                    name="status"
                    defaultValue={detail.status}
                    key={detail.status}
                  >
                    {statusOptions.map((s) => (
                      <option key={s} value={s}>
                        {label(s)}
                      </option>
                    ))}
                  </select>
                </label>
                <Submit busy={busy}>
                  Post update <ArrowRight size={15} />
                </Submit>
              </div>
              {formError && (
                <p className="form-error" role="alert">
                  {formError}
                </p>
              )}
            </form>
          </>
        )}
      </Modal>
      <Modal
        open={!!serviceDetail}
        onClose={() => setServiceDetail(null)}
        title={serviceDetail?.name ?? "Service"}
        description={serviceDetail?.url}
        wide
      >
        {serviceDetail && (
          <>
            <div className="detail-badges">
              <Badge value={serviceDetail.status} />
              <span className="sample-label">
                {serviceDetail.is_public
                  ? "Public status enabled"
                  : "Private service"}
              </span>
              {serviceDetail.is_sample && (
                <span className="sample-label">Sample data</span>
              )}
            </div>
            <p className="detail-description">
              {serviceDetail.description || "No description added."}
            </p>
            <div className="detail-actions">
              <button
                className="button primary small"
                disabled={checking === serviceDetail.id || user.is_demo}
                onClick={() => checkService(serviceDetail)}
              >
                {checking === serviceDetail.id ? (
                  <Loader2 className="spin" size={15} />
                ) : (
                  <RefreshCw size={15} />
                )}{" "}
                Run check
              </button>
              <button
                className="button secondary small"
                onClick={() => {
                  setEditor({ kind: "service", value: serviceDetail });
                  setServiceDetail(null);
                }}
              >
                Edit service
              </button>
            </div>
            {user.is_demo && (
              <p className="form-hint">
                This is sample history. Sign up to run real HTTPS checks.
              </p>
            )}
            <div className="check-summary">
              <div>
                <span>Response time</span>
                <strong>
                  {serviceDetail.latency_ms === null
                    ? "—"
                    : `${Math.round(serviceDetail.latency_ms)} ms`}
                </strong>
              </div>
              <div>
                <span>Retained availability</span>
                <strong>
                  {serviceDetail.uptime === null
                    ? "—"
                    : `${serviceDetail.uptime.toFixed(2)}%`}
                </strong>
              </div>
              <div>
                <span>Last check</span>
                <strong>{ago(serviceDetail.last_checked)}</strong>
              </div>
            </div>
            <h3 className="timeline-heading">Recent checks</h3>
            {checksLoading ? (
              <div className="workspace-loading">
                <Loader2 className="spin" />
              </div>
            ) : checks.length ? (
              <>
                <div
                  className="real-check-chart"
                  aria-label="Recent response time history"
                >
                  {[...checks].reverse().map((c) => (
                    <div
                      key={c.id}
                      title={`${c.latency_ms ?? 0} ms · ${label(c.status)} · ${dateTime(c.checked_at)}`}
                      style={{
                        height: `${Math.max(5, Math.min(100, ((c.latency_ms ?? 0) / Math.max(...checks.map((x) => x.latency_ms ?? 0), 1)) * 100))}%`,
                      }}
                      className={c.status}
                    />
                  ))}
                </div>
                <div className="check-list">
                  {checks.slice(0, 10).map((c) => (
                    <div key={c.id}>
                      <Badge value={c.status} />
                      <span>{c.status_code ?? "—"}</span>
                      <span>
                        {c.latency_ms === null
                          ? "—"
                          : `${Math.round(c.latency_ms)} ms`}
                      </span>
                      <time>{ago(c.checked_at)}</time>
                      {c.error && <small>{c.error}</small>}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <Empty
                title="No checks yet."
                description="Run the first check to establish a starting point."
              />
            )}
          </>
        )}
      </Modal>
      <Modal
        open={!!confirm}
        onClose={() => !busy && setConfirm(null)}
        title={`Delete ${confirm?.kind ?? "item"}?`}
        description={`“${confirm?.name}” will be permanently removed. This cannot be undone.`}
      >
        <div className="dialog-actions">
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => setConfirm(null)}
          >
            Keep it
          </button>
          <button
            className="button danger"
            disabled={busy}
            onClick={deleteItem}
          >
            {busy ? (
              <Loader2 size={16} className="spin" />
            ) : (
              <Trash2 size={16} />
            )}{" "}
            Delete {confirm?.kind}
          </button>
        </div>
      </Modal>
      <Modal
        open={command}
        onClose={() => {
          setCommand(false);
          setCommandQuery("");
        }}
        title="Go anywhere"
        description="Find a service, incident, task, or workspace view."
      >
        <div className="command-input">
          <Search size={18} />
          <input
            autoFocus
            value={commandQuery}
            onChange={(e) => setCommandQuery(e.target.value)}
            placeholder="Search your workspace…"
            aria-label="Search your workspace"
          />
        </div>
        <div className="command-results">
          {commandResults.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                setCommand(false);
                setCommandQuery("");
                r.action();
              }}
            >
              <span>
                {r.title}
                <small>{r.type}</small>
              </span>
              <ArrowUpRight size={16} />
            </button>
          ))}
          {!commandResults.length && <p>No matching results.</p>}
        </div>
        <div className="command-hint">
          Tab to navigate · Enter to select · Esc to close
        </div>
      </Modal>
      <AnimatePresence>
        {toast && (
          <motion.div
            className={`toast ${toast.error ? "error" : ""}`}
            role={toast.error ? "alert" : "status"}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 12, opacity: 0 }}
          >
            {toast.error ? (
              <CircleAlert size={18} />
            ) : (
              <CheckCircle2 size={18} />
            )}
            <span>{toast.message}</span>
            <button
              className="icon-button"
              onClick={() => setToast(null)}
              aria-label="Dismiss notification"
            >
              <X size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function locationOrigin() {
  return window.location.origin;
}
function ActivityList({ entries }: { entries: ActivityEntry[] }) {
  return entries.length ? (
    <div className="activity-list">
      {entries.map((entry) => (
        <div key={entry.id}>
          <div
            className={`activity-symbol ${entry.type.includes("incident") ? "amber" : ""}`}
          >
            {entry.type.includes("task") ? (
              <CheckIcon size={14} />
            ) : entry.type.includes("service") ? (
              <Radio size={14} />
            ) : (
              <Activity size={14} />
            )}
          </div>
          <div>
            <p>{entry.message}</p>
            <span>
              {ago(entry.created_at)}
              {entry.is_sample ? " · Sample event" : ""}
            </span>
          </div>
          <time>
            {new Date(entry.created_at).toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        </div>
      ))}
    </div>
  ) : (
    <Empty
      title="A fresh start."
      description="Your workspace activity will appear as you connect services and begin working."
    />
  );
}
function Toolbar({
  search,
  setSearch,
  placeholder,
  filter,
  setFilter,
  options,
  count,
  noun,
}: {
  search: string;
  setSearch: (s: string) => void;
  placeholder: string;
  filter: string;
  setFilter: (s: string) => void;
  options: string[];
  count: number;
  noun: string;
}) {
  return (
    <div className="toolbar">
      <div className="search-input">
        <Search size={16} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
        />
        {search && (
          <button
            className="icon-button"
            onClick={() => setSearch("")}
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>
      <select
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        aria-label={`Filter ${noun}`}
      >
        {options.map((o) => (
          <option value={o} key={o}>
            {o === "all" ? "All " + noun : label(o)}
          </option>
        ))}
      </select>
      <span>
        {count} {noun}
      </span>
    </div>
  );
}
