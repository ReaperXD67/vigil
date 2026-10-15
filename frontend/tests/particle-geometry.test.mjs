import test from "node:test";
import assert from "node:assert/strict";
import {
  PARTICLE_SHAPES,
  createParticleGeometry,
  createFilamentGeometry,
  interpolateGeometry,
  morphProgress,
  fitParticleCamera,
} from "../src/components/particleGeometry.ts";

for (const shape of PARTICLE_SHAPES) {
  test(`${shape} produces deterministic, finite, bounded particles`, () => {
    const first = createParticleGeometry(shape, 10400);
    const second = createParticleGeometry(shape, 10400);
    assert.equal(first.length, 31200);
    assert.deepEqual(first, second);
    assert.ok(
      first.every((value) => Number.isFinite(value) && Math.abs(value) < 2),
    );
    const extent = [0, 1, 2].map(
      (axis) =>
        Math.max(...first.filter((_, i) => i % 3 === axis)) -
        Math.min(...first.filter((_, i) => i % 3 === axis)),
    );
    assert.ok(
      extent.every((value) => value > 0.5),
      `${shape} must have real depth in all three axes`,
    );
  });
  test(`${shape} filaments have consistent morph-compatible bounds`, () => {
    const lines = createFilamentGeometry(shape);
    assert.equal(lines.length, 720 * 6);
    assert.ok(
      lines.every((value) => Number.isFinite(value) && Math.abs(value) < 2),
    );
  });
}

test("morphing is exact at endpoints and interruption preserves current positions", () => {
  const from = createParticleGeometry("spiral", 100);
  const to = createParticleGeometry("tree", 100);
  assert.deepEqual(interpolateGeometry(from, to, 0), from);
  assert.deepEqual(interpolateGeometry(from, to, 1), to);
  const interrupted = interpolateGeometry(from, to, 0.4);
  assert.deepEqual(
    interpolateGeometry(interrupted, createParticleGeometry("cube", 100), 0),
    interrupted,
  );
  assert.ok(interrupted.every(Number.isFinite));
  assert.equal(morphProgress(-2), 0);
  assert.equal(morphProgress(3), 1);
});

test("invalid counts and incompatible geometries fail explicitly", () => {
  for (const count of [0, -1, 1.5, 50001])
    assert.throws(() => createParticleGeometry("cube", count), RangeError);
  assert.throws(
    () => interpolateGeometry(new Float32Array(3), new Float32Array(6), 0.5),
    RangeError,
  );
  assert.throws(() => createFilamentGeometry("orbit", 0), RangeError);
});

test("camera keeps every shape and morph inside the canvas and clear of controls", () => {
  const geometries = PARTICLE_SHAPES.map((shape) =>
    createParticleGeometry(shape, 10400),
  );
  const filaments = PARTICLE_SHAPES.map((shape) =>
    createFilamentGeometry(shape),
  );
  for (let shape = 0; shape < PARTICLE_SHAPES.length; shape++) {
    const next = (shape + 1) % PARTICLE_SHAPES.length;
    for (const aspect of [0.72, 1, 2.2]) {
      for (const [yaw, pitch] of [
        [0.36, -0.28],
        [0, -1.05],
        [Math.PI / 2, 1.05],
        [Math.PI, 0.7],
        [Math.PI * 1.5, -0.8],
      ]) {
        for (const blend of [0, 0.5, 1.06, 1]) {
          const scale = fitParticleCamera(
            geometries[shape],
            geometries[next],
            blend,
            yaw,
            pitch,
            aspect,
            filaments[shape],
            filaments[next],
          );
          assert.ok(Number.isFinite(scale) && scale > 0 && scale <= 0.75);
          for (const [from, to] of [
            [geometries[shape], geometries[next]],
            [filaments[shape], filaments[next]],
          ]) {
            for (let i = 0; i < from.length; i += 3) {
              const x = from[i] + (to[i] - from[i]) * blend;
              const y = from[i + 1] + (to[i + 1] - from[i + 1]) * blend;
              const z = from[i + 2] + (to[i + 2] - from[i + 2]) * blend;
              const rx = x * Math.cos(yaw) + z * Math.sin(yaw);
              const rz = -x * Math.sin(yaw) + z * Math.cos(yaw);
              const ry = y * Math.cos(pitch) - rz * Math.sin(pitch);
              const depth = y * Math.sin(pitch) + rz * Math.cos(pitch);
              const projection = 4.2 / (4.2 - depth);
              assert.ok(
                Math.abs((rx * projection * scale) / aspect) <=
                  0.88 - 0.12 / aspect + 1e-7,
              );
              assert.ok(Math.abs(ry * projection * scale) <= 0.600001);
            }
          }
        }
      }
    }
  }
});
