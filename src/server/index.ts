import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' })); // Increased limit for audio data

app.post('/api/analyze-dream', async (req, res) => {
  try {
    const { audio, format, timestamp } = req.body;

    // Call to Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Please analyze this dream recording and provide insights:'
            },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: format,
                data: audio
              }
            }
          ]
        }]
      })
    });

    const analysis = await response.json();
    res.json(analysis);
  } catch (error) {
    console.error('Error analyzing dream:', error);
    res.status(500).json({ error: 'Failed to analyze dream' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 