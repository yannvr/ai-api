import request from 'supertest';
import express from 'express';
import { updateSettings } from '../src/api/user-settings';
import { dynamoDBClient } from '../src/api/dynamoDBClient';

// Mock DynamoDB
jest.mock('./dynamoDBClient', () => ({
  dynamoDBClient: {
    send: jest.fn()
  }
}));

const app = express();
app.use(express.json());

app.post('/settings', updateSettings);

describe('User Settings API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create or update user settings', async () => {
    // For demonstration, we’ll assume your logic returns a 201
    (dynamoDBClient.send as jest.Mock).mockResolvedValue({});

    const response = await request(app).post('/settings').send({
      userId: 'test-user',
      settings: { theme: 'dark' }
    });
    expect(response.status).toBe(201);
    expect(response.body.message).toBeDefined();
  });

  it('should handle errors gracefully', async () => {
    (dynamoDBClient.send as jest.Mock).mockRejectedValue(new Error('DB Error'));
    const response = await request(app).post('/settings').send({
      userId: 'test-user',
      settings: { theme: 'dark' }
    });
    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Failed to update user settings');
  });
});
