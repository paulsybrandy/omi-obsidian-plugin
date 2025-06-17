import json

def handler(event, context):
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({
            "status": "healthy",
            "service": "omi-obsidian-plugin",
            "platform": "netlify"
        })
    }
