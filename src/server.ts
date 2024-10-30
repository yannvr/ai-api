import express from 'express';
import corsMiddleware from './middleware/cors';
import { saveConversation, conversation } from './api/conversation';
import { sendPrompt } from './api/sendPrompt';
import { fetchQuote } from './api/fetchQuote';

const app = express();


// Use CORS middleware
app.use(corsMiddleware);

// Middleware to parse JSON bodies
app.use(express.json());

// Define routes
app.post('/conversation', async (req, res) => {
  const { conversationId, conversation } = req.body;
  try {
    await saveConversation(conversationId, conversation);
    res.status(200).send('Conversation saved');
  } catch (error) {
    res.status(500).send('Failed to save conversation');
  }
});

app.get('/conversation/:id', conversation);
app.post('/sendPrompt', sendPrompt);
app.get('/fetchQuote', fetchQuote);

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
