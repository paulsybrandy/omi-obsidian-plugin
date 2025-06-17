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
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ status: 'ignored' })
      }
    }
    
    const obsidianUrl = process.env.OBSIDIAN_BASE_URL
    const apiKey = process.env.OBSIDIAN_API_KEY
    
    try {
      // Get all files from vault
      const vaultResponse = await makeRequest(`${obsidianUrl}/vault/`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${apiKey}` }
      })
      
      if (vaultResponse.status !== 200) {
        throw new Error(`Vault access failed: ${vaultResponse.status}`)
      }
      
      const files = vaultResponse.data.files || []
      
      // Filter files that match the query (case-insensitive)
      const matchingFiles = files.filter(file => 
        file.toLowerCase().includes(query.toLowerCase()) && file.endsWith('.md')
      ).slice(0, 5) // Limit to 5 results
      
      if (matchingFiles.length > 0) {
        let message = `Found ${matchingFiles.length} note${matchingFiles.length > 1 ? 's' : ''} about "${query}":\n\n`
        
        for (let i = 0; i < matchingFiles.length; i++) {
          const file = matchingFiles[i]
          const displayName = file.replace(/\.md$/, '').replace(/^.*\//, '')
          message += `${i + 1}. **${displayName}**\n`
          
          // Try to get a preview of the file content
          try {
            const encodedFile = encodeURIComponent(file)
            const fileResponse = await makeRequest(`${obsidianUrl}/vault/${encodedFile}`, {
              method: 'GET',
              headers: { 'Authorization': `Bearer ${apiKey}` }
            })
            
            if (fileResponse.status === 200 && typeof fileResponse.data === 'string') {
              // Extract first few lines as preview
              const preview = fileResponse.data
                .split('\n')
                .slice(0, 3)
                .join(' ')
                .replace(/[#\[\]]/g, '')
                .substring(0, 100)
                .trim()
              
              if (preview) {
                message += `   Preview: ${preview}${fileResponse.data.length > 100 ? '...' : ''}\n\n`
              }
            }
          } catch (previewError) {
            // If preview fails, just show the filename
            message += `   (Content preview unavailable)\n\n`
          }
        }
        
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({
            status: 'success',
            notification: message.trim(),
            notification_type: 'success'
          })
        }
      } else {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({
            status: 'success',
            notification: `No notes found about "${query}". Try a different search term.`,
            notification_type: 'info'
          })
        }
      }
      
    } catch (obsidianError) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          status: 'success',
          notification: `Connection failed: ${obsidianError.message}`,
          notification_type: 'error'
        })
      }
    }
    
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: error.message })
    }
  }
}
