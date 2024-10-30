// /* eslint-disable no-undef */
import axios from 'axios'
import { Anthropic } from '@anthropic-ai/sdk'

export const sendPrompt = async (req, res) => {
  const { prompt, provider } = req.body

  const config = useRuntimeConfig()
  const apiKeyOpenAI = process.env.OPENAI_API_KEY
  const apiKeyAnthropic = process.env.ANTHROPIC_API_KEY

  try {
    let response;
    if (provider === 'openai') {
      response = await sendToChatGPT(prompt, apiKeyOpenAI);
    } else if (provider === 'anthropic') {
      response = await sendToAnthropic(prompt, apiKeyAnthropic);
    } else {
      throw createError({ statusCode: 400, statusMessage: 'Invalid provider' });
    }
    res.status(200).json(response);
  } catch (error) {
    res.status(error.statusCode || 500).send(error.statusMessage || 'Failed to process prompt');
  }
}

const sendToChatGPT = async (prompt, apiKey) => {
  const apiUrl = 'https://api.openai.com/v1/chat/completions'
  console.log('apiUrl', apiUrl)
  const response = await axios.post(
    apiUrl,
    {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    },
  )

  console.log('response', response)

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

  console.log('response', response)

  return response.content[0].text
}
