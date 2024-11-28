import { UpdateItemCommand, ReturnValue } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { getConversation } from "./conversation";
import { Conversation, Message } from "./ai-bot";
import { dynamoDBClient } from "./dynamoDBClient";

export const addMessage = async (req, res) => {
  const { conversationId, message } = req.body;
  console.log("🚀 ~ addMessage ~ { conversationId, message }:", { conversationId, message });

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
      UpdateExpression: "SET messages = list_append(messages, :message)",
      ExpressionAttributeValues: marshall({
        ":message": [message],
      }),
      ReturnValues: ReturnValue.ALL_NEW,
    };

    const result = await dynamoDBClient.send(new UpdateItemCommand(params));
    const updatedConversation = result.Attributes ? unmarshall(result.Attributes) as Conversation : null;

    res.status(200).json({ message: "Message added successfully", updatedConversation });
  } catch (error) {
    console.error("Error adding message:", error);
    res.status(500).json({ message: "Failed to add message" });
  }
};
