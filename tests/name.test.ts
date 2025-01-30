import request from 'supertest';
import express from 'express';
import { dynamoDBClient } from '../src/api/dynamoDBClient';
import { updateConversationName } from '../src/api/name';

// Mock DynamoDB
jest.mock('./dynamoDBClient', () => ({
  dynamoDBClient: {
    send: jest.fn()
  }
}));

const app = express();
app.use(express.json());

app.put('/conversation/name', updateConversationName);

describe('Update Conversation Name API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update the name of an existing conversation', async () => {
    // First call to check conversation
    (dynamoDBClient.send as jest.Mock).mockResolvedValueOnce({
      Item: {
        conversationId: { S: 'test-id' },
        name: { S: 'Old Name' }
      }
    });
    // Second call to update name
    (dynamoDBClient.send as jest.Mock).mockResolvedValueOnce({
      Attributes: {
        conversationId: { S: 'test-id' },
        name: { S: 'New Name' }
      }
    });

    const response = await request(app).put('/conversation/name').send({
      conversationId: 'test-id',
      newName: 'New Name'
    });
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Conversation name updated successfully');
    expect(response.body.updatedConversation.name).toBe('New Name');
  });

  it('should return 404 if conversation not found', async () => {
    (dynamoDBClient.send as jest.Mock).mockResolvedValueOnce({ Item: undefined });
    const response = await request(app).put('/conversation/name').send({
      conversationId: 'missing-id',
      newName: 'New Name'
    });
    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Conversation not found');
  });

  it('should handle errors gracefully', async () => {
    (dynamoDBClient.send as jest.Mock).mockRejectedValue(new Error('DB Error'));
    const response = await request(app).put('/conversation/name').send({
      conversationId: 'test-id',
      newName: 'New Name'
    });
    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Failed to update conversation name');
  });
});
