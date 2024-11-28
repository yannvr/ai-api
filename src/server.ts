import dotenv from 'dotenv';
import express from 'express';
import { addTag, deleteTag, editTag } from './api/tags';
import { conversation as createConversation, getConversationById, getConversations } from './api/conversation';
import { fetchQuote } from './api/fetchQuote';
import { sendPrompt } from './api/sendPrompt';
import { updateConversationName } from './api/name';
import { addMessage } from './api/messages';
import corsMiddleware from './middleware/cors';

dotenv.config();

const app = express();

app.use(corsMiddleware);
app.use(express.json());

app.get('/conversations', getConversations);

app.get('/conversation', getConversationById);
app.post('/conversation', createConversation);
app.post('/conversation/tag', addTag);
app.put('/conversation/tag', editTag);
app.delete('/conversation/tag', deleteTag);
// app.post('/conversation/message', addMessage);

app.post('/sendPrompt', sendPrompt);
app.get('/fetchQuote', fetchQuote);

app.put('/conversation/name', updateConversationName);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
