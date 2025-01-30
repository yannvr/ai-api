import { Request, Response } from 'express';
import { UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { getConversation } from "./conversation";
import { Conversation } from "./ai-bot";
import { dynamoDBClient } from "./dynamoDBClient";

export const updateConversationName = async (req: Request, res: Response) => {
  const { conversationId, newName: name } = req.body;

  try {
    const conversation = await getConversation(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const params = {
      TableName: "conversations",
      Key: {
        conversationId: { S: conversationId },
      },
      UpdateExpression: "SET #name = :name",
      ExpressionAttributeNames: {
        "#name": "name",
      },
      ExpressionAttributeValues: marshall({
        ":name": name,
      }),
      ReturnValues: "ALL_NEW" as const,
    };

    const result = await dynamoDBClient.send(new UpdateItemCommand(params));
    const updatedConversation = result.Attributes ? unmarshall(result.Attributes) as Conversation : null;

    res.status(200).json({ message: "Conversation name updated successfully", updatedConversation });
  } catch (error) {
    console.error("Error updating conversation name:", error);
    res.status(500).json({ message: "Failed to update conversation name" });
  }
};
