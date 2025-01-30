import {
  DeleteItemCommand,
  GetItemCommand,
  GetItemCommandOutput,
  PutItemCommand,
  ReturnValue,
  ScanCommand,
  ScanCommandOutput,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import dotenv from "dotenv";
import { Request, Response } from 'express';
import { v4 as uuidv4 } from "uuid";
import { Bot, Conversation, Message } from "./ai-bot";
import { dynamoDBClient } from "./dynamoDBClient";
import { log, error } from "../utils/logger";

// Load environment variables
dotenv.config();

export const saveConversation = async (conversation: Conversation): Promise<string> => {
  const conversationId = uuidv4();

  const params = {
    TableName: "conversations",
    Item: marshall({
      conversationId,
      ...conversation,
    }),
  };

  log("SAVING CONVERSATION:", conversationId);

  try {
    await dynamoDBClient.send(new PutItemCommand(params));
    return conversationId;
  } catch (err) {
    error("Error saving conversation:", err);
    throw new Error("Failed to save conversation");
  }
};

export const getConversation = async (
  conversationId: string
): Promise<Conversation | undefined> => {
  const params = {
    TableName: "conversations",
    Key: {
      conversationId: { S: conversationId },
    },
  };

  try {
    const data: GetItemCommandOutput = await dynamoDBClient.send(
      new GetItemCommand(params)
    );
    if (data.Item) {
      const conversation = unmarshall(data.Item) as Conversation;
      return conversation;
    }
  } catch (err) {
    error("Error getting conversation:", err);
    throw new Error("Failed to get conversation");
  }
};

export const appendMessage = async (
  conversationId: string,
  message: Message
): Promise<Conversation> => {
  const params = {
    TableName: "conversations",
    Key: {
      conversationId: { S: String(conversationId) },
    },
    UpdateExpression: "SET messages = list_append(messages, :message)",
    ExpressionAttributeValues: marshall({
      ":message": [message],
    }),
    ReturnValues: ReturnValue.ALL_NEW,
  };

  try {
    const result = await dynamoDBClient.send(new UpdateItemCommand(params));
    if (result.Attributes) {
      return unmarshall(result.Attributes) as Conversation;
    }
    throw new Error("Failed to append message: Attributes are undefined");
  } catch (error) {
    console.error("Error appending message:", error);
    throw new Error("Failed to append message");
  }
};

export const updateTags = async (req: Request, res: Response) => {
  const { conversationId, tags } = req.body;

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
      UpdateExpression: "SET tags = :tags",
      ExpressionAttributeValues: marshall({
        ":tags": tags,
      }),
      ReturnValues: ReturnValue.ALL_NEW,
    };

    const result = await dynamoDBClient.send(new UpdateItemCommand(params));
    const updatedConversation = result.Attributes ? unmarshall(result.Attributes) as Conversation : undefined;

    res
      .status(200)
      .json({ message: "Tags updated successfully", updatedConversation });
  } catch (error) {
    console.error("Error updating tags:", error);
    res.status(500).json({ message: "Failed to update tags" });
  }
};

export const getConversations = async (req: Request, res: Response) => {
  const { limit = 10 } = req.query;

  const params = {
    TableName: "conversations",
    Limit: Number(limit),
    ScanIndexForward: false, // Sort by ID in descending order
  };

  try {
    const data: ScanCommandOutput = await dynamoDBClient.send(
      new ScanCommand(params)
    );
    let conversations: Conversation[] = [];
    if (data.Items && data.Items.length > 0) {
      conversations = data.Items.map((c) => unmarshall(c) as Conversation) ?? [];
    }

    res.status(200).json(conversations);
  } catch (error) {
    console.error("Error getting conversations:", error);
    res.status(500).json({ message: "Failed to get conversations" });
  }
};

export const getConversationById = async (req: Request, res: Response) => {
  const { conversationId } = req.query; // Extract id from query parameters

  try {
    if (!conversationId) {
      return res.status(400).json({ message: "conversationId is required" });
    }
    const conversation = await getConversation(conversationId as string);
    if (conversation) {
      res.status(200).json(conversation);
    } else {
      res.status(404).json({ message: "Conversation not found" });
    }
  } catch (error) {
    console.error("Error getting conversation:", error);
    res.status(500).json({ message: "Failed to get conversation" });
  }
};

export const conversation = async (req: Request, res: Response) => {
  const { prompt, provider, conversationId, model } = req.body;
  const apiKey =
    provider === "openai"
      ? process.env.OPENAI_API_KEY
      : process.env.ANTHROPIC_API_KEY;
  const bot = new Bot(provider, apiKey!);

  if (!conversationId) {
    try {
      // Provide an empty conversation if no conversationId is given
      const newConversation: Conversation = {
        name: "",
        tags: [],
        messages: [{ role: "user", content: { type: "text", text: prompt } }],
        summary: "",
      };

      // push the AI response message to the conversation
      const response = await bot.send(newConversation);
      newConversation.messages.push(response);
      log('new conversation with response:', newConversation);

      const newConversationId = await saveConversation(newConversation);
      res
        .status(201)
        .json({ conversationId: newConversationId, ...newConversation });
    } catch (error) {
      console.error("Error saving conversation:", error);
      res.status(500).json({ message: "Failed to save conversation" });
    }
  } else {
    try {
      log('continuing conversation:', conversationId);
      const conversation = await getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      // push the user message to the conversation
      conversation.messages.push({ role: "user", content: { type: "text", text: prompt } });
      // push the AI response message to the conversation
      log('conversation:', conversation);
      const response = await bot.send(conversation);
      conversation.messages.push(response);

      const updatedConversationId = await saveConversation(conversation);
      res.status(200).json({ conversationId: updatedConversationId, ...conversation });
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  }
};

export const deleteConversation = async (req: Request, res: Response) => {
  const { conversationId } = req.body;

  try {
    const params = {
      TableName: "conversations",
      Key: {
        conversationId: { S: conversationId },
      },
    };

    await dynamoDBClient.send(new DeleteItemCommand(params));
    res.status(200).json({ message: "Conversation deleted successfully" });
  } catch (error) {
    console.error("Error deleting conversation:", error);
    res.status(500).json({ message: "Failed to delete conversation" });
  }
};
