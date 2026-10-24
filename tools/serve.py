"""Static dev server that disables caching, so edited ES modules (and the
worker's imports) are always reloaded.

    python3 tools/serve.py 8080           serve the app
    python3 tools/serve.py 8080 --save    also let demo/ save recordings to demo/out/

Saving is off by default. When on, it only accepts requests from this
server's own pages, only .mp4/.webm/.png files with plain names, and only
into demo/out/.
"""
import http.server
import os
import re
import sys
from urllib.parse import parse_qs, urlparse

MAX_UPLOAD = 300 * 1024 * 1024
NAME = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,79}\.(mp4|webm|png)")


class NoCache(http.server.SimpleHTTPRequestHandler):
    save_enabled = False

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_POST(self):
        url = urlparse(self.path)
        if not self.save_enabled or url.path != "/__save":
            self.send_error(404)
            return
        host = self.headers.get("Host", "")
        origin = self.headers.get("Origin", "")
        # refuse uploads from any other website open in the browser
        if origin not in (f"http://{host}", f"http://localhost:{self.server.server_port}", f"http://127.0.0.1:{self.server.server_port}"):
            self.send_error(403, "uploads are only accepted from this server's pages")
            return
        name = parse_qs(url.query).get("name", [""])[0]
        if not NAME.fullmatch(name):
            self.send_error(400, "bad file name")
            return
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_UPLOAD:
            self.send_error(413, "empty or too large")
            return
        os.makedirs(os.path.join("demo", "out"), exist_ok=True)
        with open(os.path.join("demo", "out", name), "wb") as f:
            remaining = length
            while remaining:
                chunk = self.rfile.read(min(remaining, 1 << 20))
                if not chunk:
                    break
                f.write(chunk)
                remaining -= len(chunk)
        self.send_response(200)
        self.end_headers()


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    port = int(args[0]) if args else 8080
    NoCache.save_enabled = "--save" in sys.argv
    os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
    http.server.ThreadingHTTPServer(("127.0.0.1", port), NoCache).serve_forever()
