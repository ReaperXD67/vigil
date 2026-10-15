import { useEffect, useId, useRef, useState } from "react";
import {
  Atom,
  Box,
  GitBranch,
  MousePointer2,
  Orbit,
  Pause,
  Play,
} from "lucide-react";
import {
  PARTICLE_SHAPES,
  createFilamentGeometry,
  createParticleGeometry,
  fitParticleCamera,
  interpolateGeometry,
  morphProgress,
  randomAt,
  type ParticleShape,
} from "./particleGeometry";
import "./particle.css";

const SHAPES = [
  { id: "spiral", label: "Spiral", icon: Atom },
  { id: "cube", label: "Cube", icon: Box },
  { id: "tree", label: "Tree", icon: GitBranch },
  { id: "orbit", label: "Orbit", icon: Orbit },
] as const;
const MORPH_SECONDS = 1.65;
type Frame = {
  width: number;
  height: number;
  dpr: number;
  time: number;
  blend: number;
  yaw: number;
  pitch: number;
  pointerX: number;
  pointerY: number;
  pointerActive: number;
  burst: number;
  motion: number;
  scale: number;
};
type Renderer = {
  update: (
    a: Float32Array,
    b: Float32Array,
    c: Float32Array,
    d: Float32Array,
  ) => void;
  draw: (frame: Frame) => void;
  destroy: () => void;
};
type Controller = {
  choose: (shape: ParticleShape) => void;
  refresh: () => void;
  rotate: (x: number, y: number) => void;
};

const VERTEX = `
precision highp float;
attribute vec3 aFrom;
attribute vec3 aTo;
attribute float aSeed;
uniform float uBlend, uTime, uYaw, uPitch, uAspect, uScale, uDpr, uPointerActive, uBurst, uMotion;
uniform mediump float uLine;
uniform vec2 uPointer;
varying mediump float vAlpha;
varying mediump vec3 vColor;
void main() {
  vec3 p = mix(aFrom, aTo, uBlend);
  p *= 1.0 + sin(uTime * 0.55 + aSeed * 3.0) * 0.006 * uMotion;
  float cy = cos(uYaw), sy = sin(uYaw), cp = cos(uPitch), sp = sin(uPitch);
  vec3 r = vec3(p.x * cy + p.z * sy, p.y, -p.x * sy + p.z * cy);
  r = vec3(r.x, r.y * cp - r.z * sp, r.y * sp + r.z * cp);
  float perspective = 4.2 / (4.2 - r.z);
  vec2 screen = r.xy * perspective * uScale;
  screen.x /= uAspect;
  screen.y += 0.18;
  vec2 delta = (screen - uPointer) * vec2(uAspect, 1.0);
  float distance = length(delta);
  vec2 direction = delta / max(distance, 0.001);
  float repel = exp(-distance * distance * 20.0) * 0.065 * uPointerActive;
  float wave = sin(distance * 17.0 - uBurst * 7.0) * exp(-uBurst * 2.6) * 0.045;
  screen += direction * (repel + wave) * vec2(1.0 / uAspect, 1.0) * uMotion;
  gl_Position = vec4(screen, r.z * -0.12, 1.0);
  float front = clamp((r.z + 1.5) / 3.0, 0.0, 1.0);
  float star = pow(aSeed, 16.0);
  gl_PointSize = (2.1 + front * 1.5 + star * 3.1) * uDpr * perspective;
  vAlpha = (0.38 + front * 0.62) * (0.86 + 0.14 * sin(aSeed * 41.0 + uTime * 0.7));
  vColor = mix(vec3(0.20, 0.48, 0.81), vec3(0.77, 0.94, 1.0), front * 0.58 + star * 0.42);
  if (uLine > 0.5) { vAlpha = 0.15 + front * 0.25; vColor = vec3(0.49, 0.78, 1.0); }
}`;
const FRAGMENT = `
precision mediump float;
uniform mediump float uLine;
varying mediump float vAlpha;
varying mediump vec3 vColor;
void main() {
  if (uLine > 0.5) { gl_FragColor = vec4(vColor, vAlpha); return; }
  float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;
  if (radius > 1.0) discard;
  float halo = pow(1.0 - radius, 1.7);
  float core = 1.0 - smoothstep(0.0, 0.33, radius);
  gl_FragColor = vec4(vColor + vec3(core * 0.3), (halo * 0.8 + core * 0.55) * vAlpha);
}`;

function webglRenderer(
  canvas: HTMLCanvasElement,
  count: number,
): Renderer | null {
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    depth: false,
    premultipliedAlpha: false,
    powerPreference: "low-power",
  });
  if (!gl) return null;
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn(
        "Vigil particle shader could not compile:",
        gl.getShaderInfoLog(shader),
      );
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };
  const vertex = compile(gl.VERTEX_SHADER, VERTEX),
    fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT),
    program = gl.createProgram();
  if (!vertex || !fragment || !program) {
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    gl.deleteProgram(program);
    return null;
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn(
      "Vigil particle shaders could not link:",
      gl.getProgramInfoLog(program),
    );
    gl.deleteProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    return null;
  }
  gl.useProgram(program);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  gl.disable(gl.DEPTH_TEST);
  const attributes = ["aFrom", "aTo", "aSeed"].map((name) =>
    gl.getAttribLocation(program, name),
  );
  const names = [
    "uBlend",
    "uTime",
    "uYaw",
    "uPitch",
    "uAspect",
    "uScale",
    "uDpr",
    "uPointer",
    "uPointerActive",
    "uBurst",
    "uMotion",
    "uLine",
  ] as const;
  const uniforms = Object.fromEntries(
    names.map((name) => [name, gl.getUniformLocation(program, name)]),
  ) as Record<(typeof names)[number], WebGLUniformLocation | null>;
  const buffers = Array.from({ length: 6 }, () => gl.createBuffer());
  if (buffers.some((buffer) => !buffer)) {
    buffers.forEach((buffer) => gl.deleteBuffer(buffer));
    gl.deleteProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    return null;
  }
  let lineCount = 0;
  const upload = (
    buffer: WebGLBuffer | null,
    values: Float32Array,
    usage: number,
  ) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, values, usage);
  };
  upload(
    buffers[2],
    Float32Array.from({ length: count }, (_, i) => randomAt(i, 20)),
    gl.STATIC_DRAW,
  );
  const bind = (offset: number) => {
    for (let i = 0; i < 3; i++) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffers[offset + i]);
      gl.enableVertexAttribArray(attributes[i]);
      gl.vertexAttribPointer(
        attributes[i],
        i === 2 ? 1 : 3,
        gl.FLOAT,
        false,
        0,
        0,
      );
    }
  };
  return {
    update(from, to, linesFrom, linesTo) {
      upload(buffers[0], from, gl.DYNAMIC_DRAW);
      upload(buffers[1], to, gl.DYNAMIC_DRAW);
      upload(buffers[3], linesFrom, gl.DYNAMIC_DRAW);
      upload(buffers[4], linesTo, gl.DYNAMIC_DRAW);
      lineCount = linesFrom.length / 3;
      upload(
        buffers[5],
        new Float32Array(lineCount).fill(0.85),
        gl.STATIC_DRAW,
      );
    },
    draw(frame) {
      const aspect = frame.width / frame.height;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.uniform1f(uniforms.uBlend, frame.blend);
      gl.uniform1f(uniforms.uTime, frame.time);
      gl.uniform1f(uniforms.uYaw, frame.yaw);
      gl.uniform1f(uniforms.uPitch, frame.pitch);
      gl.uniform1f(uniforms.uAspect, aspect);
      gl.uniform1f(uniforms.uScale, frame.scale);
      gl.uniform1f(uniforms.uDpr, frame.dpr);
      gl.uniform2f(uniforms.uPointer, frame.pointerX, frame.pointerY);
      gl.uniform1f(uniforms.uPointerActive, frame.pointerActive);
      gl.uniform1f(uniforms.uBurst, frame.burst);
      gl.uniform1f(uniforms.uMotion, frame.motion);
      gl.uniform1f(uniforms.uLine, 1);
      bind(3);
      gl.drawArrays(gl.LINES, 0, lineCount);
      gl.uniform1f(uniforms.uLine, 0);
      bind(0);
      gl.drawArrays(gl.POINTS, 0, count);
    },
    destroy() {
      buffers.forEach((buffer) => gl.deleteBuffer(buffer));
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    },
  };
}

function canvasRenderer(canvas: HTMLCanvasElement): Renderer | null {
  const context = canvas.getContext("2d");
  if (!context) return null;
  let from: Float32Array = new Float32Array(),
    to: Float32Array = new Float32Array(),
    linesFrom: Float32Array = new Float32Array(),
    linesTo: Float32Array = new Float32Array();
  return {
    update(a, b, c, d) {
      from = a;
      to = b;
      linesFrom = c;
      linesTo = d;
    },
    draw(frame) {
      context.setTransform(frame.dpr, 0, 0, frame.dpr, 0, 0);
      context.clearRect(0, 0, frame.width, frame.height);
      const aspect = frame.width / frame.height,
        scale = frame.scale;
      const cy = Math.cos(frame.yaw),
        sy = Math.sin(frame.yaw),
        cp = Math.cos(frame.pitch),
        sp = Math.sin(frame.pitch);
      const project = (a: Float32Array, b: Float32Array, index: number) => {
        const x = a[index] + (b[index] - a[index]) * frame.blend,
          y = a[index + 1] + (b[index + 1] - a[index + 1]) * frame.blend,
          z = a[index + 2] + (b[index + 2] - a[index + 2]) * frame.blend;
        const xx = x * cy + z * sy,
          zz = -x * sy + z * cy,
          yy = y * cp - zz * sp,
          depth = y * sp + zz * cp,
          perspective = 4.2 / (4.2 - depth);
        let sx = (xx * perspective * scale) / aspect,
          syy = yy * perspective * scale + 0.18;
        const dx = (sx - frame.pointerX) * aspect,
          dy = syy - frame.pointerY,
          distance = Math.hypot(dx, dy) || 0.001;
        const force =
          (Math.exp(-distance * distance * 20) * 0.065 * frame.pointerActive +
            Math.sin(distance * 17 - frame.burst * 7) *
              Math.exp(-frame.burst * 2.6) *
              0.045) *
          frame.motion;
        sx += ((dx / distance) * force) / aspect;
        syy += (dy / distance) * force;
        return [
          ((sx + 1) * frame.width) / 2,
          ((1 - syy) * frame.height) / 2,
          Math.min(1, Math.max(0, (depth + 1.5) / 3)),
          perspective,
        ];
      };
      context.globalCompositeOperation = "lighter";
      context.strokeStyle = "rgba(117,192,255,.17)";
      context.lineWidth = 0.7;
      context.beginPath();
      for (let i = 0; i < linesFrom.length; i += 6) {
        const start = project(linesFrom, linesTo, i),
          end = project(linesFrom, linesTo, i + 3);
        context.moveTo(start[0], start[1]);
        context.lineTo(end[0], end[1]);
      }
      context.stroke();
      const stride = from.length > 24000 ? 6 : 3;
      for (let i = 0; i < from.length; i += stride) {
        const point = project(from, to, i),
          seed = randomAt(i / 3, 20),
          size = (0.65 + point[2] * 0.65 + Math.pow(seed, 16) * 1.2) * point[3];
        context.globalAlpha = 0.26 + point[2] * 0.66;
        context.fillStyle =
          seed > 0.92 ? "#e4f5ff" : seed > 0.5 ? "#86caff" : "#388bdb";
        context.fillRect(point[0] - size / 2, point[1] - size / 2, size, size);
      }
      context.globalAlpha = 1;
      context.globalCompositeOperation = "source-over";
    },
    destroy() {},
  };
}

export default function Constellation({
  compact = false,
}: {
  compact?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null),
    controller = useRef<Controller | null>(null);
  const [shape, setShape] = useState<ParticleShape>("spiral"),
    [paused, setPaused] = useState(false),
    [reduced, setReduced] = useState(false);
  const [force2D, setForce2D] = useState(false),
    [unavailable, setUnavailable] = useState(false);
  const [pointCount, setPointCount] = useState(0);
  const [density, setDensity] = useState(() =>
    typeof window !== "undefined" && window.innerWidth < 720 ? 7200 : 10400,
  );
  const shapeRef = useRef(shape),
    pausedRef = useRef(paused),
    descriptionId = useId();
  shapeRef.current = shape;
  pausedRef.current = paused;
  const cycle = () =>
    setShape(
      (previous) =>
        PARTICLE_SHAPES[
          (PARTICLE_SHAPES.indexOf(previous) + 1) % PARTICLE_SHAPES.length
        ],
    );

  useEffect(() => {
    const viewport = window.matchMedia("(max-width: 719px)");
    const change = () => setDensity(viewport.matches ? 7200 : 10400);
    viewport.addEventListener("change", change);
    return () => viewport.removeEventListener("change", change);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current!,
      media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const count = compact ? 2600 : density;
    setPointCount(count);
    const renderer = force2D
      ? canvasRenderer(canvas)
      : webglRenderer(canvas, count);
    if (!renderer && !force2D) {
      setForce2D(true);
      return;
    }
    if (!renderer) {
      setUnavailable(true);
      return;
    }
    const geometry = new Map(
      PARTICLE_SHAPES.map((name) => [
        name,
        createParticleGeometry(name, count),
      ]),
    );
    const filaments = new Map(
      PARTICLE_SHAPES.map((name) => [
        name,
        createFilamentGeometry(name, compact ? 300 : 720),
      ]),
    );
    let activeShape = shapeRef.current;
    let from = geometry.get(activeShape)!,
      to = from,
      linesFrom = filaments.get(activeShape)!,
      linesTo = linesFrom;
    let elapsed = MORPH_SECONDS,
      time = 0,
      burst = 20,
      lastTime = 0,
      animation = 0,
      visible = true,
      disposed = false;
    let width = 1,
      height = 1,
      dpr = 1,
      yaw = 0.36,
      pitch = -0.28,
      yawTarget = yaw,
      pitchTarget = pitch;
    let pointerX = 0,
      pointerY = 0,
      pointerActive = 0;
    let drag: {
      id: number;
      startX: number;
      startY: number;
      x: number;
      y: number;
      moved: boolean;
      touch: boolean;
    } | null = null;
    renderer.update(from, to, linesFrom, linesTo);
    const motionEnabled = () => !pausedRef.current && !media.matches;
    const draw = (timestamp: number) => {
      animation = 0;
      if (disposed || !visible || document.hidden) {
        lastTime = 0;
        return;
      }
      const delta = lastTime
        ? Math.min(0.04, (timestamp - lastTime) / 1000)
        : 0;
      lastTime = timestamp;
      if (motionEnabled()) {
        time += delta;
        elapsed = Math.min(MORPH_SECONDS, elapsed + delta);
        burst += delta;
        if (!drag) yawTarget += delta * (compact ? 0.045 : 0.055);
        const smoothing = 1 - Math.exp(-delta * 12);
        yaw += (yawTarget - yaw) * smoothing;
        pitch += (pitchTarget - pitch) * smoothing;
      } else {
        yaw = yawTarget;
        pitch = pitchTarget;
      }
      const blend = morphProgress(elapsed / MORPH_SECONDS);
      renderer.draw({
        width,
        height,
        dpr,
        time,
        blend,
        yaw,
        pitch,
        pointerX,
        pointerY,
        pointerActive,
        burst,
        motion: motionEnabled() ? 1 : 0,
        scale: fitParticleCamera(
          from,
          to,
          blend,
          yaw,
          pitch,
          width / height,
          linesFrom,
          linesTo,
        ),
      });
      if (motionEnabled()) animation = requestAnimationFrame(draw);
      else lastTime = 0;
    };
    const refresh = () => {
      if (!animation && !disposed && visible && !document.hidden)
        animation = requestAnimationFrame(draw);
    };
    const resize = () => {
      const box = canvas.getBoundingClientRect();
      width = Math.max(1, box.width);
      height = Math.max(1, box.height);
      dpr = Math.min(window.devicePixelRatio || 1, width < 720 ? 1.4 : 1.8);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      refresh();
    };
    controller.current = {
      choose(next) {
        if (next === activeShape) return;
        from = interpolateGeometry(from, to, elapsed / MORPH_SECONDS);
        linesFrom = interpolateGeometry(
          linesFrom,
          linesTo,
          elapsed / MORPH_SECONDS,
        );
        to = geometry.get(next)!;
        linesTo = filaments.get(next)!;
        elapsed = motionEnabled() ? 0 : MORPH_SECONDS;
        burst = 0;
        activeShape = next;
        renderer.update(from, to, linesFrom, linesTo);
        refresh();
      },
      refresh,
      rotate(x, y) {
        yawTarget += x;
        pitchTarget = Math.max(-1.05, Math.min(1.05, pitchTarget + y));
        refresh();
      },
    };
    const updatePointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointerX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerY = 1 - ((event.clientY - rect.top) / rect.height) * 2;
      pointerActive = event.pointerType === "touch" ? 0 : 1;
    };
    const down = (event: PointerEvent) => {
      if (compact || event.button !== 0) return;
      drag = {
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        x: event.clientX,
        y: event.clientY,
        moved: false,
        touch: event.pointerType === "touch",
      };
      if (!drag.touch) canvas.setPointerCapture(event.pointerId);
      updatePointer(event);
      canvas.classList.add("particle-canvas--dragging");
    };
    const move = (event: PointerEvent) => {
      if (compact) return;
      updatePointer(event);
      if (drag && drag.id === event.pointerId) {
        const totalX = event.clientX - drag.startX,
          totalY = event.clientY - drag.startY;
        if (Math.hypot(totalX, totalY) > 7) drag.moved = true;
        if (!drag.touch || Math.abs(totalX) > Math.abs(totalY)) {
          if (
            drag.touch &&
            Math.abs(totalX) > 7 &&
            !canvas.hasPointerCapture(event.pointerId)
          )
            canvas.setPointerCapture(event.pointerId);
          yawTarget += (event.clientX - drag.x) * 0.005;
          pitchTarget = Math.max(
            -1.05,
            Math.min(1.05, pitchTarget + (event.clientY - drag.y) * 0.0035),
          );
        }
        drag.x = event.clientX;
        drag.y = event.clientY;
      }
      refresh();
    };
    const up = (event: PointerEvent) => {
      if (!drag || drag.id !== event.pointerId) return;
      const clicked = !drag.moved && event.type !== "pointercancel";
      if (canvas.hasPointerCapture(event.pointerId))
        canvas.releasePointerCapture(event.pointerId);
      drag = null;
      canvas.classList.remove("particle-canvas--dragging");
      if (clicked) {
        burst = 0;
        setShape(
          (previous) =>
            PARTICLE_SHAPES[
              (PARTICLE_SHAPES.indexOf(previous) + 1) % PARTICLE_SHAPES.length
            ],
        );
      }
      refresh();
    };
    const leave = () => {
      pointerActive = 0;
      refresh();
    };
    const visibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(animation);
        animation = 0;
        lastTime = 0;
      } else refresh();
    };
    const preference = () => {
      setReduced(media.matches);
      if (media.matches) elapsed = MORPH_SECONDS;
      refresh();
    };
    const contextLost = (event: Event) => {
      event.preventDefault();
      setForce2D(true);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (!visible) {
          cancelAnimationFrame(animation);
          animation = 0;
          lastTime = 0;
        } else refresh();
      },
      { threshold: 0.02 },
    );
    observer.observe(canvas);
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move, { passive: true });
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("pointerleave", leave);
    canvas.addEventListener("webglcontextlost", contextLost);
    document.addEventListener("visibilitychange", visibility);
    media.addEventListener("change", preference);
    preference();
    resize();
    return () => {
      disposed = true;
      cancelAnimationFrame(animation);
      resizeObserver.disconnect();
      observer.disconnect();
      renderer.destroy();
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("pointerleave", leave);
      canvas.removeEventListener("webglcontextlost", contextLost);
      document.removeEventListener("visibilitychange", visibility);
      media.removeEventListener("change", preference);
      controller.current = null;
    };
  }, [compact, force2D, density]);
  useEffect(() => {
    controller.current?.choose(shape);
  }, [shape]);
  useEffect(() => {
    controller.current?.refresh();
  }, [paused]);

  return (
    <div
      className={`particle-experience${compact ? " particle-experience--compact" : ""}`}
      data-renderer={
        unavailable ? "unavailable" : force2D ? "canvas2d" : "webgl"
      }
      data-shape={shape}
      data-particle-count={pointCount}
      data-motion={reduced ? "reduced" : paused ? "paused" : "running"}
      aria-hidden={compact || undefined}
    >
      <canvas
        key={force2D ? "2d" : "webgl"}
        ref={canvasRef}
        className="particle-canvas"
        tabIndex={compact ? undefined : 0}
        role={compact ? "img" : "button"}
        aria-label={
          compact
            ? ""
            : `${SHAPES.find((item) => item.id === shape)?.label} particle sculpture. Press Enter to reshape; arrow keys rotate.`
        }
        aria-describedby={compact ? undefined : descriptionId}
        onKeyDown={(event) => {
          if (compact) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            cycle();
          }
          if (
            ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
              event.key,
            )
          ) {
            event.preventDefault();
            controller.current?.rotate(
              event.key === "ArrowLeft"
                ? -0.16
                : event.key === "ArrowRight"
                  ? 0.16
                  : 0,
              event.key === "ArrowUp"
                ? -0.12
                : event.key === "ArrowDown"
                  ? 0.12
                  : 0,
            );
          }
        }}
      />
      {unavailable && !compact && (
        <p className="particle-unavailable">
          The interactive sculpture is unavailable on this device.
        </p>
      )}
      {!compact && (
        <div className="particle-interface">
          <div
            className="particle-controls"
            role="group"
            aria-label="Particle sculpture controls"
          >
            <div
              className="particle-shapes"
              role="group"
              aria-label="Choose a particle shape"
            >
              {SHAPES.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  className={`particle-shape${shape === id ? " particle-shape--active" : ""}`}
                  aria-pressed={shape === id}
                  onClick={() => setShape(id)}
                >
                  <Icon size={15} strokeWidth={1.6} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
            <span className="particle-divider" aria-hidden="true" />
            <button
              type="button"
              className="particle-pause"
              disabled={reduced}
              onClick={() => setPaused((value) => !value)}
              aria-label={
                reduced
                  ? "Motion disabled by your reduced motion preference"
                  : paused
                    ? "Resume motion"
                    : "Pause motion"
              }
              title={
                reduced
                  ? "Your reduced motion preference is enabled"
                  : paused
                    ? "Resume motion"
                    : "Pause motion"
              }
            >
              {paused || reduced ? <Play size={14} /> : <Pause size={14} />}
              <span>
                {reduced ? "Motion off" : paused ? "Resume" : "Pause"}
              </span>
            </button>
          </div>
          <button
            type="button"
            id={descriptionId}
            className="particle-hint"
            onClick={cycle}
          >
            <MousePointer2 size={12} strokeWidth={1.6} />
            <span>
              Drag to rotate<span className="particle-hint-separator">·</span>
              Click to reshape
            </span>
          </button>
          <span className="particle-sr-only" role="status" aria-live="polite">
            {SHAPES.find((item) => item.id === shape)?.label} shape selected.{" "}
            {paused
              ? "Motion paused."
              : reduced
                ? "Reduced motion enabled."
                : ""}
          </span>
        </div>
      )}
    </div>
  );
}
