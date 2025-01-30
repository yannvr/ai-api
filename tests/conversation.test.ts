import request from 'supertest';
import express from 'express';
import { getConversations, getConversationById, conversation, deleteConversation, updateTags } from './conversation';
import { dynamoDBClient } from '../src/api/dynamoDBClient';

// Mock DynamoDB
jest.mock('./dynamoDBClient', () => ({
  dynamoDBClient: {
    send: jest.fn()
  }
}));

const app = express();
app.use(express.json());

// Routes
app.get('/conversations', getConversations);
app.get('/conversation', getConversationById);
app.post('/conversation', conversation);
app.delete('/conversation', deleteConversation);
// If you have an endpoint for tags in conversation.ts:
app.put('/conversation/tags', updateTags);

describe('Conversation API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /conversations', () => {
    it('should retrieve a list of conversations', async () => {
      (dynamoDBClient.send as jest.Mock).mockResolvedValue({
        Items: [
          { conversationId: { S: 'test-id' }, name: { S: 'Test Conversation' } }
        ]
      });

      const response = await request(app).get('/conversations');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body[0].conversationId).toBe('test-id');
    });

    it('should handle DynamoDB errors gracefully', async () => {
      (dynamoDBClient.send as jest.Mock).mockRejectedValue(new Error('DB Error'));
      const response = await request(app).get('/conversations');
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Failed to get conversations');
    });
  });

  describe('GET /conversation', () => {
    it('should retrieve a conversation by ID', async () => {
      (dynamoDBClient.send as jest.Mock).mockResolvedValue({
        Item: {
          conversationId: { S: 'test-id' },
          name: { S: 'Test Conversation' }
        }
      });

      const response = await request(app).get('/conversation').query({ conversationId: 'test-id' });
      expect(response.status).toBe(200);
      expect(response.body.conversationId).toBe('test-id');
    });

    it('should return 404 if conversation not found', async () => {
      (dynamoDBClient.send as jest.Mock).mockResolvedValue({ Item: undefined });
      const response = await request(app).get('/conversation').query({ conversationId: 'missing-id' });
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Conversation not found');
    });
  });

  describe('POST /conversation', () => {
    it('should create a new conversation when no conversationId is provided', async () => {
      (dynamoDBClient.send as jest.Mock).mockResolvedValueOnce({}); // For AI response
      (dynamoDBClient.send as jest.Mock).mockResolvedValueOnce({}); // For saving conversation

      const response = await request(app).post('/conversation').send({
        prompt: 'Hello there',
        provider: 'openai'
      });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('conversationId');
    });

    it('should continue an existing conversation when a conversationId is provided', async () => {
      (dynamoDBClient.send as jest.Mock).mockResolvedValueOnce({
        Item: {
          conversationId: { S: 'existing-id' },
          messages: []
        }
      }); // Existing conversation
      (dynamoDBClient.send as jest.Mock).mockResolvedValueOnce({}); // For AI response
      (dynamoDBClient.send as jest.Mock).mockResolvedValueOnce({}); // For saving conversation

      const response = await request(app).post('/conversation').send({
        prompt: 'Continue please',
        provider: 'openai',
        conversationId: 'existing-id'
      });

      expect(response.status).toBe(200);
      expect(response.body.conversationId).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      (dynamoDBClient.send as jest.Mock).mockRejectedValue(new Error('DB Error'));
      const response = await request(app).post('/conversation').send({
        prompt: 'Hello',
        provider: 'openai'
      });
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Failed to save conversation');
    });
  });

  describe('DELETE /conversation', () => {
    it('should delete a conversation by ID', async () => {
      (dynamoDBClient.send as jest.Mock).mockResolvedValue({});
      const response = await request(app).delete('/conversation').send({ conversationId: 'test-id' });
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Conversation deleted successfully');
    });

    it('should handle errors gracefully', async () => {
      (dynamoDBClient.send as jest.Mock).mockRejectedValue(new Error('DB Error'));
      const response = await request(app).delete('/conversation').send({ conversationId: 'test-id' });
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Failed to delete conversation');
    });
  });

  describe('PUT /conversation/tags', () => {
    it('should update tags for a conversation', async () => {
      (dynamoDBClient.send as jest.Mock).mockResolvedValueOnce({
        Item: {
          conversationId: { S: 'tag-conversation' },
          tags: { L: [] }
        }
      }); // Checking conversation existence
      (dynamoDBClient.send as jest.Mock).mockResolvedValueOnce({
        Attributes: {
          conversationId: { S: 'tag-conversation' },
          tags: { L: [{ S: 'updated' }] }
        }
      });

      const response = await request(app).put('/conversation/tags').send({
        conversationId: 'tag-conversation',
        tags: ['updated']
      });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Tags updated successfully');
      expect(response.body.updatedConversation.tags).toEqual(['updated']);
    });

    it('should return 404 if conversation not found', async () => {
      (dynamoDBClient.send as jest.Mock).mockResolvedValue({ Item: undefined });
      const response = await request(app).put('/conversation/tags').send({
        conversationId: 'missing-id',
        tags: ['test']
      });
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Conversation not found');
    });

    it('should handle errors gracefully', async () => {
      (dynamoDBClient.send as jest.Mock).mockRejectedValue(new Error('DB Error'));
      const response = await request(app).put('/conversation/tags').send({
        conversationId: 'tag-conversation',
        tags: ['test']
      });
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Failed to update tags');
    });
  });
});
