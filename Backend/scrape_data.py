import os
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from pathlib import Path


BASE_URL = "https://docs.python.org/3/"
DATA_DIR = Path("data")


def get_all_urls(start_url: str = BASE_URL) -> list[str]:
    """
    Crawl all pages under the Python 3 documentation and return every
    unique URL found.  Already-visited pages are never fetched twice.
    """
    visited: set[str] = set()
    to_visit: list[str] = [start_url]
    found_urls: list[str] = []

    base_parsed = urlparse(start_url)
    base_prefix = f"{base_parsed.scheme}://{base_parsed.netloc}{base_parsed.path}"

    def normalise(url: str) -> str:
        """Strip fragment; keep the URL exactly as-is otherwise."""
        return url.split("#")[0]

    while to_visit:
        url = normalise(to_visit.pop(0))

        if url in visited:
            continue

        visited.add(url)
        print(f"[{len(visited)}] Visiting: {url}")

        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
        except requests.RequestException as e:
            print(f"  Skipping (error): {e}")
            continue

        content_type = response.headers.get("Content-Type", "")
        if "text/html" not in content_type:
            print(f"  Skipping (not HTML: {content_type})")
            continue

        found_urls.append(url)

        soup = BeautifulSoup(response.text, "html.parser")

        for tag in soup.find_all("a", href=True):
            href = tag["href"]
            absolute = urljoin(url, href)
            # Keep only links that stay within the docs base path
            if absolute.startswith(base_prefix) and normalise(absolute).endswith(".html"):
                normalised = normalise(absolute)
                if normalised not in visited:
                    to_visit.append(normalised)

    print(f"\nDone. {len(found_urls)} unique pages found.")
    return found_urls


def url_to_path(url: str) -> Path:
    """
    Convert a URL to a local file path inside DATA_DIR.
    e.g. https://docs.python.org/3/library/os.html -> data/library/os.txt
         https://docs.python.org/3/tutorial/classes.html -> data/tutorial/classes.txt
    """
    parsed = urlparse(url)
    # Strip the leading /3/ prefix from the path
    rel_path = parsed.path.lstrip("/")
    parts = rel_path.split("/")
    # Remove the leading "3" segment
    if parts and parts[0] == "3":
        parts = parts[1:]
    # Homepage: path is now empty or just a slash
    if not parts or parts == [""]:
        return DATA_DIR / "homepage.txt"
    # Change extension from .html to .txt
    if parts:
        parts[-1] = Path(parts[-1]).stem + ".txt"
    return DATA_DIR / Path(*parts)


def save_pages(urls_file: str = "urls.txt") -> None:
    """Read urls.txt and save each page's text content to data/ as .txt files."""
    if not os.path.exists(urls_file):
        print(f"{urls_file} not found. Run the scraper first.")
        return

    if DATA_DIR.exists():
        print(f"{DATA_DIR}/ folder already exists, skipping download.")
        return

    with open(urls_file) as f:
        urls = [line.strip() for line in f if line.strip()]

    DATA_DIR.mkdir(exist_ok=True)
    total = len(urls)

    for i, url in enumerate(urls, 1):
        out_path = url_to_path(url)

        if out_path.exists():
            print(f"[{i}/{total}] Skipping (exists): {out_path}")
            continue

        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
        except requests.RequestException as e:
            print(f"[{i}/{total}] Skipping (error): {e}")
            continue

        content_type = response.headers.get("Content-Type", "")
        if "text/html" not in content_type:
            print(f"[{i}/{total}] Skipping (not HTML): {url}")
            continue

        soup = BeautifulSoup(response.text, "html.parser")
        # Extract readable text from the main body
        body = soup.find("div", {"role": "main"}) or soup.find("body") or soup
        text = body.get_text(separator="\n", strip=True)

        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(text, encoding="utf-8")
        print(f"[{i}/{total}] Saved: {out_path}")

    print(f"\nDone. Pages saved to {DATA_DIR}/")


if __name__ == "__main__":
    urls_file = "urls.txt"
    if os.path.exists(urls_file):
        print(f"{urls_file} already exists, skipping scrape.")
    else:
        urls = get_all_urls()
        with open(urls_file, "w") as f:
            for u in urls:
                f.write(u + "\n")
        print(f"Saved {len(urls)} URLs to {urls_file}")

    save_pages(urls_file)
