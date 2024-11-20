import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import dotenv from "dotenv";

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
export const dynamoDBClient = new DynamoDBClient({
  region: CONF_AWS_REGION,
  credentials: {
    accessKeyId: CONF_AWS_ACCESS_KEY_ID,
    secretAccessKey: CONF_AWS_SECRET_ACCESS_KEY,
  },
});
