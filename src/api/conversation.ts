import {
  DynamoDBClient,
  GetItemCommand,
  GetItemCommandOutput,
  PutItemCommand,
  UpdateItemCommand,
  ScanCommand,
  ScanCommandOutput,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import dotenv from "dotenv";
import { compressData, decompressData } from "../utils";
import { Bot, Conversation, Message } from "./ai-bot";
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
) => {
  console.log("about to save conversation", conversation);
  const conversationId = Date.now().toString();
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

  console.log("SAVING CONVERSATION:", conversation);

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
  console.log("conversationId", conversationId);
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
    console.log("data", data);
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

    res.status(200).json({ message: "Tags updated successfully", updatedConversation });
  } catch (error) {
    console.error("Error updating tags:", error);
    res.status(500).json({ message: "Failed to update tags" });
  }
};

export const deleteTag = async (req, res) => {
  const { conversationId, tag } = req.body;

  try {
    const conversation = await getConversation(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const updatedTags = conversation.tags.filter(t => t !== tag);

    const params = {
      TableName: "conversations",
      Key: {
        conversationId: { S: conversationId },
      },
      UpdateExpression: "SET tags = :tags",
      ExpressionAttributeValues: marshall({
        ":tags": updatedTags,
      }),
      ReturnValues: "ALL_NEW",
    };

    const result = await dynamoDBClient.send(new UpdateItemCommand(params));
    const updatedConversation = unmarshall(result.Attributes) as Conversation;

    res.status(200).json({ message: "Tag deleted successfully", updatedConversation });
  } catch (error) {
    console.error("Error deleting tag:", error);
    res.status(500).json({ message: "Failed to delete tag" });
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
    }

    res.status(200).json({ conversations });
  } catch (error) {
    console.error("Error getting conversations:", error);
    res.status(500).json({ message: "Failed to get conversations" });
  }
};

export const addTag = async (req, res) => {
  const { conversationId, tag } = req.body;
  console.log("🚀 ~ addTag ~ { conversationId, tag }:", conversationId, tag )

  try {
    const params = {
      TableName: "conversations",
      Key: {
        conversationId: { S: conversationId.toString() },
      },
      // This will prevent DynamoDB from creating a new item if one doesn’t already exist with the provided id.
      // ConditionExpression: "attribute_exists(conversationId)",
      UpdateExpression: "SET tags = list_append(if_not_exists(tags, :empty_list), :new_tag)",
      ExpressionAttributeValues: {
        ":new_tag": { L: [{ S: tag }] },
        ":empty_list": { L: [] },
      },
      ReturnValues: "ALL_NEW",
    };
    console.log("🚀 ~ addTag ~ params:", params)

    const result = await dynamoDBClient.send(new UpdateItemCommand(params));
    const updatedConversation = unmarshall(result.Attributes) as Conversation;

    res.status(200).json({ message: "Tag added successfully", conversationId, updatedConversation });
  } catch (error) {
    console.error("Error adding tag:", error);
    res.status(500).json({ message: "Failed to add tag" });
  }
};

export const editTag = async (req, res) => {
  const { conversationId, oldTag, newTag } = req.body;
  console.log("🚀 ~ editTag ~ { conversationId, oldTag, newTag }:", conversationId, oldTag, newTag);

  try {
    const conversation = await getConversation(conversationId);
    console.log("🚀 ~ editTag ~ conversation:", conversation)
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    // Update the tags array
    const updatedTags = conversation.tags.map((t) => (t === oldTag ? newTag : t));
    console.log("🚀 ~ editTag ~ updatedTags", updatedTags);

    const params = {
      TableName: "conversations",
      Key: marshall({
        conversationId: conversationId,
      }),
      UpdateExpression: "SET tags = :tags",
      ExpressionAttributeValues: marshall({
        ":tags": updatedTags,
      }),
      ReturnValues: "ALL_NEW",
    };

    console.log("🚀 ~ editTag ~ params:", JSON.stringify(params, null, 2));

    const result = await dynamoDBClient.send(new UpdateItemCommand(params));
    const updatedConversation = unmarshall(result.Attributes);

    // If tags is a Set, convert it to an array for serialization
    if (updatedConversation.tags instanceof Set) {
      updatedConversation.tags = Array.from(updatedConversation.tags);
    }

    res.status(200).json({ message: "Tag edited successfully", updatedConversation });
  } catch (error) {
    console.error("Error editing tag:", error);
    res.status(500).json({ message: "Failed to edit tag" });
  }
};


export const getConversationById = async (req, res) => {
  const { id } = req.query; // Extract id from query parameters

  try {
    const conversation = await getConversation(id as string);
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
  const { conversationId, conversation, provider } = req.body;
  const apiKey =
    provider === "openai"
      ? process.env.OPENAI_API_KEY
      : process.env.ANTHROPIC_API_KEY;
  const bot = new Bot(provider, apiKey!);

  try {
    if (conversationId) {
      // Update existing conversation
      const existingConversation = await getConversation(conversationId);
      if (!existingConversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      // Append message to the conversation using appendMEssage function
      await appendMessage(String(conversationId), conversation.messages[0]);
      res.status(200).json("message added to conversation");
    } else {
      // Provide an empty conversation if no conversationId is given
      const newConversation = {
        id: Date.now().toString(),
        name: "",
        tags: [],
        messages: [{ role: "user", content: prompt }],
        summary: "",
      };

      // push the AI response message to the conversation
      const response = await bot.send(newConversation);
      newConversation.messages.push(response);


      const newConversationId = await saveConversation(newConversation);
      res.status(201).json({ message: "New empty conversation provided", conversationId: newConversationId, conversation: newConversation });
    }
  } catch (error) {
    console.error("Error saving conversation:", error);
    res.status(500).json({ message: "Failed to save conversation" });
  }
};
