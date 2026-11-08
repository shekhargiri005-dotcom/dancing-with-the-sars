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
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        if self.path == '/api/log':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length).decode('utf-8', errors='ignore')
            try:
                import json
                data = json.loads(post_data)
                level = data.get('level', 'INFO').upper()
                event = data.get('event', 'CLIENT')
                msg = data.get('message', '')
                details = data.get('details', {})
                print(f"[CLIENT LOG - {level}] [{event}] {msg} | Details: {json.dumps(details)}")
            except Exception:
                print(f"[CLIENT LOG] {post_data}")

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status":"logged"}')
            return
        super().do_POST()

    def log_message(self, format, *args):
        print(f"[NISAR SERVER] {self.address_string()} - {format % args}")

if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    with socketserver.TCPServer(("", PORT), NoCacheHTTPRequestHandler) as httpd:
        print(f"[NISAR SERVER] Serving at http://localhost:{PORT}")
        print(f"[NISAR SERVER] Cache-Control: no-cache, no-store enabled")
        print(f"[NISAR SERVER] Press Ctrl+C to stop")
        httpd.serve_forever()

