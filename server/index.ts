import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// Add this new GET route
app.get('/', (req, res) => {
  res.json({ message: 'Dream Factory API is running' });
});

app.post('/api/analyze-dream', async (req, res) => {
  try {
    const { audio, format, timestamp } = req.body;
    console.log('Received dream recording:', timestamp);

    // Temporary response for testing
    res.json({ 
      message: 'Dream recording received',
      timestamp,
      status: 'success'
    });

  } catch (error) {
    console.error('Error analyzing dream:', error);
    res.status(500).json({ error: 'Failed to analyze dream' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
