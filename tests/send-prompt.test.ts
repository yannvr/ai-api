import request from 'supertest';
import express from 'express';
import { sendPrompt } from '../src/api/sendPrompt';

// If sendPrompt uses external AI services, you could mock them similarly.
const app = express();
app.use(express.json());

app.post('/sendPrompt', sendPrompt);

describe('Send Prompt API', () => {
  it('should send a prompt to the AI model and return a response', async () => {
    // You might mock the AI call if it's external
    const response = await request(app).post('/sendPrompt').send({
      prompt: 'Hello AI',
      provider: 'openai'
    });
    expect(response.status).toBe(200);
    expect(response.body).toBeDefined();
  });

  it('should handle errors gracefully', async () => {
    // If you simulate an error from the AI provider or your logic
    // e.g. jest.spyOn(Bot.prototype, 'send').mockRejectedValueOnce(...)
  });
});
