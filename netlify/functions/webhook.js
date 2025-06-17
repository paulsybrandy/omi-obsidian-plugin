const https = require('https')

const agent = new https.Agent({
  rejectUnauthorized: false
})

function makeRequest(url, options) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { ...options, agent }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) })
        } catch (e) {
          resolve({ status: res.statusCode, data: data })
        }
      })
    })
    
    req.setTimeout(8000)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Request timeout'))
    })
    req.on('error', reject)
    req.end()
  })
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const body = JSON.parse(event.body)
    const transcript = body.text?.toLowerCase()?.trim() || ''
    
    // Extract query
    const match = transcript.match(/hey omi,?\s*find my notes? about (.+)/i)
    if (!match) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ status: 'ignored' })
      }
    }
    
    const query = match[1].trim()
    const obsidianUrl = process.env.OBSIDIAN_BASE_URL
    const apiKey = process.env.OBSIDIAN_API_KEY
    
    // Debug: Show what URL we're trying to access
    const testUrl = `${obsidianUrl}/vault/`
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        status: 'success',
        notification: `Debug info:\nObsidian URL: ${obsidianUrl}\nTrying to access: ${testUrl}\nAPI Key present: ${apiKey ? 'Yes' : 'No'}`,
        notification_type: 'info'
      })
    }
    
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: error.message })
    }
  }
}
