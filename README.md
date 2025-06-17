# Voice-activated Obsidian vault search through Omi AI wearable device.

## Features
- 🎙️ Voice-activated search of your Obsidian vault
- 🧠 ADHD-friendly result limiting (max 5 results)
- 📝 Note previews to avoid information overwhelm
- 🔍 Smart trigger phrase detection
- ⚡ Real-time processing through Omi device

## Usage
Speak any of these trigger phrases while wearing your Omi device:
- "Hey Omi, find my notes about [topic]"
- "Hey Omi, what did I write about [subject]"
- "Hey Omi, search for [keyword] in my notes"
- "Hey Omi, show me my [tag] notes"

## Setup
1. Deploy this code to Vercel
2. Expose your Obsidian Local REST API (using ngrok for testing)
3. Add webhook URL to your Omi app
4. Start searching your knowledge base with your voice!

## Environment Variables
- `OBSIDIAN_BASE_URL`: Your Obsidian Local REST API URL
- `OBSIDIAN_API_KEY`: API key (if authentication enabled)

## ADHD-Optimized Features
- Limits results to prevent overwhelm
- Provides concise previews
- Clear trigger phrases
- Quick response times
- Helpful error messages
