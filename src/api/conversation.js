import axios from 'axios'
import { Anthropic } from '@anthropic-ai/sdk'
import corsMiddleware from '../middleware/cors'
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from '@aws-sdk/client-dynamodb'
import dotenv from 'dotenv'
import zlib from 'zlib'
import util from 'util'

// Load environment variables
dotenv.config()

// Initialize DynamoDB client
const dynamoDBClient = new DynamoDBClient({
  region: process.env.CONF_AWS_REGION,
  credentials: {
    accessKeyId: process.env.CONF_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.CONF_AWS_SECRET_ACCESS_KEY,
  },
})

const gzip = util.promisify(zlib.gzip)
const gunzip = util.promisify(zlib.gunzip)

const compressData = async (data) => {
  const jsonData = JSON.stringify(data)
  const compressedData = await gzip(jsonData)
  return compressedData.toString('base64')
}

const decompressData = async (compressedData) => {
  const buffer = Buffer.from(compressedData, 'base64')
  const decompressedData = await gunzip(buffer)
  return JSON.parse(decompressedData.toString())
}

export const saveConversation = async (conversationId, conversation) => {
  const compressedConversation = await compressData(conversation)
  const params = {
    TableName: 'Conversations',
    Item: {
      conversationId: { S: conversationId },
      conversation: { S: compressedConversation },
    },
  }

  try {
    await dynamoDBClient.send(new PutItemCommand(params))
  } catch (error) {
    console.error('Error saving conversation:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to save conversation',
    })
  }
}

export const getConversation = async (conversationId) => {
  const params = {
    TableName: 'Conversations',
    Key: {
      conversationId: { S: conversationId },
    },
  }

  try {
    const data = await dynamoDBClient.send(new GetItemCommand(params))
    if (data.Item) {
      return await decompressData(data.Item.conversation.S)
    }
    return null
  } catch (error) {
    console.error('Error getting conversation:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to get conversation',
    })
  }
}

const summarizeConversation = async (messages, apiKey) => {
  const apiUrl = 'https://api.openai.com/v1/chat/completions'
  console.log('sending conversaion summary request')
  const response = await axios.post(
    apiUrl,
    {
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content:
            'Summarize the following conversation with key points. The summary should be as short as possible and only include the minimum required to maintain context.',
        },
        ...messages,
      ],
      max_tokens: 50, // Adjust as needed to keep the summary short
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    },
  )
  return response.data.choices[0].message.content
}

const sendToChatGPT = async (messages, apiKey, summary) => {
  const apiUrl = 'https://api.openai.com/v1/chat/completions'
  const response = await axios.post(
    apiUrl,
    {
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'Use the following summary to maintain context: ' + summary,
        },
        ...messages,
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    },
  )
  return response.data.choices[0].message.content
}

const sendToAnthropic = async (prompt, apiKey) => {
  const anthropic = new Anthropic({
    apiKey: apiKey,
  })

  console.log('prompt', prompt)
  console.log('apiKey', apiKey)

  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20240620',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })
  return response.data.choices[0].message.content
}

export const conversation = async (req, res) => {
  await corsMiddleware(event)

  const { prompt, provider, conversationId } = req.body

  const apiKeyOpenAI = process.env.private.OPENAI_API_KEY
  const apiKeyAnthropic = process.env.ANTHROPIC_API_KEY

  // Retrieve existing conversation or create a new one
  let conversation
  if (conversationId) {
    conversation = await getConversation(conversationId)
  } else {
    conversation = {
      id: undefined,
      text: '',
      tags: [],
      messages: [],
      summary: '', // Add summary property
    }
  }

  // Check if conversation history exists
  if (conversation.messages.length > 0) {
    // Append the next prompt to the existing conversation
    conversation.messages.push({ role: 'user', content: prompt })
    // Summarize the conversation
    conversation.summary = await summarizeConversation(
      conversation.messages,
      apiKeyOpenAI,
    )
  } else {
    // Create a new conversation with the first prompt
    conversation.messages = [{ role: 'user', content: prompt }]
    conversation.summary = '' // No summary needed for the first prompt
  }

  console.log('conversation', conversation)

  let responseContent
  if (provider === 'openai') {
    responseContent = await sendToChatGPT(
      conversation.messages,
      apiKeyOpenAI,
      conversation.summary,
    )
  } else if (provider === 'anthropic') {
    responseContent = await sendToAnthropic(
      conversation.messages,
      apiKeyAnthropic,
    )
  } else {
    throw createError({ statusCode: 400, statusMessage: 'Invalid provider' })
  }

  // Add the response to the conversation
  conversation.messages.push({ role: 'assistant', content: responseContent })

  // Store the updated conversation
  if (conversationId) {
    await saveConversation(conversationId, conversation)
  }

  return responseContent
}
