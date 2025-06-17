# ============================================================================
# FILE 3: api/webhook.py (CREATE api FOLDER FIRST)
# ============================================================================
from http.server import BaseHTTPRequestHandler
import json
import os
import sys
import importlib.util
import requests
import re
from datetime import datetime
from typing import List, Dict, Optional, Any
import logging
import urllib3

# Disable SSL warnings for local Obsidian API
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

class OmiObsidianPlugin:
    def __init__(self, obsidian_base_url: str = None, obsidian_api_key: str = None):
        self.obsidian_base_url = (obsidian_base_url or os.environ.get('OBSIDIAN_BASE_URL', 'https://127.0.0.1:27124')).rstrip('/')
        self.api_key = obsidian_api_key or os.environ.get('OBSIDIAN_API_KEY')
        
        # Create session with SSL verification disabled for local APIs
        self.session = requests.Session()
        self.session.verify = False
        
        if self.api_key:
            self.session.headers.update({"Authorization": f"Bearer {self.api_key}"})
            
        self.trigger_phrases = [
            r"hey omi,?\s*find my notes? about (.+)",
            r"hey omi,?\s*what did i write about (.+)",
            r"hey omi,?\s*search for (.+) in my notes?",
            r"hey omi,?\s*show me my (.+) notes?",
            r"hey omi,?\s*find (.+) in obsidian",
            r"hey omi,?\s*obsidian search (.+)",
            r"hey omi,?\s*look up (.+)",
            r"hey omi,?\s*recall (.+)",
        ]
        
        self.adhd_features = {
            "max_results": 5,
            "include_summaries": True,
            "highlight_keywords": True,
            "suggest_related": True,
        }

    def process_transcript(self, transcript_data):
        try:
            transcript_text = transcript_data.get('text', '').lower().strip()
            if not transcript_text:
                return None
                
            query = self._extract_query(transcript_text)
            if not query:
                return None
                
            search_results = self._search_obsidian(query)
            response = self._format_response(query, search_results)
            return response
            
        except Exception as e:
            return {
                "message": f"Sorry, I encountered an error while searching your notes: {str(e)}",
                "notification_type": "error"
            }

    def _extract_query(self, transcript):
        for pattern in self.trigger_phrases:
            match = re.search(pattern, transcript, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        return None

    def _search_obsidian(self, query):
        try:
            # Try simple search first
            url = f"{self.obsidian_base_url}/search"
            params = {"query": query}
            
            response = self.session.get(url, params=params, timeout=10)
            
            if response.status_code == 200:
                results = response.json().get('results', [])
                return results[:self.adhd_features["max_results"]]
            else:
                return []
                
        except Exception as e:
            print(f"Search error: {e}")
            return []

    def _format_response(self, query, results):
        if not results:
            return {
                "message": f"I couldn't find any notes about '{query}' in your Obsidian vault. Try a different search term.",
                "notification_type": "info"
            }
        
        response_parts = [f"Found {len(results)} note(s) about '{query}':"]
        
        for i, result in enumerate(results, 1):
            filename = result.get('filename', 'Unknown file')
            display_name = filename.replace('.md', '').split('/')[-1]
            
            # Simple preview
            content = result.get('content', '')
            preview = ""
            if content and self.adhd_features["include_summaries"]:
                sentences = content.split('.')[:2]
                preview = '. '.join(sentences)[:100] + "..."
            
            result_text = f"\n{i}. {display_name}"
            if preview:
                result_text += f"\n   Preview: {preview}"
            
            response_parts.append(result_text)
        
        return {
            "message": "\n".join(response_parts),
            "notification_type": "success"
        }

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/webhook' or self.path == '/api/webhook':
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                data = json.loads(post_data.decode('utf-8'))
                
                # Use plugin
                plugin = OmiObsidianPlugin()
                response = plugin.process_transcript(data)
                
                if response:
                    result = {
                        "status": "success",
                        "notification": response["message"],
                        "notification_type": response.get("notification_type", "info")
                    }
                else:
                    result = {"status": "ignored"}
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(result).encode())
                
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
