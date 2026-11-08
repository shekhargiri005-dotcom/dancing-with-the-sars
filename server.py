"""
No-cache HTTP server for NISAR project development.
Serves all files with Cache-Control: no-cache headers to prevent browser caching issues.
Run from the project root: python server.py
"""
import http.server
import socketserver
import os

PORT = 8080

class NoCacheHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, format, *args):
        print(f"[NISAR SERVER] {self.address_string()} - {format % args}")

if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    with socketserver.TCPServer(("", PORT), NoCacheHTTPRequestHandler) as httpd:
        print(f"[NISAR SERVER] Serving at http://localhost:{PORT}")
        print(f"[NISAR SERVER] Cache-Control: no-cache, no-store enabled")
        print(f"[NISAR SERVER] Press Ctrl+C to stop")
        httpd.serve_forever()

