import express from 'express';
import compression from 'compression';
import dotenv from 'dotenv';
import { fetchQuote } from './api/fetchQuote';
import corsMiddleware from './middleware/cors';
import { sendPrompt } from './api/sendPrompt';
import { conversation, getConversationById, getConversations, addTag, removeTag } from './api/conversation';

dotenv.config();

const app = express();

// Use CORS middleware
app.use(corsMiddleware);

// Middleware to parse JSON bodies
app.use(express.json());

app.get('/conversation', getConversationById);
app.post('/conversation', conversation);
app.get('/conversations', getConversations); // Add this line to define the GET /conversations endpoint
app.post('/sendPrompt', sendPrompt);
app.get('/fetchQuote', fetchQuote);
app.put('/tag', addTag);
app.delete('/tag', removeTag);

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
