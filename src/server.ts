import dotenv from 'dotenv';
import express from 'express';
import { addTag, deleteTag, editTag } from './api/tags';
import { conversation, getConversationById, getConversations } from './api/conversation';
import { fetchQuote } from './api/fetchQuote';
import { sendPrompt } from './api/sendPrompt';
import { updateConversationName } from './api/name';
import { addMessage } from './api/messages';
import corsMiddleware from './middleware/cors';

dotenv.config();

const app = express();

app.use(corsMiddleware);
app.use(express.json());

app.get('/conversation', getConversationById);
app.get('/conversations', getConversations);
app.post('/conversation', conversation);

app.post('/conversation/tag', addTag);
app.put('/conversation/tag', editTag);
app.delete('/conversation/tag', deleteTag);

app.post('/sendPrompt', sendPrompt);
app.get('/fetchQuote', fetchQuote);

app.put('/conversation/name', updateConversationName);
app.post('/conversation/message', addMessage);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
