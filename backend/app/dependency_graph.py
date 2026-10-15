"""Directed reachability for user-declared dependencies, never outage causality."""


def has_path(edges: list[tuple[str, str]], start: str, target: str) -> bool:
    adjacency: dict[str, set[str]] = {}
    for upstream, downstream in edges:
        adjacency.setdefault(upstream, set()).add(downstream)
    pending = [start]
    visited: set[str] = set()
    while pending:
        node = pending.pop()
        if node == target:
            return True
        if node in visited:
            continue
        visited.add(node)
        pending.extend(adjacency.get(node, set()) - visited)
    return False
