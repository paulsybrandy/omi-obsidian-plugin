import json
import os
import requests
import re
import urllib3

# Disable SSL warnings for local Obsidian API
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def handler(event, context):
    # Handle CORS preflight
    if event['httpMethod'] == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            'body': ''
        }
    
    if event['httpMethod'] != 'POST':
        return {
            'statusCode': 405,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    try:
        # Parse request body
        body = json.loads(event['body'])
        
        # Initialize plugin settings
        obsidian_url = os.environ.get('OBSIDIAN_BASE_URL', 'https://127.0.0.1:27124')
        api_key = os.environ.get('OBSIDIAN_API_KEY')
        
        # Process transcript
        result = process_omi_transcript(body, obsidian_url, api_key)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(result)
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': str(e)})
        }

def process_omi_transcript(data, obsidian_url, api_key):
    """Process Omi transcript and search Obsidian"""
    
    # Extract query from transcript
    transcript = data.get('text', '').lower().strip()
    if not transcript:
        return {"status": "ignored"}
    
    trigger_phrases = [
        r"hey omi,?\s*find my notes? about (.+)",
        r"hey omi,?\s*what did i write about (.+)",
        r"hey omi,?\s*search for (.+) in my notes?",
        r"hey omi,?\s*show me my (.+) notes?",
        r"hey omi,?\s*find (.+) in obsidian",
        r"hey omi,?\s*obsidian search (.+)",
        r"hey omi,?\s*look up (.+)",
        r"hey omi,?\s*recall (.+)",
    ]
    
    query = None
    for pattern in trigger_phrases:
        match = re.search(pattern, transcript, re.IGNORECASE)
        if match:
            query = match.group(1).strip()
            break
    
    if not query:
        return {"status": "ignored"}
    
    # Search Obsidian
    try:
        session = requests.Session()
        session.verify = False  # For local APIs with self-signed certs
        
        if api_key:
            session.headers.update({"Authorization": f"Bearer {api_key}"})
        
        url = f"{obsidian_url.rstrip('/')}/search"
        response = session.get(url, params={"query": query}, timeout=10)
        
        if response.status_code == 200:
            results = response.json().get('results', [])[:5]  # Limit to 5 results
            
            if results:
                message = f"Found {len(results)} note(s) about '{query}':\n"
                for i, result in enumerate(results, 1):
                    filename = result.get('filename', 'Unknown').replace('.md', '')
                    # Simple preview
                    content = result.get('content', '')
                    preview = ""
                    if content:
                        sentences = content.split('.')[:2]
                        preview = '. '.join(sentences)[:100]
                        if len(preview) < len(content):
                            preview += "..."
                    
                    message += f"{i}. {filename}\n"
                    if preview:
                        message += f"   Preview: {preview}\n"
                
                return {
                    "status": "success",
                    "notification": message,
                    "notification_type": "success"
                }
            else:
                return {
                    "status": "success",
                    "notification": f"No notes found about '{query}'. Try a different search term.",
                    "notification_type": "info"
                }
        else:
            return {
                "status": "success",
                "notification": "Could not connect to Obsidian. Check if the Local REST API is running.",
                "notification_type": "error"
            }
            
    except Exception as e:
        return {
            "status": "success",
            "notification": f"Search error: {str(e)}",
            "notification_type": "error"
        }
