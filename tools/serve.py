"""Static dev server that disables caching, so edited ES modules (and the
worker's imports) are always reloaded."""
import http.server
import os
import sys


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
    http.server.ThreadingHTTPServer(("127.0.0.1", port), NoCache).serve_forever()
