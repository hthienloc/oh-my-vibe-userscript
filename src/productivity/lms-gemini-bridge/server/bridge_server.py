import http.server
import json
import os
import time
from datetime import datetime

PORT = 8081
BASE_DIR = os.path.join(os.path.dirname(__file__))
INBOX_FILE = os.path.join(BASE_DIR, 'lms_inbox.json')
OUTBOX_FILE = os.path.join(BASE_DIR, 'gemini_outbox.json')
STATE_FILE = os.path.join(BASE_DIR, 'bridge_state.json')

class BridgeHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # Suppress default logging

    def send_json_response(self, data, status=200):
        self.send_response(status)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

    def do_OPTIONS(self):
        self.send_json_response({})

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length == 0:
            self.send_json_response({'error': 'No data'}, 400)
            return

        post_data = self.rfile.read(content_length)
        try:
            data = json.loads(post_data.decode('utf-8'))
        except:
            self.send_json_response({'error': 'Invalid JSON'}, 400)
            return

        action = data.get('action')

        # Clear all state
        if action == 'clear_all':
            self._clear_files()
            self.send_json_response({'status': 'cleared'})
            print(f"[{datetime.now().strftime('%H:%M:%S')}] 🧹 Cleared all bridge data")
            return

        # LMS sends question to bridge
        if action == 'lms_question':
            question_data = {
                'question': data.get('question', ''),
                'timestamp': time.time(),
                'status': 'pending',
                'source': 'lms'
            }
            with open(INBOX_FILE, 'w', encoding='utf-8') as f:
                json.dump(question_data, f, ensure_ascii=False, indent=2)
            print(f"[{datetime.now().strftime('%H:%M:%S')}] 📥 LMS question received ({len(question_data['question'])} chars)")
            self.send_json_response({'status': 'received'})

        # Gemini sends answer to bridge
        elif action == 'gemini_answer':
            answer_data = {
                'answer': data.get('answer', ''),
                'timestamp': time.time(),
                'status': 'pending',
                'source': 'gemini'
            }
            with open(OUTBOX_FILE, 'w', encoding='utf-8') as f:
                json.dump(answer_data, f, ensure_ascii=False, indent=2)
            # Clear inbox after answer is ready
            with open(INBOX_FILE, 'w', encoding='utf-8') as f:
                json.dump({}, f)
            print(f"[{datetime.now().strftime('%H:%M:%S')}] 📤 Gemini answer received ({len(answer_data['answer'])} chars)")
            self.send_json_response({'status': 'received'})

        else:
            self.send_json_response({'error': 'Unknown action'}, 400)

    def do_GET(self):
        # LMS polls for answer
        if self.path == '/lms/poll':
            if os.path.exists(OUTBOX_FILE):
                try:
                    with open(OUTBOX_FILE, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    if data.get('status') == 'pending' and data.get('answer'):
                        self.send_json_response(data)
                        return
                except:
                    pass
            self.send_json_response({})

        # Gemini polls for question
        elif self.path == '/gemini/poll':
            if os.path.exists(INBOX_FILE):
                try:
                    with open(INBOX_FILE, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    if data.get('status') == 'pending' and data.get('question'):
                        self.send_json_response(data)
                        return
                except:
                    pass
            self.send_json_response({})

        # Status check
        elif self.path == '/status':
            status = {
                'status': 'running',
                'inbox': os.path.exists(INBOX_FILE) and os.path.getsize(INBOX_FILE) > 2,
                'outbox': os.path.exists(OUTBOX_FILE) and os.path.getsize(OUTBOX_FILE) > 2,
                'timestamp': time.time()
            }
            self.send_json_response(status)

        else:
            self.send_json_response({'error': 'Unknown endpoint'}, 404)

    def _clear_files(self):
        for f in [INBOX_FILE, OUTBOX_FILE, STATE_FILE]:
            with open(f, 'w', encoding='utf-8') as fp:
                json.dump({}, fp)

def main():
    # Initialize files
    for f in [INBOX_FILE, OUTBOX_FILE, STATE_FILE]:
        if not os.path.exists(f):
            with open(f, 'w', encoding='utf-8') as fp:
                json.dump({}, fp)

    print(f"🚀 LMS-Gemini Bridge Server starting on http://localhost:{PORT}")
    print(f"📂 Data directory: {BASE_DIR}")
    print(f"📥 LMS sends questions to: POST / (action: lms_question)")
    print(f"📤 Gemini sends answers to: POST / (action: gemini_answer)")
    print(f"🔄 LMS polls: GET /lms/poll")
    print(f"🔄 Gemini polls: GET /gemini/poll")
    print(f"🧹 Clear all: POST / (action: clear_all)")
    print(f"{'='*50}")

    server = http.server.HTTPServer(('localhost', PORT), BridgeHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Server stopped")

if __name__ == '__main__':
    main()
