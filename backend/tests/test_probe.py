import socket
import time

import dns.resolver
import pytest

from app.probe import UnsafeTarget, probe, public_ip, resolve_public, validate_url


@pytest.mark.parametrize("value", ["127.0.0.1", "10.0.0.1", "169.254.169.254", "172.16.0.1", "192.168.1.1", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "fe80::1", "fc00::1", "::ffff:169.254.169.254", "2002:a00:1::", "64:ff9b::a00:1", "192.0.2.1", "2001:db8::1"])
def test_blocks_non_public_ip(value):
    assert not public_ip(value)


@pytest.mark.parametrize("value", ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])
def test_accepts_public_addresses(value):
    assert public_ip(value)


@pytest.mark.parametrize("url", ["http://example.com", "https://localhost", "https://example.local", "https://10.0.0.1", "https://[::1]", "https://169.254.169.254/latest/meta-data", "https://example.com:8443", "https://user:pass@example.com", "https://example.com/#fragment", "https://example.com\r\nHost: localhost", "https://example.com\\@127.0.0.1", "file:///etc/passwd", "https://2130706433"])
def test_url_rejects_unsafe_targets(url):
    with pytest.raises(UnsafeTarget):
        validate_url(url)


def test_url_accepts_encoded_paths_without_header_injection():
    assert validate_url("https://example.com/hello?q=hello%20world") == ("example.com", "/hello?q=hello%20world")


def test_dns_mixed_public_private_fails_closed(monkeypatch):
    def answer(self, host, kind, **kwargs):
        return ["93.184.215.14"] if kind == "A" else ["::1"]
    monkeypatch.setattr(dns.resolver.Resolver, "resolve", answer)
    with pytest.raises(UnsafeTarget):
        resolve_public("example.com", time.monotonic() + 8)


def test_dns_failure_in_other_family_fails_closed(monkeypatch):
    def answer(self, host, kind, **kwargs):
        if kind == "AAAA":
            raise dns.resolver.LifetimeTimeout
        return ["93.184.215.14"]
    monkeypatch.setattr(dns.resolver.Resolver, "resolve", answer)
    with pytest.raises(UnsafeTarget):
        resolve_public("example.com", time.monotonic() + 8)


def test_pinned_tls_connection_and_no_redirect_following(monkeypatch):
    observations = {}
    class FakeSocket:
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def settimeout(self, value): observations["timeout"] = value
        def connect(self, address): observations["address"] = address
        def sendall(self, value): observations["request"] = value
        def recv(self, count): return b"HTTP/1.1 302 Found\r\nLocation: http://169.254.169.254\r\n\r\n"
    class FakeSSL:
        def wrap_socket(self, sock, server_hostname):
            observations["hostname"] = server_hostname
            return sock
    monkeypatch.setattr("app.probe.resolve_public", lambda *_: ["93.184.215.14"])
    monkeypatch.setattr("app.probe.socket.socket", lambda *_: FakeSocket())
    monkeypatch.setattr("app.probe.ssl.create_default_context", lambda: FakeSSL())
    result = probe("https://example.com/status")
    assert observations["address"] == ("93.184.215.14", 443)
    assert observations["hostname"] == "example.com"
    assert b"HEAD /status HTTP/1.1" in observations["request"]
    assert b"Host: example.com" in observations["request"]
    assert result.status == "degraded" and result.status_code == 302
    assert "not followed" in result.error


def test_connection_timeout_is_honest_down_result(monkeypatch):
    class FakeSocket:
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def settimeout(self, value): pass
        def connect(self, address): raise socket.timeout()
    monkeypatch.setattr("app.probe.resolve_public", lambda *_: ["93.184.215.14"])
    monkeypatch.setattr("app.probe.socket.socket", lambda *_: FakeSocket())
    result = probe("https://example.com")
    assert result.status == "down" and result.latency_ms is None and result.status_code is None
