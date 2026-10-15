export type DependencyLink = { upstream_id: string; service_id: string };

/** Shortest dependency distance, not a prediction that an outage will propagate. */
export function downstreamImpact(
  ids: string[],
  edges: DependencyLink[],
  selected: string,
) {
  const allowed = new Set(ids);
  if (!allowed.has(selected)) return [];
  const adjacency = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (!allowed.has(edge.upstream_id) || !allowed.has(edge.service_id))
      continue;
    const next = adjacency.get(edge.upstream_id) ?? new Set<string>();
    next.add(edge.service_id);
    adjacency.set(edge.upstream_id, next);
  }
  const distance = new Map([[selected, 0]]);
  const queue = [selected];
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    for (const child of adjacency.get(current) ?? []) {
      if (distance.has(child)) continue;
      distance.set(child, distance.get(current)! + 1);
      queue.push(child);
    }
  }
  return [...distance]
    .filter(([id]) => id !== selected)
    .map(([id, hops]) => ({ id, hops }))
    .sort((a, b) => a.hops - b.hops || a.id.localeCompare(b.id));
}

/** Stable layered layout with a bounded fallback for malformed cyclic input. */
export function dependencyLayout(ids: string[], edges: DependencyLink[]) {
  const nodes = [...new Set(ids)];
  const allowed = new Set(nodes);
  const children = new Map(nodes.map((id) => [id, new Set<string>()]));
  const incoming = new Map(nodes.map((id) => [id, 0]));
  const level = new Map(nodes.map((id) => [id, 0]));
  for (const edge of edges) {
    if (
      !allowed.has(edge.upstream_id) ||
      !allowed.has(edge.service_id) ||
      edge.upstream_id === edge.service_id
    )
      continue;
    const list = children.get(edge.upstream_id)!;
    if (list.has(edge.service_id)) continue;
    list.add(edge.service_id);
    incoming.set(edge.service_id, incoming.get(edge.service_id)! + 1);
  }
  const queue = nodes.filter((id) => incoming.get(id) === 0);
  const processed = new Set<string>();
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    processed.add(current);
    for (const child of children.get(current) ?? []) {
      level.set(child, Math.max(level.get(child)!, level.get(current)! + 1));
      incoming.set(child, incoming.get(child)! - 1);
      if (incoming.get(child) === 0) queue.push(child);
    }
  }
  // Server rejects cycles. Keep the view navigable if stale/malformed data arrives.
  const fallbackLevel =
    Math.max(0, ...[...processed].map((id) => level.get(id)!)) + 1;
  for (const id of nodes) if (!processed.has(id)) level.set(id, fallbackLevel);
  const columns = new Map<number, string[]>();
  for (const id of nodes) {
    const depth = level.get(id)!;
    columns.set(depth, [...(columns.get(depth) ?? []), id]);
  }
  const rows = Math.max(
    1,
    ...[...columns.values()].map((column) => column.length),
  );
  const positions = new Map<string, { x: number; y: number }>();
  for (const [depth, column] of columns)
    column.forEach((id, row) => {
      positions.set(id, {
        x: 32 + depth * 272,
        y: 40 + row * 116 + (rows - column.length) * 58,
      });
    });
  return {
    positions,
    width: Math.max(600, (Math.max(0, ...columns.keys()) + 1) * 272 + 8),
    height: Math.max(300, rows * 116 + 48),
  };
}
