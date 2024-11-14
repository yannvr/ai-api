import express from 'express';
import compression from 'compression';
import dotenv from 'dotenv';
import { fetchQuote } from './api/fetchQuote';
import corsMiddleware from './middleware/cors';
import { sendPrompt } from './api/sendPrompt';
import { conversation, getConversationById, getConversations, addTag, editTag, removeTag } from './api/conversation';

dotenv.config();

const app = express();

// Use CORS middleware
app.use(corsMiddleware);

// Middleware to parse JSON bodies
app.use(express.json());

// Total recall API
app.get('/conversation', getConversationById);
app.post('/conversation', conversation);
app.get('/conversations', getConversations); // Add this line to define the GET /conversations endpoint

app.post('/tag', addTag); // add tag
app.put('/tag', editTag); // edit tag
app.delete('/tag', removeTag);

// Dream catcher API
app.post('/sendPrompt', sendPrompt);
app.get('/fetchQuote', fetchQuote);

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
