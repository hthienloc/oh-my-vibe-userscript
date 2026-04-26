import http.server
import json
import os

PORT = 8080
# Các file JSON sẽ được tạo ngay tại thư mục chạy script này
INBOX_FILE = os.path.join(os.path.dirname(__file__), 'bridge_inbox.json')
OUTBOX_FILE = os.path.join(os.path.dirname(__file__), 'bridge_outbox.json')

class BridgeHandler(http.server.BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        """ Handles INBOX (Browser -> Gemini) and Commands """
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        data = json.loads(post_data.decode('utf-8'))
        
        # Action: Clear both Outbox and Inbox
        if data.get('action') == 'clear_outbox':
            with open(OUTBOX_FILE, 'w', encoding='utf-8') as f:
                json.dump({}, f)
            if os.path.exists(INBOX_FILE):
                with open(INBOX_FILE, 'w', encoding='utf-8') as f:
                    json.dump({}, f)
            print("[*] Both Inbox and Outbox cleared by user.")
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            return

        # Regular Inbox flow (Browser -> Local)
        url = data.get('url', '')
        session_id = url.split('/')[-1]
        data['session_id'] = session_id
        
        with open(INBOX_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(b'{"status": "received"}')
        print(f"[*] Received sync from session: {session_id}")

    def do_GET(self):
        """ Handles OUTBOX (Gemini -> Browser) """
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Type', 'application/json')
        self.end_headers()

        if os.path.exists(OUTBOX_FILE):
            try:
                with open(OUTBOX_FILE, 'r', encoding='utf-8') as f:
                    outbox = json.load(f)
                
                if outbox.get('status') == 'pending':
                    self.wfile.write(json.dumps(outbox).encode('utf-8'))
                    return
            except:
                pass
        
        self.wfile.write(b'{}')

if __name__ == '__main__':
    if not os.path.exists(OUTBOX_FILE):
        with open(OUTBOX_FILE, 'w') as f: json.dump({}, f)
    if not os.path.exists(INBOX_FILE):
        with open(INBOX_FILE, 'w') as f: json.dump({}, f)
        
    print(f"🚀 Gemini Bridge Relay V2.8 starting on http://localhost:{PORT}")
    print(f"[*] Data files: {INBOX_FILE}, {OUTBOX_FILE}")
    http.server.HTTPServer(('localhost', PORT), BridgeHandler).serve_forever()
