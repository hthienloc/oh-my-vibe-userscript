import http.server
import json
import os
import sys

PORT = 8081
# Files to store the state
try:
    DATA_DIR = os.path.dirname(os.path.abspath(__file__))
except NameError:
    DATA_DIR = os.getcwd()

INBOX_FILE = os.path.join(DATA_DIR, 'bridge_inbox.json')
OUTBOX_FILE = os.path.join(DATA_DIR, 'bridge_outbox.json')

class BridgeHandler(http.server.BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        
        try:
            data = json.loads(post_data.decode('utf-8'))
        except json.JSONDecodeError:
            self.send_error(400, "Invalid JSON")
            return

        action = data.get('action')
        
        if action == 'lms_question':
            # Save question from LMS
            with open(INBOX_FILE, 'w', encoding='utf-8') as f:
                json.dump({'question': data.get('question'), 'status': 'pending'}, f, ensure_ascii=False, indent=2)
            print("[*] Received question from LMS.")
            # Clear outbox when new question arrives
            if os.path.exists(OUTBOX_FILE):
                os.remove(OUTBOX_FILE)
            
        elif action == 'gemini_answer':
            # Save answer from Gemini
            with open(OUTBOX_FILE, 'w', encoding='utf-8') as f:
                json.dump({'answer': data.get('answer'), 'status': 'pending'}, f, ensure_ascii=False, indent=2)
            print("[*] Received answer from Gemini.")
            
        elif action == 'clear_all':
            if os.path.exists(INBOX_FILE): os.remove(INBOX_FILE)
            if os.path.exists(OUTBOX_FILE): os.remove(OUTBOX_FILE)
            print("[*] Cleared all data.")
            
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'status': 'success'}).encode('utf-8'))

    def do_GET(self):
        print(f"[*] GET request: {self.path}")
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Type', 'application/json')
        self.end_headers()

        if self.path.startswith('/status'):
            self.wfile.write(json.dumps({'status': 'running'}).encode('utf-8'))
            
        elif self.path.startswith('/lms/poll'):
            # LMS polling for answer
            if os.path.exists(OUTBOX_FILE):
                try:
                    with open(OUTBOX_FILE, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    self.wfile.write(json.dumps(data).encode('utf-8'))
                    return
                except:
                    pass
            self.wfile.write(json.dumps({'status': 'waiting'}).encode('utf-8'))
            
        elif self.path.startswith('/gemini/poll'):
            # Gemini polling for question
            if os.path.exists(INBOX_FILE):
                try:
                    with open(INBOX_FILE, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    self.wfile.write(json.dumps(data).encode('utf-8'))
                    return
                except:
                    pass
            self.wfile.write(json.dumps({'status': 'waiting'}).encode('utf-8'))
        else:
            self.wfile.write(json.dumps({'message': 'Gemini Bridge Relay is active'}).encode('utf-8'))

if __name__ == '__main__':
    print(f"🚀 LMS-Gemini Bridge starting on http://127.0.0.1:{PORT}")
    print(f"[*] Quick Start Command:")
    print(f"    curl -fsSL https://raw.githubusercontent.com/hthienloc/oh-my-vibe-userscript/main/src/productivity/lms-gemini-bridge/server/bridge_server.py | python3")
    
    try:
        # Force IPv4 binding
        http.server.HTTPServer(('127.0.0.1', PORT), BridgeHandler).serve_forever()
    except KeyboardInterrupt:
        print("\n[*] Shutting down...")
        sys.exit(0)
