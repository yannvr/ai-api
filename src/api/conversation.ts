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
import { compressData, decompressData } from "../utils";
import { Bot, Message } from "./ai-bot";
import _ from "lodash";

// Load environment variables
dotenv.config();


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
  let conversationData: Conversation | any = conversation;
  if (process.env.USE_COMPRESSION === "1") {
    conversationData = await compressData(conversation);
  } else {
    conversationData = JSON.stringify(conversation);
  }

  const conversationId = conversation.id || Date.now();

  const params = {
    TableName: "conversations",
    Item: {
      conversationId: { S: String(conversationId) },
      conversation: { S: conversationData },
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
  console.log("conversationId", conversationId);
  const params = {
    TableName: "conversations",
    Key: {
      conversationId: { S: String(conversationId) },
    },
  };

  try {
    const data: GetItemCommandOutput = await dynamoDBClient.send(
      new GetItemCommand(params)
    );
    console.log("data", data);
    if (data.Item) {
      if (process.env.USE_COMPRESSION === "1") {
        return await decompressData(data.Item.conversation.S);
      } else {
        return JSON.parse(data.Item.conversation.S);
      }
    }
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
    let _conversation: Conversation = {
      id: undefined,
      text: "",
      tags: [],
      messages: [{ role: "user", content: prompt }],
      summary: "", // Add summary property
    };

    if (conversationId) {
      _conversation = await getConversation(conversationId);
      console.log("continuing conversation", _conversation);
    } else {
      console.log("starting new conversation", _conversation);
    }

    const response = await bot.send(_conversation.messages);

    _conversation.messages.push({ role: "assistant", content: response });
    await saveConversation(_conversation);

    res.status(200).json({ response });
  } catch (error) {
    console.error("Error processing conversation:", error);
    res.status(500).send("Failed to process conversation");
  }
};
