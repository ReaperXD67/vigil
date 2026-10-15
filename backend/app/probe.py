"""Bounded HTTPS header probes with DNS validation and a pinned TLS connection.

No user URL is handed to an HTTP client that might re-resolve or follow redirects.
All A/AAAA answers must be public. TLS SNI and certificate verification use the
original hostname while the socket connects only to one validated numeric IP.
"""
import ipaddress
import re
import socket
import ssl
import time
from dataclasses import dataclass
from urllib.parse import quote, urlsplit

import dns.exception
import dns.resolver


class UnsafeTarget(ValueError):
    pass


@dataclass
class ProbeResult:
    status: str
    latency_ms: float | None = None
    status_code: int | None = None
    error: str | None = None


def public_ip(value: str) -> bool:
    try:
        address = ipaddress.ip_address(value)
    except ValueError:
        return False
    if not address.is_global or address.is_multicast or address.is_unspecified:
        return False
    if isinstance(address, ipaddress.IPv6Address):
        # Reject IPv4 transition schemes, including mapped metadata addresses.
        if address.ipv4_mapped or address.sixtofour or address.teredo:
            return False
        if address in ipaddress.ip_network("64:ff9b::/96") or address in ipaddress.ip_network("64:ff9b:1::/48"):
            return False
    return True


def validate_url(url: str) -> tuple[str, str]:
    if len(url) > 2048 or any(ord(c) < 33 or ord(c) == 127 for c in url) or "\\" in url:
        raise UnsafeTarget("Use a valid HTTPS URL without whitespace or control characters.")
    try:
        parts = urlsplit(url)
        if parts.scheme.lower() != "https" or parts.port not in (None, 443):
            raise UnsafeTarget("Only HTTPS on port 443 is allowed.")
        if parts.username is not None or parts.password is not None or parts.fragment:
            raise UnsafeTarget("URL credentials and fragments are not allowed.")
        host = (parts.hostname or "").encode("idna").decode("ascii").lower().rstrip(".")
    except (ValueError, UnicodeError) as exc:
        if isinstance(exc, UnsafeTarget):
            raise
        raise UnsafeTarget("Invalid HTTPS URL.") from exc
    if not host or "%" in host or host == "localhost" or host.endswith((".localhost", ".local", ".internal", ".home", ".test", ".invalid")):
        raise UnsafeTarget("Local and internal hostnames are not allowed.")
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        if len(host) > 253 or "." not in host or not all(re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", x) for x in host.split(".")):
            raise UnsafeTarget("Use a publicly routable hostname.")
    else:
        if not public_ip(str(address)):
            raise UnsafeTarget("Private, reserved, and local IP addresses are not allowed.")
    path = quote(parts.path or "/", safe="/%:@!$&'()*+,;=-._~")
    if parts.query:
        path += "?" + quote(parts.query, safe="/%?:@!$&'()*+,;=-._~")
    return host, path


def resolve_public(host: str, deadline: float) -> list[str]:
    try:
        ipaddress.ip_address(host)
    except ValueError:
        resolver = dns.resolver.Resolver()
        resolver.use_search_by_default = False
        addresses = []
        for kind in ("A", "AAAA"):
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError("DNS deadline exceeded")
            try:
                answers = resolver.resolve(host, kind, lifetime=min(2.0, remaining), search=False)
                addresses.extend(str(a) for a in answers)
            except dns.resolver.NoAnswer:
                continue
            except dns.exception.DNSException as exc:
                # Fail closed if either address family cannot be fully validated.
                raise UnsafeTarget("The hostname could not be safely resolved.") from exc
    else:
        addresses = [host]
    if not addresses or not all(public_ip(a) for a in addresses):
        raise UnsafeTarget("The hostname resolves to a private or restricted network.")
    return addresses


def probe(url: str, timeout: float = 8.0) -> ProbeResult:
    started = time.monotonic()
    deadline = started + timeout
    host, path = validate_url(url)
    addresses = resolve_public(host, deadline)

    def remaining() -> float:
        duration = deadline - time.monotonic()
        if duration <= 0:
            raise TimeoutError("Probe deadline exceeded")
        return duration

    try:
        # Numeric address only: a DNS rebind cannot change the connection target.
        ip = addresses[0]
        family = socket.AF_INET6 if ":" in ip else socket.AF_INET
        with socket.socket(family, socket.SOCK_STREAM) as raw:
            raw.settimeout(remaining())
            raw.connect((ip, 443))
            raw.settimeout(remaining())
            with ssl.create_default_context().wrap_socket(raw, server_hostname=host) as secured:
                authority = f"[{host}]" if ":" in host else host
                request = f"HEAD {path} HTTP/1.1\r\nHost: {authority}\r\nUser-Agent: Vigil/1.0 (+https-monitor)\r\nAccept: */*\r\nConnection: close\r\n\r\n"
                secured.settimeout(remaining())
                secured.sendall(request.encode("ascii"))
                headers = b""
                while b"\r\n\r\n" not in headers:
                    secured.settimeout(remaining())
                    chunk = secured.recv(min(4096, 16384 - len(headers)))
                    if not chunk:
                        raise OSError("Incomplete HTTP response")
                    headers += chunk
                    if len(headers) >= 16384 and b"\r\n\r\n" not in headers:
                        raise OSError("Response headers exceeded 16 KiB")
                match = re.match(rb"HTTP/1\.[01] ([1-5][0-9]{2})[ \r]", headers)
                if not match:
                    raise OSError("Invalid HTTP response")
                code = int(match.group(1))
        latency = round((time.monotonic() - started) * 1000, 1)
        status = "operational" if 200 <= code < 300 and latency < 2000 else "degraded" if 200 <= code < 500 else "down"
        error = "Redirect received; redirects are not followed." if 300 <= code < 400 else None
        if code >= 400:
            error = f"Endpoint returned HTTP {code}."
        return ProbeResult(status=status, latency_ms=latency, status_code=code, error=error)
    except (TimeoutError, socket.timeout):
        return ProbeResult(status="down", error="HTTPS check timed out.")
    except ssl.SSLError:
        return ProbeResult(status="down", error="TLS certificate verification or handshake failed.")
    except OSError:
        return ProbeResult(status="down", error="HTTPS connection failed or response headers were invalid.")
