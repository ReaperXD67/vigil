import test from "node:test";
import assert from "node:assert/strict";
import {
  downstreamImpact,
  dependencyLayout,
} from "../src/components/topologyGraph.ts";

const link = (upstream_id, service_id) => ({ upstream_id, service_id });

test("blast radius follows upstream-to-dependent direction and shortest hops", () => {
  const edges = [
    link("auth", "api"),
    link("api", "events"),
    link("events", "web"),
  ];
  assert.deepEqual(
    downstreamImpact(["auth", "api", "events", "web"], edges, "api"),
    [
      { id: "events", hops: 1 },
      { id: "web", hops: 2 },
    ],
  );
  assert.deepEqual(
    downstreamImpact(["auth", "api", "events", "web"], edges, "web"),
    [],
  );
});

test("diamond paths and duplicate edges count a dependent once at its shortest distance", () => {
  const edges = [
    link("a", "b"),
    link("a", "c"),
    link("b", "d"),
    link("c", "d"),
    link("a", "d"),
    link("a", "b"),
  ];
  assert.deepEqual(downstreamImpact(["a", "b", "c", "d"], edges, "a"), [
    { id: "b", hops: 1 },
    { id: "c", hops: 1 },
    { id: "d", hops: 1 },
  ]);
});

test("existing cycles terminate, exclude the selected service, and do not leak dangling ids", () => {
  const edges = [
    link("a", "b"),
    link("b", "a"),
    link("b", "private"),
    link("private", "c"),
  ];
  assert.deepEqual(downstreamImpact(["a", "b", "c"], edges, "a"), [
    { id: "b", hops: 1 },
  ]);
  assert.deepEqual(downstreamImpact(["a", "b"], edges, "unknown"), []);
});

test("disconnected services and an empty map are safe", () => {
  assert.deepEqual(downstreamImpact(["a", "b"], [], "a"), []);
  const empty = dependencyLayout([], []);
  assert.equal(empty.positions.size, 0);
  assert.ok(Number.isFinite(empty.width) && Number.isFinite(empty.height));
});

test("layered layout places every dependency left to right and retains isolated nodes", () => {
  const edges = [
    link("a", "b"),
    link("a", "c"),
    link("b", "d"),
    link("c", "d"),
  ];
  const layout = dependencyLayout(["a", "b", "c", "d", "isolated"], edges);
  for (const edge of edges)
    assert.ok(
      layout.positions.get(edge.upstream_id).x <
        layout.positions.get(edge.service_id).x,
    );
  assert.equal(layout.positions.size, 5);
  assert.notEqual(layout.positions.get("b").y, layout.positions.get("c").y);
});

test("layout remains finite even if a malformed graph contains cycles", () => {
  const layout = dependencyLayout(["a", "b"], [link("a", "b"), link("b", "a")]);
  assert.equal(layout.positions.size, 2);
  for (const point of layout.positions.values())
    assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
});
