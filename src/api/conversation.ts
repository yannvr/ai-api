import axios from "axios";
import { Anthropic } from "@anthropic-ai/sdk";
import {
  DynamoDBClient,
  GetItemCommand,
  GetItemCommandOutput,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import dotenv from "dotenv";
import zlib from "zlib";
import util from "util";
import { decompressData } from "../utils";
import { Bot, Message } from "./ai-bot";

// Load environment variables
dotenv.config();

interface Conversation {
  id: string | undefined;
  text: string;
  tags: string[];
  messages: Message[];
  summary: string;
}

// Ensure environment variables are defined
const { CONF_AWS_REGION, CONF_AWS_ACCESS_KEY_ID, CONF_AWS_SECRET_ACCESS_KEY } =
  process.env;

if (
  !CONF_AWS_REGION ||
  !CONF_AWS_ACCESS_KEY_ID ||
  !CONF_AWS_SECRET_ACCESS_KEY
) {
  throw new Error("AWS configuration environment variables are not set");
}

// Initialize DynamoDB client
const dynamoDBClient = new DynamoDBClient({
  region: CONF_AWS_REGION,
  credentials: {
    accessKeyId: CONF_AWS_ACCESS_KEY_ID,
    secretAccessKey: CONF_AWS_SECRET_ACCESS_KEY,
  },
});

export const saveConversation = async (conversation: Conversation) => {
  // const compressedConversation = await compressData(conversation)
  const compressedConversation = conversation;
  const params = {
    TableName: "Conversations",
    Item: {
      conversationId: { S: String(conversation.id) },
      conversation: { S: conversation },
    },
  };

  try {
    await dynamoDBClient.send(new PutItemCommand(params));
  } catch (error) {
    console.error("Error saving conversation:", error);
    throw new Error("Failed to save conversation");
  }
};

export const getConversation = async (conversationId) => {
  const params = {
    TableName: "Conversations",
    Key: {
      conversationId: { S: String(conversationId) },
    },
  };

  try {
    const data: GetItemCommandOutput = await dynamoDBClient.send(
      new GetItemCommand(params)
    );
    if (data.Item) {
      return await decompressData(data.Item.conversation.S);
    }
    return null;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "ResourceNotFoundException") {
      console.warn("Resource not found:", error.message);
      return null;
    } else {
      console.error("Error getting conversation:", error);
      throw new Error("Failed to get conversation");
    }
  }
};

export const conversation = async (req, res) => {
  const { prompt, provider, conversationId } = req.body;
  const apiKey =
    provider === "openai"
      ? process.env.OPENAI_API_KEY
      : process.env.ANTHROPIC_API_KEY;
  const bot = new Bot(provider, apiKey!);

  try {
    let conversation: Conversation = await getConversation(conversationId);

    if (!conversation) {
      console.log("starting new conversation");
      conversation = {
        id: undefined,
        text: "",
        tags: [],
        messages: [{ role: "user", content: prompt }],
        summary: "", // Add summary property
      };
    }

    const response = await bot.send(conversation.messages);

    conversation.messages.push({ role: "assistant", content: response });
    await saveConversation(conversation);

    res.status(200).json({ response });
  } catch (error) {
    console.error("Error processing conversation:", error);
    res.status(500).send("Failed to process conversation");
  }
};
