const https = require('https')
const http = require('http')

// Create an agent that accepts self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
})

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https://')
    const client = isHttps ? https : http
    
    const requestOptions = {
      ...options,
      ...(isHttps && { agent: httpsAgent })
    }
    
    const req = client.request(url, requestOptions, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data)
          resolve({ status: res.statusCode, data: jsonData })
        } catch (e) {
          resolve({ status: res.statusCode, data: data })
        }
      })
    })
    
    req.on('error', reject)
    if (options.body) {
      req.write(options.body)
    }
    req.end()
  })
}

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
    
    // Extract query from Omi trigger phrases
    const patterns = [
      /hey omi,?\s*find my notes? about (.+)/i,
      /hey omi,?\s*what did i write about (.+)/i,
      /hey omi,?\s*search for (.+) in my notes?/i,
      /hey omi,?\s*show me my (.+) notes?/i,
      /hey omi,?\s*find (.+) in obsidian/i,
      /hey omi,?\s*obsidian search (.+)/i,
      /hey omi,?\s*look up (.+)/i,
      /hey omi,?\s*recall (.+)/i
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

    // Search Obsidian vault
    const obsidianUrl = process.env.OBSIDIAN_BASE_URL
    const apiKey = process.env.OBSIDIAN_API_KEY
    
    if (!obsidianUrl) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          status: 'success',
          notification: 'Obsidian URL not configured. Please set OBSIDIAN_BASE_URL environment variable.',
          notification_type: 'error'
        })
      }
    }

    try {
      // Search using the vault search endpoint
      const searchUrl = `${obsidianUrl.replace(/\/$/, '')}/search/simple/`
      const searchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey && { 'Authorization': `Bearer ${apiKey}` })
        },
        body: JSON.stringify({
          query: query,
          contextLength: 100
        })
      }

      const searchResponse = await makeRequest(searchUrl, searchOptions)
      
      if (searchResponse.status === 200 && searchResponse.data) {
        const results = Array.isArray(searchResponse.data) ? searchResponse.data : []
        
        if (results.length > 0) {
          // Limit to top 5 results for ADHD-friendly display
          const topResults = results.slice(0, 5)
          
          let message = `Found ${topResults.length} note${topResults.length > 1 ? 's' : ''} about "${query}":\n\n`
          
          topResults.forEach((result, index) => {
            const filename = result.filename || 'Unknown file'
            const displayName = filename.replace(/\.md$/, '').replace(/^.*\//, '')
            
            message += `${index + 1}. **${displayName}**\n`
            
            if (result.content) {
              // Create a preview snippet
              const preview = result.content.substring(0, 150).trim()
              message += `   Preview: ${preview}${result.content.length > 150 ? '...' : ''}\n\n`
            }
          })
          
          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              status: 'success',
              notification: message.trim(),
              notification_type: 'success'
            })
          }
        } else {
          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              status: 'success',
              notification: `No notes found about "${query}". Try a different search term or check your spelling.`,
              notification_type: 'info'
            })
          }
        }
      } else {
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            status: 'success',
            notification: `Search completed but couldn't retrieve results. Status: ${searchResponse.status}`,
            notification_type: 'warning'
          })
        }
      }
      
    } catch (obsidianError) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          status: 'success',
          notification: `Could not connect to Obsidian: ${obsidianError.message}. Make sure ngrok is running and Obsidian is open.`,
          notification_type: 'error'
        })
      }
    }
    
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: `Server error: ${error.message}` 
      })
    }
  }
}
