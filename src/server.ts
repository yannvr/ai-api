import express from 'express';
import { fetchQuote } from './api/fetchQuote';
import corsMiddleware from './middleware/cors';
import { sendPrompt } from './api/sendPrompt';
import { conversation } from './api/conversation';

const app = express();


// Use CORS middleware
app.use(corsMiddleware);

// Middleware to parse JSON bodies
app.use(express.json());

app.post('/conversation', conversation);
app.post('/sendPrompt', sendPrompt);
app.get('/fetchQuote', fetchQuote);

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
