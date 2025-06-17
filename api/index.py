# ============================================================================
# FILE 5: api/index.py
# ============================================================================
from http.server import BaseHTTPRequestHandler
import json

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        
        response = {
            "name": "Omi Obsidian Integration Plugin",
            "description": "Voice-activated Obsidian vault search through Omi",
            "version": "1.0.0",
            "platform": "vercel",
            "endpoints": {
                "/webhook": "POST - Main Omi webhook endpoint",
                "/health": "GET - Health check",
                "/": "GET - This info page"
            },
            "trigger_phrases": [
                "Hey Omi, find my notes about [topic]",
                "Hey Omi, what did I write about [subject]",
                "Hey Omi, search for [keyword] in my notes",
                "Hey Omi, show me my [tag] notes"
            ]
        }
        
        self.wfile.write(json.dumps(response, indent=2).encode())

