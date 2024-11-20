import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { getConversation } from "./conversation";
import { Conversation } from "./ai-bot";
import { dynamoDBClient } from "./dynamoDBClient";

export const addTag = async (req, res) => {
  const { conversationId, tag } = req.body;
  console.log("🚀 ~ addTag ~ { conversationId, tag }:", conversationId, tag );

  try {
    const params = {
      TableName: "conversations",
      Key: {
        conversationId: { S: conversationId.toString() },
      },
      UpdateExpression: "SET tags = list_append(if_not_exists(tags, :empty_list), :new_tag)",
      ExpressionAttributeValues: {
        ":new_tag": { L: [{ S: tag }] },
        ":empty_list": { L: [] },
      },
      ReturnValues: "ALL_NEW",
    };
    console.log("🚀 ~ addTag ~ params:", params);

    const result = await dynamoDBClient.send(new UpdateItemCommand(params));
    const updatedConversation = unmarshall(result.Attributes) as Conversation;

    res.status(200).json({ message: "Tag added successfully"});
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
    console.log("🚀 ~ editTag ~ conversation:", conversation);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

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

    if (updatedConversation.tags instanceof Set) {
      updatedConversation.tags = Array.from(updatedConversation.tags);
    }

    res.status(200).json({ message: "Tag edited successfully"});
  } catch (error) {
    console.error("Error editing tag:", error);
    res.status(500).json({ message: "Failed to edit tag" });
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

    res.status(200).json({ message: "Tag deleted successfully"});
  } catch (error) {
    console.error("Error deleting tag:", error);
    res.status(500).json({ message: "Failed to delete tag" });
  }
};
