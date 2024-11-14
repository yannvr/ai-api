import {
  DynamoDBClient,
  GetItemCommand,
  GetItemCommandOutput,
  PutItemCommand,
  ScanCommand,
  ScanCommandOutput,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import dotenv from "dotenv";
import { compressData, decompressData } from "../utils";
import { Bot, Conversation } from "./ai-bot";
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

export const saveConversation = async (
  conversation: Conversation,
  conversationId: number
) => {
  console.log("about to save conversation", conversation);
  let conversationData: Conversation | any = conversation;
  if (!conversationData.name) {
    // Generate a name for the conversation using the first 5 words of the prompt
    const firstMessage = conversation.messages[0]?.content || "";
    const firstFiveWords = firstMessage.split(" ").slice(0, 5).join(" ");
    conversationData.name = firstFiveWords || "Untitled Conversation";
  }
  if (process.env.USE_COMPRESSION === "1") {
    conversationData = await compressData(conversation);
  } else {
    conversationData = JSON.stringify(conversation);
  }


  try {
    if (!conversationId) {
      let conversationId = Date.now();
      let params = {
        TableName: "conversations",
        Item: {
          conversationId: { S: String(conversationId) },
          conversation: { S: conversationData },
        },
      };
      console.log(
        "SAVING NEW CONVERSATION:",
        conversationId,
        conversationData
      );
      await dynamoDBClient.send(new PutItemCommand(params));
    } else {
      let params = {
        TableName: "conversations",
        Key: {
          conversationId: { S: String(conversationId) },
        },
        UpdateExpression: "SET conversation = :conversation",
        ExpressionAttributeValues: {
          ":conversation": { S: conversationData },
        },
        ReturnValues: "ALL_NEW" as const,
      };

      console.log("UPDATING CONVERSATION:", conversationId, conversationData);
      await dynamoDBClient.send(new UpdateItemCommand(params));
    }
  } catch (error: any) {
    throw new Error("Error saving conversation:", error);
  }
};

export const getConversation = async (
  conversationId
): Promise<Conversation | undefined> => {
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
    if (data.Item) {
      if (process.env.USE_COMPRESSION === "1") {
        return (await decompressData(data.Item.conversation.S)) as Conversation;
      } else {
        return JSON.parse(data.Item.conversation.S!);
      }
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

export const conversation = async (req, res): Promise<Conversation | void> => {
  const { prompt, provider, conversationId } = req.body;
  const apiKey =
    provider === "openai"
      ? process.env.OPENAI_API_KEY
      : process.env.ANTHROPIC_API_KEY;
  const bot = new Bot(provider, apiKey!);

  try {
    let _conversation: Partial<Conversation> = {
      name: "",
      tags: [],
      messages: [{ role: "user", content: prompt }],
      summary: "", // Add summary property
    };
    let savedConversation: Conversation | null = null;

    if (conversationId) {
      savedConversation = await getConversation(conversationId);
      if (savedConversation) {
        // Append context to the conversation
        _conversation.summary = savedConversation.summary;
      }
      console.log("continuing conversation:", _conversation);
    } else {
      console.log("starting new conversation");
    }

    // AI response to the user message
    const aiResponseMessage = await bot.send(_conversation);

    if (savedConversation) {
      // Keep history of messages
      _conversation.messages = [
        ...savedConversation.messages,
        ..._conversation.messages,
      ];
    }
    // Append bot response to the conversation messages
    _conversation.messages.push(aiResponseMessage);
    const savedConversationId = await saveConversation(_conversation);
    _conversation.id = savedConversationId;

    res.status(200).json({ conversation: _conversation });
  } catch (error) {
    console.error("Error processing conversation:", error);
    res.status(500).send("Failed to process conversation");
  }
};

export const getConversationById = async (req, res) => {
  const { id } = req.query;

  try {
    const conversation = await getConversation(id);
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
      conversations = data.Items.map((c) => ({
        ...JSON.parse(c.conversation.S),
        id: c.conversationId.S,
      }));
    }

    res.status(200).json({ conversations });
  } catch (error) {
    console.error("Error getting conversations:", error);
    res.status(500).json({ message: "Failed to get conversations" });
  }
};

export const addTag = async (req, res) => {
  const { conversationId, tag } = req.body;

  console.log("conversationId", conversationId);
  console.log("tag", tag);

  try {
    const conversation = await getConversation(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    if (!conversation.tags.includes(tag)) {
      conversation.tags.push(tag);
    }
    await saveConversation(conversation, conversationId);

    res.status(200).send("ok");
  } catch (error) {
    console.error("Error adding tag:", error);
    res.status(500).json({ message: "Failed to add tag" });
  }
};

export const editTag = async (req, res) => {
  const { conversationId, oldTag, newTag } = req.body;

  try {
    const conversation = await getConversation(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    console.log("req.body", req.body);
    console.log("conversation", conversation);

    const tagIndex = conversation.tags.indexOf(oldTag);
    if (tagIndex !== -1) {
      conversation.tags[tagIndex] = newTag;
    } else {
      return res.status(404).json({ message: "Tag not found" });
    }
    await saveConversation(conversation, conversationId);

    res.status(200).send("ok");
  } catch (error) {
    console.error("Error updating tag:", error);
    res.status(500).json({ message: "Failed to update tag" });
  }
};

export const removeTag = async (req, res) => {
  const { conversationId, tag } = req.body;

  try {
    const conversation = await getConversation(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    console.log("conversation", conversation);
    console.log("conversation.tags", conversation.tags);

    conversation.tags = conversation.tags.filter((t) => t !== tag);
    console.log("conversation without tag", conversation);
    await saveConversation(conversation, conversationId);

    res.status(200).send("ok");
  } catch (error) {
    console.error("Error removing tag:", error);
    res.status(500).json({ message: "Failed to remove tag" });
  }
};
