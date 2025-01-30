import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { Anthropic } from '@anthropic-ai/sdk';

export const sendPrompt = async (req: Request, res: Response, next: NextFunction) => {
  const { prompt, provider } = req.body;
  const apiKeyOpenAI = process.env.OPENAI_API_KEY;
  const apiKeyAnthropic = process.env.ANTHROPIC_API_KEY;

  try {
    let response;
    if (provider === 'openai') {
      if (!apiKeyOpenAI) {
        return next({ statusCode: 500, statusMessage: 'OpenAI API key is missing' });
      }
      response = await sendToChatGPT(prompt, apiKeyOpenAI);
    } else if (provider === 'anthropic') {
      if (!apiKeyAnthropic) {
        return next({ statusCode: 500, statusMessage: 'Anthropic API key is missing' });
      }
      response = await sendToAnthropic(prompt, apiKeyAnthropic);
    } else {
      return next({ statusCode: 400, statusMessage: 'Invalid provider' });
    }
    res.status(200).json(response);
  } catch (error) {
    res.status(500).send(error);
  }
}

const sendToChatGPT = async (prompt: string, apiKey: string) => {
  const apiUrl = 'https://api.openai.com/v1/chat/completions';
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
  );

  console.log('response', response);

  return response.data.choices[0].message.content;
}

const sendToAnthropic = async (prompt: string, apiKey: string) => {
  const anthropic = new Anthropic({
    apiKey: apiKey,
  });

  const response: any = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20240620',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.content[0].text;
}
