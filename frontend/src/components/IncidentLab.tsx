import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Box,
  Check,
  Database,
  Download,
  Globe2,
  KeyRound,
  Layers,
  Link2,
  Pause,
  Play,
  RotateCcw,
  Waypoints,
} from "lucide-react";
import { download } from "../api";
import "./IncidentLab.css";

const nodes = [
  {
    id: "web",
    name: "Web app",
    x: 10,
    y: 50,
    icon: Globe2,
    detail: "The experience your users see.",
  },
  {
    id: "gateway",
    name: "API gateway",
    x: 32,
    y: 50,
    icon: Waypoints,
    detail: "Routes requests to the services behind them.",
  },
  {
    id: "auth",
    name: "Authentication",
    x: 57,
    y: 22,
    icon: KeyRound,
    detail: "Validates sessions and user permissions.",
  },
  {
    id: "checkout",
    name: "Checkout",
    x: 57,
    y: 78,
    icon: Box,
    detail: "Coordinates transactions and background work.",
  },
  {
    id: "database",
    name: "Database",
    x: 85,
    y: 22,
    icon: Database,
    detail: "The shared dependency behind authentication and checkout.",
  },
  {
    id: "queue",
    name: "Event queue",
    x: 85,
    y: 78,
    icon: Layers,
    detail: "Buffers work for asynchronous processing.",
  },
];
const edges = [
  [0, 1],
  [1, 2],
  [1, 3],
  [2, 4],
  [3, 4],
  [3, 5],
];
const scenarios = {
  database: {
    label: "Database saturation",
    affected: ["database", "auth", "checkout", "gateway", "web"],
    cause: "The connection pool reaches capacity.",
    action: "Reduce concurrency and release stalled connections.",
    recovered: "Connection pressure drops. Dependent services recover.",
  },
  auth: {
    label: "Authentication outage",
    affected: ["auth", "gateway", "web"],
    cause: "Session validation begins returning errors.",
    action: "Roll back the authentication release and validate sessions.",
    recovered: "Authentication checks pass. The request path is restored.",
  },
  queue: {
    label: "Queue backlog",
    affected: ["queue", "checkout", "gateway", "web"],
    cause: "Incoming events outpace the worker throughput.",
    action: "Limit producers and recover worker throughput.",
    recovered: "The backlog drains and checkout returns to normal.",
  },
};
type Scenario = keyof typeof scenarios;
const phaseNames = [
  "All systems steady",
  "The signal appears",
  "Find the shared dependency",
  "Recover deliberately",
  "Close the loop",
];
function phaseAt(time: number) {
  return time < 12 ? 0 : time < 34 ? 1 : time < 62 ? 2 : time < 84 ? 3 : 4;
}
function initialScenario(): Scenario {
  const value = new URLSearchParams(location.search).get("drill");
  return value && Object.hasOwn(scenarios, value)
    ? (value as Scenario)
    : "database";
}
function initialTime() {
  const value = Number(new URLSearchParams(location.search).get("t") || 0);
  return Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : 0;
}

export default function IncidentLab() {
  const [scenario, setScenario] = useState<Scenario>(initialScenario);
  const [time, setTime] = useState(initialTime);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState<string>(scenario);
  const [copied, setCopied] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const visible = useRef(true);
  const phase = phaseAt(time);
  const current = scenarios[scenario];
  const disrupted = phase > 0 && phase < 4;
  const events = [
    {
      at: 0,
      title: "Establish a baseline",
      text: "All six illustrative services are healthy.",
    },
    { at: 12, title: "Detect the change", text: current.cause },
    {
      at: 34,
      title: "Follow the dependency",
      text: `Trace the signal back to ${nodes.find((n) => n.id === scenario)?.name.toLowerCase()}.`,
    },
    { at: 62, title: "Apply a recovery", text: current.action },
    { at: 84, title: "Verify, then resolve", text: current.recovered },
  ];
  const activeNode = nodes.find((n) => n.id === selected)!;
  const activeAffected = disrupted && current.affected.includes(selected);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      visible.current = entry.isIntersecting;
    });
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      if (!document.hidden && visible.current)
        setTime((value) => Math.min(value + 1, 100));
    }, 250);
    return () => clearInterval(timer);
  }, [playing]);
  useEffect(() => {
    if (time === 100) setPlaying(false);
  }, [time]);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(""), 3000);
    return () => clearTimeout(timer);
  }, [copied]);
  function changeScenario(value: Scenario) {
    setScenario(value);
    setSelected(value);
    setTime(0);
    setPlaying(false);
  }
  function exportDrill() {
    download(
      `# Vigil incident rehearsal\n\nScenario: ${current.label}\nProgress: T+${time}s — ${phaseNames[phase]}\n\nThis is an illustrative local simulation, not a production incident or measured telemetry. No external services were affected.\n\n## Observed exercise timeline\n\n${events
        .filter((e) => e.at <= time)
        .map((e) => `- **T+${e.at}s · ${e.title}:** ${e.text}`)
        .join(
          "\n",
        )}\n\n## Potential dependency impact\n\n${current.affected.map((id) => `- ${nodes.find((n) => n.id === id)?.name}`).join("\n")}\n\n## Reflection\n\n- What would tell you that this is a shared dependency failure?\n- What evidence would you require before resolving the incident?\n- Which follow-up would prevent a repeat?\n\nBuilt with [Vigil](https://github.com/ReaperXD67/vigil).\n`,
      `vigil-${scenario}-rehearsal.md`,
      "text/markdown",
    );
  }
  async function shareDrill() {
    const url = new URL(location.href);
    url.searchParams.set("drill", scenario);
    url.searchParams.set("t", String(time));
    url.hash = "platform";
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopied("Link copied");
    } catch {
      setCopied("Clipboard unavailable. Use Export exercise instead.");
    }
  }
  return (
    <div className="incident-lab" ref={root}>
      <div className="lab-toolbar">
        <div className="lab-identity">
          <span className={`signal-dot ${disrupted ? "amber" : ""}`} />
          <strong>Incident rehearsal</strong>
          <span>Local simulation</span>
        </div>
        <label className="lab-scenario">
          <span className="sr-only">Choose an incident scenario</span>
          <select
            value={scenario}
            onChange={(e) => changeScenario(e.target.value as Scenario)}
          >
            {Object.entries(scenarios).map(([id, s]) => (
              <option key={id} value={id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="lab-body">
        <div className="lab-network">
          <div className="lab-network-title">
            <span>One dependency. A wider impact.</span>
            <span className="mono">T+{String(time).padStart(3, "0")}s</span>
          </div>
          <div
            className={`lab-map ${playing ? "is-playing" : ""}`}
            role="group"
            aria-label="Illustrative service dependencies. Select a service to inspect it."
          >
            <svg
              viewBox="0 0 1000 360"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {edges.map(([from, to]) => {
                const a = nodes[from],
                  b = nodes[to],
                  affected =
                    disrupted &&
                    current.affected.includes(a.id) &&
                    current.affected.includes(b.id);
                const path = `M${a.x * 10} ${a.y * 3.6} C${(a.x + b.x) * 5} ${a.y * 3.6},${(a.x + b.x) * 5} ${b.y * 3.6},${b.x * 10} ${b.y * 3.6}`;
                return (
                  <g
                    key={`${from}-${to}`}
                    className={affected ? "lab-edge affected" : "lab-edge"}
                  >
                    <path d={path} />
                    <path className="lab-edge-flow" d={path} />
                  </g>
                );
              })}
            </svg>
            {nodes.map(({ id, name, x, y, icon: Icon }) => {
              const affected = disrupted && current.affected.includes(id),
                source = id === scenario && affected;
              return (
                <button
                  key={id}
                  type="button"
                  className={`lab-node ${affected ? "affected" : ""} ${source ? "source" : ""} ${selected === id ? "selected" : ""}`}
                  style={{ left: `${x}%`, top: `${y}%` }}
                  onClick={() => setSelected(id)}
                  aria-pressed={selected === id}
                  aria-label={`${name}, ${affected ? (source ? "source of simulated disruption" : "potentially affected") : "healthy"}`}
                >
                  <span className="lab-node-symbol">
                    <Icon size={23} strokeWidth={1.45} />
                    <i />
                  </span>
                  <span className="lab-node-name">{name}</span>
                </button>
              );
            })}
          </div>
          <div className="lab-inspector">
            <div>
              <activeNode.icon size={17} />
              <strong>{activeNode.name}</strong>
              <span className={activeAffected ? "warm" : ""}>
                {activeAffected
                  ? selected === scenario
                    ? "Simulated source"
                    : "Potential impact"
                  : "Healthy in this scenario"}
              </span>
            </div>
            <p>{activeNode.detail}</p>
          </div>
        </div>
        <div className="lab-story" aria-live="polite" aria-atomic="true">
          <div className="lab-phase">
            <span>
              {phase === 4
                ? "Recovery verified"
                : disrupted
                  ? "Exercise in progress"
                  : "Ready when you are"}
            </span>
            <h3>{phaseNames[phase]}.</h3>
          </div>
          <ol>
            {events.map((event, i) => (
              <li
                key={event.at}
                className={`${i === phase ? "current" : ""} ${i > phase ? "future" : ""}`}
              >
                <span className="lab-event-marker">
                  {i < phase ? <Check size={10} /> : <i />}
                </span>
                <div>
                  <span className="mono">
                    T+{String(event.at).padStart(2, "0")}s
                  </span>
                  <strong>{event.title}</strong>
                  {i === phase && <p>{event.text}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div className="lab-transport">
        <button
          className="button primary small"
          onClick={() => {
            if (time >= 100) setTime(0);
            setPlaying(!playing);
          }}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
          {playing
            ? "Pause"
            : time === 0 || time === 100
              ? "Run rehearsal"
              : "Continue"}
        </button>
        <button
          className="icon-button"
          aria-label="Reset rehearsal"
          onClick={() => {
            setTime(0);
            setPlaying(false);
          }}
        >
          <RotateCcw size={16} />
        </button>
        <label className="lab-scrubber">
          <span className="sr-only">Rehearsal time</span>
          <input
            type="range"
            min="0"
            max="100"
            value={time}
            aria-valuetext={`T+${time} seconds, ${phaseNames[phase]}`}
            onChange={(e) => {
              setTime(Number(e.target.value));
              setPlaying(false);
            }}
          />
        </label>
        <button
          className="icon-button"
          aria-label="Copy rehearsal link"
          title="Copy rehearsal link"
          onClick={shareDrill}
        >
          <Link2 size={16} />
        </button>
        <button
          className="icon-button"
          aria-label="Export exercise as Markdown"
          title="Export exercise"
          onClick={exportDrill}
        >
          <Download size={16} />
        </button>
      </div>
      <div className="lab-footnote">
        <span role="status">
          {copied ||
            "Illustrative topology. No external services are affected."}
        </span>
        <Link to="/app/topology?demo=1">
          Map your own services <ArrowUpRight size={14} />
        </Link>
      </div>
    </div>
  );
}
