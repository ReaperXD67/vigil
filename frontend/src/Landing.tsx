import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  Activity,
  Radio,
  ShieldCheck,
  Terminal,
  Check,
  ChevronDown,
  Command,
  Menu,
  X,
  ArrowDown,
  Workflow,
  Globe2,
} from "lucide-react";
import { motion } from "motion/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { Brand, Github } from "./components/Brand";
import Constellation from "./components/Constellation";

gsap.registerPlugin(ScrollTrigger);
const REPO = "https://github.com/ReaperXD67/vigil";
const capabilities = [
  {
    title: "Catch the quiet failures.",
    text: "Check your HTTPS services, follow response times, and keep a history of what actually happened.",
    icon: Radio,
  },
  {
    title: "Give incidents a direction.",
    text: "From the first signal to the final resolution, keep the timeline, severity, and recovery work in one place.",
    icon: Activity,
  },
  {
    title: "Make the next time better.",
    text: "Turn incidents into actionable follow-ups. Export a postmortem built from the timeline, not from memory.",
    icon: Workflow,
  },
];
const faq = [
  [
    "What can I do in the demo?",
    "The demo creates your own isolated workspace with clearly labeled sample services, incidents, and tasks. You can edit the data, resolve incidents, and export reports. External network checks require a registered account.",
  ],
  [
    "Is Vigil actually open source?",
    "Yes. The application, API, Docker setup, Helm charts, and infrastructure code are available under the MIT license. Fork it, change it, or self-host it. Your data can be exported at any time.",
  ],
  [
    "How does monitoring work?",
    "Registered users can run real HTTPS checks and see retained response history. Self-hosted deployments can enable the scheduled worker. Checks use bounded timeouts and reject private network targets. This is one-region monitoring, not a worldwide probe network.",
  ],
  [
    "Can I share my service status?",
    "Yes. Choose which services appear on your workspace’s public status page. Private service URLs, account details, tasks, and incident notes stay in your workspace.",
  ],
];

export default function Landing() {
  const root = useRef<HTMLDivElement>(null);
  const [mobile, setMobile] = useState(false);
  const [active, setActive] = useState(0);
  useEffect(() => {
    document.title = "Vigil — See the signal. Own the response.";
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const lenis = new Lenis({ duration: 1.05, anchors: true });
      lenis.on("scroll", ScrollTrigger.update);
      const tick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      const ctx = gsap.context(() => {
        gsap.from(".hero-copy > *", {
          y: 24,
          opacity: 0.25,
          stagger: 0.09,
          duration: 1.05,
          ease: "power3.out",
        });
        gsap.to(".hero-art", {
          y: 80,
          opacity: 0.3,
          ease: "none",
          scrollTrigger: {
            trigger: ".hero",
            start: "center top",
            end: "bottom top",
            scrub: true,
          },
        });
        gsap.utils
          .toArray<HTMLElement>(".reveal")
          .forEach((el) =>
            gsap.from(el, {
              y: 32,
              opacity: 0.3,
              duration: 0.8,
              ease: "power3.out",
              scrollTrigger: { trigger: el, start: "top 90%" },
            }),
          );
      }, root);
      return () => {
        ctx.revert();
        lenis.destroy();
        gsap.ticker.remove(tick);
      };
    });
    media.add(
      "(min-width: 960px) and (prefers-reduced-motion: no-preference)",
      () => {
        const ctx = gsap.context(() => {
          ScrollTrigger.create({
            trigger: ".workflow-heading",
            start: "top 25%",
            endTrigger: ".workflow-steps",
            end: "bottom 70%",
            pin: true,
            pinSpacing: false,
          });
          gsap.utils.toArray<HTMLElement>(".workflow-step").forEach((el, i) => {
            if (i < 2)
              gsap.to(el, {
                scale: 0.94,
                opacity: 0.35,
                scrollTrigger: {
                  trigger: el,
                  start: "top 30%",
                  end: "bottom 15%",
                  scrub: true,
                },
              });
          });
        }, root);
        return () => ctx.revert();
      },
    );
    return () => media.revert();
  }, []);
  return (
    <div className="landing" ref={root}>
      <a className="skip-link" href="#content">
        Skip to content
      </a>
      <header className="landing-nav wrap">
        <Brand />
        <nav
          className={mobile ? "nav-links open" : "nav-links"}
          aria-label="Main navigation"
        >
          <a href="#platform" onClick={() => setMobile(false)}>
            Platform
          </a>
          <a href="#workflow" onClick={() => setMobile(false)}>
            How it works
          </a>
          <a href={REPO} target="_blank" rel="noreferrer">
            Open source <ArrowUpRight size={13} />
          </a>
        </nav>
        <div className="nav-actions">
          <Link to="/login" className="sign-in">
            Sign in
          </Link>
          <Link to="/app?demo=1" className="button nav-cta">
            Open workspace <ArrowUpRight size={15} />
          </Link>
          <button
            className="icon-button menu-toggle"
            onClick={() => setMobile(!mobile)}
            aria-label={mobile ? "Close menu" : "Open menu"}
            aria-expanded={mobile}
          >
            {mobile ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <main id="content">
        <section className="hero">
          <div className="hero-copy wrap">
            <h1>
              See the signal.
              <br />
              <span>Own the response.</span>
            </h1>
            <p>
              Your services are connected. Your response should be, too.
              <br className="desktop-break" /> The open-source workspace for
              everything after deploy.
            </p>
            <div className="hero-buttons">
              <Link className="button primary" to="/app?demo=1">
                Explore the live demo <ArrowUpRight size={17} />
              </Link>
              <a
                className="button secondary"
                href={REPO}
                target="_blank"
                rel="noreferrer"
              >
                <Github size={17} /> View on GitHub
              </a>
            </div>
          </div>
          <div className="hero-art">
            <Constellation />
            <div className="orb-label label-one">
              <span className="signal-dot" /> edge-api <span>connected</span>
            </div>
            <div className="orb-label label-two">
              <span className="signal-dot amber" /> event-pipeline{" "}
              <span>needs attention</span>
            </div>
            <div className="orb-label label-three">
              <span className="signal-dot" /> auth-service{" "}
              <span>connected</span>
            </div>
            <div className="orb-caption">
              A connected view of your services{" "}
              <span>Illustrative topology</span>
            </div>
          </div>
          <div className="hero-bottom wrap">
            <div>
              <span className="tiny-dot" /> BUILT FOR THE MOMENTS THAT MATTER
            </div>
            <a href="#platform" aria-label="Discover Vigil">
              <ArrowDown size={17} />
              <span>Scroll to discover</span>
            </a>
          </div>
        </section>
        <div className="stack-strip">
          <div className="wrap">
            <span>
              Open by design.
              <br />
              <strong>Yours by default.</strong>
            </span>
            <div className="stack-track">
              <span>
                <Terminal /> Python
              </span>
              <span>
                <Command /> React
              </span>
              <span>
                <ShieldCheck /> PostgreSQL
              </span>
              <span>
                <Workflow /> Kubernetes
              </span>
              <span>
                <Activity /> Prometheus
              </span>
            </div>
          </div>
        </div>
        <section id="platform" className="platform section-space wrap">
          <div className="section-intro reveal">
            <h2>
              Less noise.
              <br />
              <span>More knowing.</span>
            </h2>
            <p>
              A failed request is a signal. A missed handoff is a problem.
              <br />
              Bring monitoring, incident response, and the work that follows
              into one clear view.
            </p>
          </div>
          <div className="product-preview reveal">
            <div className="preview-top">
              <Brand />
              <div>
                <span className="signal-dot" /> Your workspace, at a glance
              </div>
              <span className="sample-label">Sample workspace</span>
            </div>
            <div className="preview-body">
              <aside className="preview-sidebar">
                <div className="selected">
                  <Activity size={16} /> Overview
                </div>
                <div>
                  <Radio size={16} /> Services
                </div>
                <div>
                  <Globe2 size={16} /> Incidents
                </div>
                <div>
                  <Check size={16} /> Recovery tasks
                </div>
                <span className="preview-sidebar-bottom">
                  CALM, EVEN WHEN IT ISN’T.
                </span>
              </aside>
              <div className="preview-content">
                <div className="preview-heading">
                  <div>
                    <span>WORKSPACE OVERVIEW</span>
                    <h3>The whole picture.</h3>
                  </div>
                  <span className="sample-label">Demo data</span>
                </div>
                <div className="preview-metrics">
                  <div>
                    <span>Services connected</span>
                    <strong>
                      4 <small>/ 4</small>
                    </strong>
                  </div>
                  <div>
                    <span>Open incident</span>
                    <strong className="warm">
                      1 <small>investigating</small>
                    </strong>
                  </div>
                  <div>
                    <span>Recovery tasks</span>
                    <strong>
                      3 <small>open</small>
                    </strong>
                  </div>
                </div>
                <div className="preview-table">
                  {[
                    "Edge API",
                    "Authentication",
                    "Event pipeline",
                    "Dashboard",
                  ].map((name, i) => (
                    <div key={name}>
                      <span>
                        <span
                          className={`signal-dot ${i === 2 ? "amber" : ""}`}
                        />
                        {name}
                      </span>
                      <div className="uptime-bars">
                        {Array.from({ length: 32 }, (_, j) => (
                          <i
                            key={j}
                            className={
                              i === 2 && j > 23 && j < 28 ? "warning" : ""
                            }
                          />
                        ))}
                      </div>
                      <span className={i === 2 ? "warm" : "muted"}>
                        {i === 2 ? "Degraded" : "Operational"}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="preview-incident">
                  <span className="signal-dot amber" />
                  <div>
                    <strong>Elevated event processing latency</strong>
                    <span>Investigating · Event pipeline</span>
                  </div>
                  <ArrowUpRight size={18} />
                </div>
              </div>
            </div>
            <Link to="/app?demo=1" className="preview-open">
              Open the interactive workspace <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="capabilities">
            {capabilities.map(({ title, text, icon: Icon }) => (
              <article key={title} className="reveal">
                <Icon size={23} />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section id="workflow" className="workflow section-space wrap">
          <div className="workflow-heading">
            <h2>
              From first signal
              <br />
              to <span>last loose end.</span>
            </h2>
            <p>
              Built around the work.
              <br />
              Not just the alert.
            </p>
            <Link to="/app?demo=1" className="text-link">
              Try the full workflow <ArrowRight size={17} />
            </Link>
          </div>
          <div className="workflow-steps">
            <article className="workflow-step">
              <div className="step-graphic monitor-graphic">
                <div className="pulse-line">
                  <svg viewBox="0 0 400 100">
                    <path d="M0 55H70L86 48l12 13 19-15 21 10h41l13-33 16 58 17-62 17 47 16-13H400" />
                  </svg>
                </div>
                <span>
                  <span className="signal-dot" /> HTTPS check complete
                </span>
                <div className="graphic-meta">
                  <span>RESPONSE RECEIVED</span>
                  <span>CHECK HISTORY SAVED</span>
                </div>
              </div>
              <div className="step-copy">
                <span>OBSERVE</span>
                <h3>Know what needs you.</h3>
                <p>
                  Connect a service. Run a real check. See response time and
                  availability without digging through a wall of logs.
                </p>
              </div>
            </article>
            <article className="workflow-step">
              <div className="step-graphic timeline-graphic">
                <div>
                  <span className="timeline-node amber" />
                  <span>
                    Investigating
                    <small>The first signal becomes an incident.</small>
                  </span>
                </div>
                <div>
                  <span className="timeline-node blue" />
                  <span>
                    Identified<small>The cause becomes clear.</small>
                  </span>
                </div>
                <div>
                  <span className="timeline-node" />
                  <span>
                    Resolved<small>The record stays with you.</small>
                  </span>
                </div>
              </div>
              <div className="step-copy">
                <span>RESPOND</span>
                <h3>One incident. One shared story.</h3>
                <p>
                  Capture severity, add a timeline update, and track the
                  response from investigation to resolution.
                </p>
              </div>
            </article>
            <article className="workflow-step">
              <div className="step-graphic task-graphic">
                <div>
                  <Check size={16} />
                  <span>Restore healthy event processing</span>
                </div>
                <div>
                  <Check size={16} />
                  <span>Document the root cause</span>
                </div>
                <div>
                  <span className="empty-check" />
                  <span>Prevent the next recurrence</span>
                  <ArrowUpRight size={16} />
                </div>
                <div className="export-mini">
                  <Terminal size={16} /> postmortem.md{" "}
                  <span>Ready to export</span>
                </div>
              </div>
              <div className="step-copy">
                <span>IMPROVE</span>
                <h3>Recovery is just the beginning.</h3>
                <p>
                  Link follow-up tasks, export a timeline-based postmortem, and
                  give the next incident a better ending.
                </p>
              </div>
            </article>
          </div>
        </section>
        <section className="ownership section-space">
          <div className="wrap">
            <div className="ownership-copy reveal">
              <Github size={32} />
              <h2>
                Your infrastructure.
                <br />
                Your data. <span>Your call.</span>
              </h2>
              <p>
                No black boxes. No lock-in. Read every line, run it on your own
                infrastructure, and take your data with you.
              </p>
              <a
                className="button secondary"
                href={REPO}
                target="_blank"
                rel="noreferrer"
              >
                Explore the source <ArrowUpRight size={17} />
              </a>
            </div>
            <div className="code-window reveal">
              <div className="code-header">
                <span>
                  <i />
                  <i />
                  <i />
                </span>
                <span>get-started.sh</span>
              </div>
              <pre>
                <span className="code-comment">
                  # Your workspace. Your machine.
                </span>
                {"\n"}
                <span className="code-blue">git clone</span>{" \\\n"}
                {"  https://github.com/ReaperXD67/vigil.git\n\n"}
                <span className="code-blue">cd</span> vigil{"\n"}
                <span className="code-blue">cp</span> .env.example .env{"\n"}
                <span className="code-comment">
                  # Set a database password in .env
                </span>
                {"\n"}
                <span className="code-blue">docker compose</span> up --build -d
                {"\n\n"}
                <span className="code-comment">
                  # Open http://localhost:3000
                </span>
              </pre>
              <div className="code-footer">
                <ShieldCheck size={14} /> MIT licensed{" "}
                <span>Self-host ready</span>
              </div>
            </div>
          </div>
        </section>
        <section className="faq-section section-space wrap">
          <div>
            <h2>
              A little more
              <br />
              <span>signal.</span>
            </h2>
            <p>Things you might be wondering.</p>
          </div>
          <div className="faq-list">
            {faq.map(([q, a], i) => (
              <div
                className={active === i ? "faq-item active" : "faq-item"}
                key={q}
              >
                <button
                  aria-expanded={active === i}
                  aria-controls={`faq-${i}`}
                  onClick={() => setActive(active === i ? -1 : i)}
                >
                  {q}
                  <ChevronDown size={18} />
                </button>
                <div id={`faq-${i}`} hidden={active !== i}>
                  <p>{a}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="final-cta wrap">
          <motion.div initial={false} whileInView={{ opacity: 1 }}>
            <div className="cta-orbit" aria-hidden="true" />
            <h2>
              Stay ahead
              <br />
              of <span>what’s next.</span>
            </h2>
            <p>Your next deploy deserves a clearer view.</p>
            <Link className="button primary" to="/app?demo=1">
              Step inside Vigil <ArrowUpRight size={18} />
            </Link>
            <span className="no-card">No sign-up needed for the demo.</span>
          </motion.div>
        </section>
      </main>
      <footer className="landing-footer wrap">
        <Brand />
        <span>Keep your services in sight.</span>
        <div>
          <a href={REPO} target="_blank" rel="noreferrer">
            GitHub <ArrowUpRight size={13} />
          </a>
          <a
            href={`${REPO}/blob/main/docs/CONTRIBUTING.md`}
            target="_blank"
            rel="noreferrer"
          >
            Contribute
          </a>
          <Link to="/login">Workspace</Link>
        </div>
        <span className="footer-license">Open source · MIT</span>
      </footer>
    </div>
  );
}
