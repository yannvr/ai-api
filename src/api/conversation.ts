import {
  DeleteItemCommand,
  GetItemCommand,
  GetItemCommandOutput,
  PutItemCommand,
  ScanCommand,
  ScanCommandOutput,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import { Bot, Conversation, Message } from "./ai-bot";
import { dynamoDBClient } from "./dynamoDBClient";
import { ContentBlock } from "@anthropic-ai/sdk/resources";

// Load environment variables
dotenv.config();

export const saveConversation = async (conversation: Conversation) => {
  console.log("about to save conversation", conversation);
  const conversationId = uuidv4();
  // if (!conversation.name) {
  //   // Generate a name for the conversation using the first 5 words of the prompt
  //   const firstMessage = conversation.messages[0]?.content || "";
  //   const firstFiveWords = firstMessage.split(" ").slice(0, 5).join(" ");
  //   conversation.name = firstFiveWords || "Untitled Conversation";
  // }

  const params = {
    TableName: "conversations",
    Item: marshall({
      conversationId,
      ...conversation,
    }),
  };

  console.log("SAVING CONVERSATION:", conversationId);

  try {
    await dynamoDBClient.send(new PutItemCommand(params));
    return conversationId;
  } catch (error) {
    console.error("Error saving conversation:", error);
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
    // console.log("data", data);
    if (data.Item) {
      const conversation = unmarshall(data.Item) as Conversation;
      return conversation;
    }
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "ResourceNotFoundException") {
      console.warn("Resource not found:", error.message);
    } else {
      console.error("Error getting conversation:", error);
      throw new Error("Failed to get conversation");
    }
  }
};

export const appendMessage = async (
  conversationId: string,
  message: Message
) => {
  const params = {
    TableName: "conversations",
    Key: {
      conversationId: { S: String(conversationId) },
    },
    UpdateExpression: "SET messages = list_append(messages, :message)",
    ExpressionAttributeValues: marshall({
      ":message": [message],
    }),
    ReturnValues: "ALL_NEW" as const,
  };

  try {
    const result = await dynamoDBClient.send(new UpdateItemCommand(params));
    return unmarshall(result.Attributes) as Conversation;
  } catch (error) {
    console.error("Error appending message:", error);
    throw new Error("Failed to append message");
  }
};

export const updateTags = async (req, res) => {
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
      ReturnValues: "ALL_NEW",
    };

    const result = await dynamoDBClient.send(new UpdateItemCommand(params));
    const updatedConversation = unmarshall(result.Attributes) as Conversation;

    res
      .status(200)
      .json({ message: "Tags updated successfully", updatedConversation });
  } catch (error) {
    console.error("Error updating tags:", error);
    res.status(500).json({ message: "Failed to update tags" });
  }
};

export const getConversations = async (req, res) => {
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
    let conversations = [];
    if (data.Items?.length > 0) {
      conversations = data.Items.map((c) => unmarshall(c));
      // parse conversation in conversations to return according to the interface
    }

    res.status(200).json(conversations);
  } catch (error) {
    console.error("Error getting conversations:", error);
    res.status(500).json({ message: "Failed to get conversations" });
  }
};

export const getConversationById = async (req, res) => {
  const { conversationId } = req.query; // Extract id from query parameters

  try {
    console.log("🚀 ~ getConversationById ~ conversationId", conversationId);
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

export const conversation = async (req, res) => {
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
        messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
        summary: "",
      };

      console.log('new conversation:', newConversation);
      // push the AI response message to the conversation
      const response = await bot.send(newConversation);
      newConversation.messages.push(response);
      console.log('new conversation with response:', newConversation);


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
      console.log('continuing conversation:', conversationId);
      const conversation = await getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

    // push the user message to the conversation
    conversation.messages.push({ role: "user", content: [{ type: "text", text: prompt }] });
    // push the AI response message to the conversation
    console.log('conversation:', conversation);
    const response = await bot.send(conversation);
    // console.log('response:', response);
    conversation.messages.push(response);

    const updatedConversationId = await saveConversation(conversation);
    res.status(200).json({ conversationId: updatedConversationId, ...conversation });
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  }
};


export const deleteConversation = async (req, res) => {
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
