"""Serve il pianificatore in locale con Cache-Control: no-store.

Doppio clic su serve.bat, oppure dalla cartella:  python serve.py 8123

Serve un server perche' i moduli ES non partono da file://. E serve `no-store`
perche' senza, il browser a volte tiene il JS vecchio e la pagina sembra rotta
dopo una modifica.
"""
import functools
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
ROOT = os.path.dirname(os.path.abspath(__file__))


class NoStore(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()


if __name__ == "__main__":
    handler = functools.partial(NoStore, directory=ROOT)
    with http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler) as httpd:
        print(f"pianificatore -> http://127.0.0.1:{PORT}/   (radice: {ROOT})")
        httpd.serve_forever()
