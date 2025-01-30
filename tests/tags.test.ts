import request from 'supertest';
import express from 'express';
import { dynamoDBClient } from '../src/api/dynamoDBClient';
import { addTag, editTag, deleteTag } from '../src/api/tags';

// Mock DynamoDB
jest.mock('./dynamoDBClient', () => ({
  dynamoDBClient: {
    send: jest.fn()
  }
}));

const app = express();
app.use(express.json());

app.post('/conversation/tag', addTag);
app.put('/conversation/tag', editTag);
app.delete('/conversation/tag', deleteTag);

describe('Tags API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /conversation/tag', () => {
    it('should add a new tag to a conversation', async () => {
      // Mock DB calls
      (dynamoDBClient.send as jest.Mock).mockResolvedValueOnce({
        Item: {
          conversationId: { S: 'test-id' },
          tags: []
        }
      }); // to check if conversation exists
      (dynamoDBClient.send as jest.Mock).mockResolvedValueOnce({
        Attributes: {
          conversationId: { S: 'test-id' },
          tags: ['new-tag']
        }
      });

      const response = await request(app).post('/conversation/tag').send({
        conversationId: 'test-id',
        tag: 'new-tag'
      });
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Tag added successfully');
      expect(response.body.updatedConversation.tags).toContain('new-tag');
    });

    it('should return 404 if conversation does not exist', async () => {
      (dynamoDBClient.send as jest.Mock).mockResolvedValueOnce({ Item: undefined });
      const response = await request(app).post('/conversation/tag').send({
        conversationId: 'unknown-id',
        tag: 'new-tag'
      });
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Conversation not found');
    });

    it('should handle errors gracefully', async () => {
      (dynamoDBClient.send as jest.Mock).mockRejectedValue(new Error('DB Error'));
      const response = await request(app).post('/conversation/tag').send({
        conversationId: 'test-id',
        tag: 'new-tag'
      });
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Failed to add tag');
    });
  });

  describe('PUT /conversation/tag', () => {
    it('should edit a tag in a conversation', async () => {
      (dynamoDBClient.send as jest.Mock).mockResolvedValueOnce({
        Item: {
          conversationId: { S: 'test-id' },
          tags: ['old-tag']
        }
      });
      (dynamoDBClient.send as jest.Mock).mockResolvedValueOnce({
        Attributes: {
          conversationId: { S: 'test-id' },
          tags: ['new-tag']
        }
      });

      const response = await request(app).put('/conversation/tag').send({
        conversationId: 'test-id',
        oldTag: 'old-tag',
        newTag: 'new-tag'
      });
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Tag edited successfully');
      expect(response.body.updatedConversation.tags).toContain('new-tag');
      expect(response.body.updatedConversation.tags).not.toContain('old-tag');
    });

    it('should return 404 if conversation does not exist', async () => {
      (dynamoDBClient.send as jest.Mock).mockResolvedValueOnce({ Item: undefined });
      const response = await request(app).put('/conversation/tag').send({
        conversationId: 'unknown-id',
        oldTag: 'old',
        newTag: 'new'
      });
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Conversation not found');
    });

    it('should handle errors gracefully', async () => {
      (dynamoDBClient.send as jest.Mock).mockRejectedValue(new Error('DB Error'));
      const response = await request(app).put('/conversation/tag').send({
        conversationId: 'test-id',
        oldTag: 'old',
        newTag: 'new'
      });
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Failed to edit tag');
    });
  });

  describe('DELETE /conversation/tag', () => {
    it('should delete a tag from a conversation', async () => {
      (dynamoDBClient.send as jest.Mock).mockResolvedValueOnce({
        Item: {
          conversationId: { S: 'test-id' },
          tags: ['test-tag']
        }
      });
      (dynamoDBClient.send as jest.Mock).mockResolvedValueOnce({
        Attributes: {
          conversationId: { S: 'test-id' },
          tags: []
        }
      });

      const response = await request(app).delete('/conversation/tag').send({
        conversationId: 'test-id',
        tag: 'test-tag'
      });
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Tag deleted successfully');
    });

    it('should return 404 if conversation does not exist', async () => {
      (dynamoDBClient.send as jest.Mock).mockResolvedValueOnce({ Item: undefined });
      const response = await request(app).delete('/conversation/tag').send({
        conversationId: 'unknown-id',
        tag: 'test-tag'
      });
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Conversation not found');
    });

    it('should handle errors gracefully', async () => {
      (dynamoDBClient.send as jest.Mock).mockRejectedValue(new Error('DB Error'));
      const response = await request(app).delete('/conversation/tag').send({
        conversationId: 'test-id',
        tag: 'test-tag'
      });
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Failed to delete tag');
    });
  });
});
