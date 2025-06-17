const https = require('https')

exports.handler = async (event, context) => {
  // Handle CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const body = JSON.parse(event.body)
    const transcript = body.text?.toLowerCase()?.trim() || ''
    
    // Simple pattern matching for Omi triggers
    const patterns = [
      /hey omi,?\s*find my notes? about (.+)/i,
      /hey omi,?\s*what did i write about (.+)/i,
      /hey omi,?\s*search for (.+) in my notes?/i,
      /hey omi,?\s*show me my (.+) notes?/i,
      /hey omi,?\s*find (.+) in obsidian/i
    ]
    
    let query = null
    for (const pattern of patterns) {
      const match = transcript.match(pattern)
      if (match) {
        query = match[1].trim()
        break
      }
    }
    
    if (!query) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ status: 'ignored' })
      }
    }
    
    // For now, return a test response
    // We'll connect to Obsidian later
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        status: 'success',
        notification: `Found query: "${query}" - Obsidian connection coming next!`,
        notification_type: 'info'
      })
    }
    
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: error.message })
    }
  }
}
