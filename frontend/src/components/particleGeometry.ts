/** Original, deterministic sculpture geometry. These points are art, never telemetry. */
export const PARTICLE_SHAPES = ["spiral", "cube", "tree", "orbit"] as const;
export type ParticleShape = (typeof PARTICLE_SHAPES)[number];
type Point = [number, number, number];
type Branch = { start: Point; end: Point; depth: number };
const TAU = Math.PI * 2;
const GOLDEN_ANGLE = 2.399963229728653;

export function randomAt(index: number, salt = 0): number {
  let value = (index + 1 + salt * 374761393) | 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

function normalize(point: Point): Point {
  const length = Math.hypot(...point) || 1;
  return point.map((value) => value / length) as Point;
}

function mix(a: Point, b: Point, t: number): Point {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function treeBranches(): Branch[] {
  const branches: Branch[] = [];
  const grow = (
    start: Point,
    direction: Point,
    length: number,
    depth: number,
    seed: number,
  ) => {
    const end = start.map(
      (value, axis) => value + direction[axis] * length,
    ) as Point;
    branches.push({ start, end, depth });
    if (depth === 5) return;
    const children = depth === 0 ? 4 : 2;
    for (let child = 0; child < children; child++) {
      const angle =
        depth === 0
          ? (child * TAU) / 4 + 0.4
          : seed * GOLDEN_ANGLE + child * Math.PI + depth * 0.7;
      const spread = depth === 0 ? 0.86 : 0.52;
      const next: Point = normalize([
        direction[0] * 0.67 + Math.cos(angle) * spread,
        0.61 + randomAt(seed + child, depth) * 0.22,
        direction[2] * 0.67 + Math.sin(angle) * spread,
      ]);
      grow(
        end,
        next,
        length * (depth === 0 ? 0.88 : 0.72),
        depth + 1,
        seed * 3 + child + 1,
      );
    }
  };
  grow([0, -1.08, 0], [0.035, 1, 0], 0.66, 0, 7);
  return branches;
}

const BRANCHES = treeBranches();
const LEAVES = BRANCHES.filter((branch) => branch.depth === 5);
const BRANCH_WEIGHTS = BRANCHES.map(
  (branch) =>
    Math.hypot(...branch.end.map((value, axis) => value - branch.start[axis])) *
    (branch.depth === 0 ? 2.4 : 1),
);
const TOTAL_WEIGHT = BRANCH_WEIGHTS.reduce((sum, value) => sum + value, 0);

function weightedBranch(value: number): Branch {
  let target = value * TOTAL_WEIGHT;
  for (let i = 0; i < BRANCHES.length; i++) {
    target -= BRANCH_WEIGHTS[i];
    if (target <= 0) return BRANCHES[i];
  }
  return BRANCHES[BRANCHES.length - 1];
}

function spiralPoint(t: number, arm: number): Point {
  const radius = 0.065 + Math.sqrt(t) * 1.24;
  const angle = (arm * TAU) / 3 + (1 - Math.sqrt(t)) * 9.4;
  return [
    Math.cos(angle) * radius,
    Math.sin(angle) * radius * 0.58,
    Math.sin(angle) * radius * 0.55 + (1 - t) * 0.29 * Math.cos(t * 4),
  ];
}

function cubeEdge(edge: number, t: number): Point {
  const axis = Math.floor(edge / 4);
  const side = edge % 4;
  const values: Point = [0, 0, 0];
  values[axis] = (t * 2 - 1) * 0.82;
  values[(axis + 1) % 3] = side & 1 ? 0.82 : -0.82;
  values[(axis + 2) % 3] = side & 2 ? 0.82 : -0.82;
  return values;
}

function orbitPoint(t: number, ring: number): Point {
  const angle = t * TAU;
  const radius = 1.3 + ring * 0.025;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  const tilt = [-0.3, 0.64, 1.06][ring % 3];
  const twist = ring * 0.73;
  return [
    x * Math.cos(twist) + z * Math.sin(tilt) * Math.sin(twist),
    z * Math.cos(tilt),
    -x * Math.sin(twist) + z * Math.sin(tilt) * Math.cos(twist),
  ];
}

export function createParticleGeometry(
  shape: ParticleShape,
  count: number,
): Float32Array {
  if (!Number.isInteger(count) || count < 1 || count > 50000)
    throw new RangeError("Particle count must be an integer from 1 to 50000.");
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = randomAt(i, 1),
      b = randomAt(i, 2),
      c = randomAt(i, 3);
    let point: Point;
    if (shape === "spiral") {
      point = spiralPoint(a, i % 3);
      const width = 0.015 + a * 0.055;
      const angle = b * TAU;
      point[0] += Math.cos(angle) * width * c;
      point[1] += Math.sin(angle) * width * c;
      point[2] += (randomAt(i, 4) - 0.5) * (0.04 + a * 0.14);
      // A dense nucleus and sparse halo make the spiral a volume, not a flat logo.
      if (i % 11 === 0) {
        const r = Math.cbrt(a) * 0.15;
        const z = c * 2 - 1;
        point = [
          Math.sqrt(1 - z * z) * Math.cos(b * TAU) * r,
          z * r,
          Math.sqrt(1 - z * z) * Math.sin(b * TAU) * r + 0.2,
        ];
      }
    } else if (shape === "cube") {
      if (i % 5 < 2) {
        point = cubeEdge(i % 12, a);
        const jitter = 0.012;
        point = point.map(
          (value, axis) => value + (randomAt(i, axis + 8) - 0.5) * jitter,
        ) as Point;
      } else {
        const face = i % 6;
        point = [(a * 2 - 1) * 0.82, (b * 2 - 1) * 0.82, (c * 2 - 1) * 0.82];
        point[Math.floor(face / 2)] = face % 2 ? 0.82 : -0.82;
        // Fine interior lattices lend the cube a crystalline, architectural depth.
        if (i % 9 === 0) point = point.map((value) => value * 0.66) as Point;
      }
    } else if (shape === "tree") {
      if (i % 10 < 7) {
        const branch = weightedBranch(a);
        point = mix(branch.start, branch.end, b);
        const radius = (0.042 / (1 + branch.depth * 0.8)) * (1 - b * 0.4);
        const angle = c * TAU;
        point[0] += Math.cos(angle) * radius;
        point[2] += Math.sin(angle) * radius;
        point[1] += (randomAt(i, 5) - 0.5) * radius;
      } else {
        const leaf = LEAVES[Math.floor(a * LEAVES.length)];
        const radius = Math.cbrt(b) * 0.105;
        const angle = c * TAU;
        const z = randomAt(i, 4) * 2 - 1;
        point = [
          leaf.end[0] + Math.cos(angle) * Math.sqrt(1 - z * z) * radius,
          leaf.end[1] + z * radius * 0.6,
          leaf.end[2] + Math.sin(angle) * Math.sqrt(1 - z * z) * radius,
        ];
      }
      point[0] *= 1.12;
      point[2] *= 1.12;
      point[1] -= 0.08;
    } else {
      if (i % 10 < 3) {
        point = orbitPoint(a, i % 3);
        point = point.map(
          (value, axis) => value + (randomAt(i, axis + 5) - 0.5) * 0.018,
        ) as Point;
      } else {
        const y = a * 2 - 1;
        const radius = Math.sqrt(1 - y * y);
        const theta = i * GOLDEN_ANGLE;
        point = [
          Math.cos(theta) * radius * 0.91,
          y * 0.91,
          Math.sin(theta) * radius * 0.91,
        ];
      }
    }
    positions.set(point, i * 3);
  }
  return positions;
}

/** Equal-sized segment buffers allow the luminous filaments to morph with the dots. */
export function createFilamentGeometry(
  shape: ParticleShape,
  segments = 720,
): Float32Array {
  if (!Number.isInteger(segments) || segments < 12 || segments > 5000)
    throw new RangeError(
      "Filament segments must be an integer from 12 to 5000.",
    );
  const positions = new Float32Array(segments * 6);
  for (let i = 0; i < segments; i++) {
    let start: Point, end: Point;
    if (shape === "tree") {
      const branch = BRANCHES[i % BRANCHES.length];
      const subsegment = Math.floor(i / BRANCHES.length);
      const divisions = Math.ceil(
        (segments - (i % BRANCHES.length)) / BRANCHES.length,
      );
      start = mix(branch.start, branch.end, subsegment / divisions);
      end = mix(branch.start, branch.end, (subsegment + 1) / divisions);
      start = [start[0] * 1.12, start[1] - 0.08, start[2] * 1.12];
      end = [end[0] * 1.12, end[1] - 0.08, end[2] * 1.12];
    } else {
      const paths = shape === "cube" ? 12 : 3;
      const path = i % paths;
      const divisions = Math.ceil((segments - path) / paths);
      const part = Math.floor(i / paths);
      const formula =
        shape === "cube"
          ? cubeEdge
          : shape === "spiral"
            ? (arm: number, t: number) => spiralPoint(t, arm)
            : (ring: number, t: number) => orbitPoint(t, ring);
      start = formula(path, part / divisions);
      end = formula(path, (part + 1) / divisions);
    }
    positions.set([...start, ...end], i * 6);
  }
  return positions;
}

export function morphProgress(progress: number): number {
  const t = Math.min(1, Math.max(0, progress));
  // Critically damped-looking arrival, with a small, deliberate final settle.
  return t === 1 ? 1 : 1 - Math.exp(-7.5 * t) * Math.cos(7.5 * t);
}

export function interpolateGeometry(
  from: Float32Array,
  to: Float32Array,
  progress: number,
): Float32Array {
  if (from.length !== to.length)
    throw new RangeError("Geometry sizes must match.");
  const output = new Float32Array(from.length);
  const blend = morphProgress(progress);
  for (let i = 0; i < from.length; i++)
    output[i] = from[i] + (to[i] - from[i]) * blend;
  return output;
}

/** Fit the current projection, including interrupted morphs, above the controls.
 * Scanning positions avoids a coarse bounding sphere shrinking the flat spiral.
 * Rendering, point shading, and morph interpolation still run on the GPU.
 */
export function fitParticleCamera(
  from: Float32Array,
  to: Float32Array,
  blend: number,
  yaw: number,
  pitch: number,
  aspect: number,
  linesFrom: Float32Array,
  linesTo: Float32Array,
): number {
  const cy = Math.cos(yaw),
    sy = Math.sin(yaw),
    cp = Math.cos(pitch),
    sp = Math.sin(pitch);
  let extentX = 0.001,
    extentY = 0.001;
  const measure = (a: Float32Array, b: Float32Array) => {
    for (let i = 0; i < a.length; i += 3) {
      const x = a[i] + (b[i] - a[i]) * blend,
        y = a[i + 1] + (b[i + 1] - a[i + 1]) * blend,
        z = a[i + 2] + (b[i + 2] - a[i + 2]) * blend;
      const rotatedX = x * cy + z * sy,
        rotatedZ = -x * sy + z * cy,
        rotatedY = y * cp - rotatedZ * sp,
        depth = y * sp + rotatedZ * cp,
        perspective = 4.2 / (4.2 - depth);
      extentX = Math.max(extentX, Math.abs(rotatedX * perspective));
      extentY = Math.max(extentY, Math.abs(rotatedY * perspective));
    }
  };
  measure(from, to);
  measure(linesFrom, linesTo);
  // A 0.12 NDC allowance covers the pointer ripple, breathing, and point halos.
  // With centerY=0.18 this keeps the bottom 23% available for the controls.
  return Math.min(
    0.75,
    aspect * 0.68,
    0.6 / extentY,
    Math.max(0.01, aspect * 0.88 - 0.12) / extentX,
  );
}
