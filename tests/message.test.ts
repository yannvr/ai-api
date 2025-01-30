import request from 'supertest';
import express from 'express';
import { addMessage } from './messages';
import { dynamoDBClient } from './dynamoDBClient';

// Mock DynamoDB
jest.mock('./dynamoDBClient', () => ({
  dynamoDBClient: {
    send: jest.fn()
  }
}));

const app = express();
app.use(express.json());

app.post('/messages', addMessage);

describe('Messages API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /messages', () => {
    it('should add a message to an existing conversation', async () => {
      // First call to get conversation
      (dynamoDBClient.send as jest.Mock).mockResolvedValueOnce({
        Item: {
          conversationId: { S: 'test-id' },
          messages: []
        }
      });
      // Second call to update messages
      (dynamoDBClient.send as jest.Mock).mockResolvedValueOnce({
        Attributes: {
          conversationId: { S: 'test-id' },
          messages: [{ role: 'user', content: { type: 'text', text: 'Hello' } }]
        }
      });

      const response = await request(app).post('/messages').send({
        conversationId: 'test-id',
        message: { role: 'user', content: { type: 'text', text: 'Hello' } }
      });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Message added successfully');
      expect(response.body.updatedConversation.messages.length).toBe(1);
    });

    it('should return 404 if conversation not found', async () => {
      (dynamoDBClient.send as jest.Mock).mockResolvedValueOnce({ Item: undefined });
      const response = await request(app).post('/messages').send({
        conversationId: 'unknown-id',
        message: { role: 'user', content: { type: 'text', text: 'Hello' } }
      });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Conversation not found');
    });

    it('should handle errors gracefully', async () => {
      (dynamoDBClient.send as jest.Mock).mockRejectedValue(new Error('DB Error'));
      const response = await request(app).post('/messages').send({
        conversationId: 'test-id',
        message: { role: 'user', content: { type: 'text', text: 'Hello' } }
      });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Failed to add message');
    });
  });
});
