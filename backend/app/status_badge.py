"""Small, dependency-free SVG badges containing only aggregate public status."""

from datetime import datetime, timezone
from html import escape

from .models import Service


def badge_state(services: list[Service], *, is_demo: bool, current_time: datetime, stale_after: int) -> tuple[str, str]:
    if is_demo:
        return "sample data", "#a9dbff"
    if not services:
        return "nothing shared", "#a4b2c5"
    fresh = [s for s in services if s.last_checked and 0 <= (current_time - s.last_checked.replace(tzinfo=timezone.utc)).total_seconds() <= stale_after]
    if any(s.status == "down" for s in fresh):
        return "outage detected", "#ff8787"
    if any(s.status == "degraded" for s in fresh):
        return "degraded", "#f5bb70"
    if len(fresh) != len(services):
        return "awaiting checks", "#a4b2c5"
    if any(s.status != "operational" for s in fresh):
        return "unknown", "#a4b2c5"
    return "operational", "#73dfb2"


def render_badge(message: str, color: str) -> str:
    # Only fixed application strings are supplied. Escape defensively as this is XML.
    width = 70 + len(message) * 7
    safe = escape(message)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="28" role="img" aria-label="Vigil: {safe}">
<title>Vigil: {safe}</title>
<rect width="{width}" height="28" rx="6" fill="#0d121b"/>
<path d="M55 0v28" stroke="#324053"/>
<g font-family="Verdana,DejaVu Sans,sans-serif" font-size="11" text-anchor="middle">
<text x="28" y="18" fill="#f0f4fa">vigil</text>
<text x="{55 + (width - 55) / 2}" y="18" fill="{color}">{safe}</text>
</g></svg>'''
