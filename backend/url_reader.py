"""Read a job description from a public web link.

Security (SSRF protection): only public http/https pages are fetched. Every hop
(including redirects) is checked, the hostname is resolved once and the request
is pinned to that checked IP, so DNS tricks cannot redirect us to an internal
address. Size, time and redirect count are limited.
"""
import asyncio
import ipaddress
import json
import socket
from dataclasses import dataclass
from urllib.parse import urljoin, urlsplit, urlunsplit

import httpx
from bs4 import BeautifulSoup

from helpers import extract_text_from_pdf

MAX_URL_LENGTH = 2000
MAX_BYTES      = 2 * 1024 * 1024   # 2 MB
MAX_REDIRECTS  = 4
MIN_WORDS      = 40
TIMEOUT        = httpx.Timeout(10.0, connect=5.0)
ALLOWED_PORTS  = {None, 80, 443}
BLOCKED_HOST_SUFFIXES = (".localhost", ".local", ".internal", ".lan", ".home", ".corp")
# Honest bot identity; sites that block bots get a clear "paste the text instead" message
PASTE_HINT = "No problem: just open the job ad in your browser, copy the text and paste it here."
USER_AGENT = "MockMateBot/1.0 (job ad reader; +https://github.com/VolodymyrSalenko/MockMate)"

NOISE_TAGS = ["script", "style", "noscript", "svg", "nav", "header", "footer",
              "aside", "form", "iframe", "button", "template"]


class UrlReadError(Exception):
    """A problem the user can understand and fix (shown in the UI as-is)."""
    def __init__(self, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.message = message


@dataclass
class JobPage:
    text: str
    host: str


# ── URL checks ────────────────────────────────────────────────────────────────

def normalize_url(raw: str) -> str:
    url = (raw or "").strip()
    if not url:
        raise UrlReadError(400, "Please paste a link to the job ad.")
    if len(url) > MAX_URL_LENGTH:
        raise UrlReadError(400, "This link looks too long. Please check that you copied it correctly.")
    if "://" not in url:
        url = "https://" + url   # people often paste "jobs.ch/..." without the scheme
    return url


def check_url(url: str):
    """Return (parts, host, port) for a safe-looking URL, or raise UrlReadError."""
    parts = urlsplit(url)
    if parts.scheme not in ("http", "https"):
        raise UrlReadError(400, "This doesn't look like a website link. A link usually starts with https://")
    if parts.username or parts.password:
        raise UrlReadError(400, f"This link contains a password, so we can't open it for safety reasons. {PASTE_HINT}")
    host = (parts.hostname or "").rstrip(".").lower()
    if not host:
        raise UrlReadError(400, "This doesn't look like a website link. Please check that you copied it correctly.")
    try:
        port = parts.port
    except ValueError:
        raise UrlReadError(400, f"We can only open normal website links. {PASTE_HINT}")
    if port not in ALLOWED_PORTS:
        raise UrlReadError(400, f"We can only open normal website links. {PASTE_HINT}")
    if host == "localhost" or host.endswith(BLOCKED_HOST_SUFFIXES):
        raise UrlReadError(400, f"For safety reasons, we can only open public websites. {PASTE_HINT}")
    return parts, host, port


async def resolve_public_ip(host: str, port: int) -> ipaddress._BaseAddress:
    """Resolve the hostname and make sure every address is a public internet address."""
    loop = asyncio.get_running_loop()
    try:
        infos = await asyncio.wait_for(
            loop.getaddrinfo(host, port, type=socket.SOCK_STREAM), timeout=5)
    except (socket.gaierror, UnicodeError):
        raise UrlReadError(400, "We couldn't find this website. Please check the link for typos.")
    except asyncio.TimeoutError:
        raise UrlReadError(504, "This website is taking too long to answer. Please try again in a moment, or copy the text and paste it here.")

    ips = []
    for info in infos:
        ip = ipaddress.ip_address(info[4][0].split("%")[0])
        if getattr(ip, "ipv4_mapped", None):
            ip = ip.ipv4_mapped
        if not ip.is_global or ip.is_multicast:
            raise UrlReadError(400, f"For safety reasons, we can only open public websites. {PASTE_HINT}")
        ips.append(ip)
    if not ips:
        raise UrlReadError(400, "We couldn't find this website. Please check the link for typos.")
    ips.sort(key=lambda ip: ip.version)   # prefer IPv4
    return ips[0]


# ── Fetching ──────────────────────────────────────────────────────────────────

def _status_error(code: int) -> UrlReadError:
    if code in (401, 403, 999):   # 999 = LinkedIn's "bot blocked"
        return UrlReadError(422, f"Sorry, this website doesn't let other apps read its job ads. {PASTE_HINT}")
    if code in (404, 410):
        return UrlReadError(422, "We couldn't find this job ad. Maybe it was removed, or the link has a small mistake. Please check the link.")
    if code == 429:
        return UrlReadError(422, "This website is busy right now. Please try again in a minute, or copy the text and paste it here.")
    if code >= 500:
        return UrlReadError(502, "This website has a problem at the moment. Please try again later, or copy the text and paste it here.")
    return UrlReadError(422, f"Sorry, we couldn't open this page. {PASTE_HINT}")


async def _read_limited(resp: httpx.Response) -> bytes:
    declared = resp.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > MAX_BYTES:
        raise UrlReadError(413, f"This page is too big for us to read. {PASTE_HINT}")
    chunks, size = [], 0
    async for chunk in resp.aiter_bytes():
        size += len(chunk)
        if size > MAX_BYTES:
            raise UrlReadError(413, f"This page is too big for us to read. {PASTE_HINT}")
        chunks.append(chunk)
    return b"".join(chunks)


async def fetch_job_page(raw_url: str) -> JobPage:
    url = normalize_url(raw_url)
    async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=False, trust_env=False) as client:
        for _ in range(MAX_REDIRECTS + 1):
            parts, host, port = check_url(url)
            default_port = 443 if parts.scheme == "https" else 80
            ip = await resolve_public_ip(host, port or default_port)

            # Connect to the IP we just checked; keep the real hostname for Host/SNI/certificate.
            ip_text = f"[{ip}]" if ip.version == 6 else str(ip)
            pinned = urlunsplit((parts.scheme, f"{ip_text}:{port or default_port}",
                                 parts.path or "/", parts.query, ""))
            host_header = host if port in (None, default_port) else f"{host}:{port}"
            headers = {
                "Host": host_header,
                "User-Agent": USER_AGENT,
                "Accept": "text/html,application/xhtml+xml,text/plain;q=0.9,application/pdf;q=0.8,*/*;q=0.5",
                "Accept-Language": "en,de;q=0.8,fr;q=0.7",
            }
            extensions = {"sni_hostname": host} if parts.scheme == "https" else {}

            try:
                async with client.stream("GET", pinned, headers=headers, extensions=extensions) as resp:
                    if resp.is_redirect:
                        location = resp.headers.get("location")
                        if not location:
                            raise UrlReadError(502, f"Sorry, we couldn't open this page. {PASTE_HINT}")
                        url = urljoin(url, location)
                        continue
                    if resp.status_code >= 400:
                        raise _status_error(resp.status_code)

                    ctype = resp.headers.get("content-type", "").split(";")[0].strip().lower()
                    body = await _read_limited(resp)
            except httpx.TimeoutException:
                raise UrlReadError(504, "This website is taking too long to answer. Please try again in a moment, or copy the text and paste it here.")
            except httpx.ConnectError:
                raise UrlReadError(502, "We couldn't reach this website. Please check the link, or copy the text and paste it here.")
            except httpx.HTTPError:
                raise UrlReadError(502, f"Sorry, something went wrong while opening this page. {PASTE_HINT}")

            if ctype == "application/pdf":
                try:
                    text = extract_text_from_pdf(body)
                except Exception:
                    raise UrlReadError(422, "We found a PDF file but couldn't read it. Please download it and use \"Upload file\" instead.")
            elif ctype in ("text/html", "application/xhtml+xml", "") or ctype.startswith("text/"):
                text = html_to_job_text(body) if ctype != "text/plain" else body.decode("utf-8", errors="ignore")
            else:
                raise UrlReadError(415, f"This link opens a file, not a job ad page. {PASTE_HINT}")

            if len(text.split()) < MIN_WORDS:
                raise UrlReadError(422, f"We opened the page, but the job text is hidden from us. Some websites only show it to people "
                                        f"in a browser or after logging in. {PASTE_HINT}")
            return JobPage(text=text, host=host.removeprefix("www."))

    raise UrlReadError(422, f"This link sends us from page to page, and we couldn't reach the job ad. {PASTE_HINT}")


# ── HTML → text ───────────────────────────────────────────────────────────────

def _find_job_posting(data):
    """Find a schema.org JobPosting object inside JSON-LD (many job sites include one)."""
    if isinstance(data, list):
        for item in data:
            found = _find_job_posting(item)
            if found:
                return found
    elif isinstance(data, dict):
        kind = data.get("@type")
        if kind == "JobPosting" or (isinstance(kind, list) and "JobPosting" in kind):
            return data
        if "@graph" in data:
            return _find_job_posting(data["@graph"])
    return None


def _clean_lines(text: str) -> str:
    lines, prev = [], None
    for line in text.splitlines():
        line = " ".join(line.split())
        if line and line != prev:
            lines.append(line)
            prev = line
    return "\n".join(lines)


def html_to_job_text(html: bytes) -> str:
    soup = BeautifulSoup(html, "html.parser")

    # 1) Structured data: works even on sites that render the page with JavaScript.
    for tag in soup.find_all("script", type="application/ld+json"):
        try:
            posting = _find_job_posting(json.loads(tag.string or ""))
        except (json.JSONDecodeError, TypeError):
            continue
        if posting and posting.get("description"):
            org = posting.get("hiringOrganization")
            org_name = org.get("name") if isinstance(org, dict) else None
            header = " at ".join(x for x in [posting.get("title"), org_name] if x)
            description = BeautifulSoup(str(posting["description"]), "html.parser").get_text("\n")
            text = _clean_lines(f"{header}\n{description}")
            if len(text.split()) >= MIN_WORDS:
                return text

    # 2) Visible page text, without menus, footers and scripts.
    for tag in soup(NOISE_TAGS):
        tag.decompose()
    main = soup.find("main") or soup.find("article")
    text = _clean_lines(main.get_text("\n")) if main else ""
    if len(text.split()) < MIN_WORDS:
        text = _clean_lines((soup.body or soup).get_text("\n"))
    return text
