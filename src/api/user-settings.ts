import { GetItemCommand, PutItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { dynamoDBClient } from "./dynamoDBClient";

export const updateSettings = async (req, res) => {
  const { userId, settings } = req.body;

  try {
    // Check if user exists
    const getUserParams = {
      TableName: "conversations",
      Key: { userId }
    };

    const user = await dynamoDBClient.send(new GetItemCommand(getUserParams));

    if (!user.Item) {
      console.log("🚀 ~ updateSettings ~ search:", user);
      // User not found, create new user
      const createUserParams = {
        TableName: "conversations",
        Item: {
          userId,
          settings
        }
      };

      await dynamoDBClient.send(new PutItemCommand(createUserParams));
      res.status(201).send({ message: 'User created', userId, settings });
    } else {
      // User exists, update settings
      const updateUserParams = {
        TableName: "conversations",
        Key: { userId },
        UpdateExpression: 'set settings = :settings',
        ExpressionAttributeValues: {
          ':settings': settings
        },
        ReturnValues: 'UPDATED_NEW' as const
      };

      const updatedUser = await dynamoDBClient.send(new UpdateItemCommand(updateUserParams));
      res.status(200).send({ message: 'User settings updated', updatedUser });
    }
  } catch (error) {
    console.error('Error updating user settings:', error);
    res.status(500).send({ message: 'Internal Server Error' });
  }
};
