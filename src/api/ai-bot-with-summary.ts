// src/api/ai-bot.ts

import axios from 'axios';
import { Anthropic } from '@anthropic-ai/sdk';
import { MessageParam } from '@anthropic-ai/sdk/resources';

export type Role = 'user' | 'assistant';

export interface Message {
  role: Role;
  content: string;
}

export interface Conversation {
  id: string;
  name: string;
  tags: string[];
  messages: Message[];
}

function isMeaningfulMessage(message: string): boolean {
  const trimmedMessage = message.trim().toLowerCase();
  const lowValueResponses = new Set([
    'yes', 'no', 'maybe', 'ok', 'okay', "i don't know", 'idk', 'sure', 'thanks', 'thank you',
  ]);

  return trimmedMessage.length >= 5 && !lowValueResponses.has(trimmedMessage);
}

export class Bot {
  private provider: 'openai' | 'anthropic';
  private apiKey: string;
  private windowSize: number;

  constructor(provider: 'openai' | 'anthropic', apiKey: string, windowSize = 5) {
    this.provider = provider;
    this.apiKey = apiKey;
    this.windowSize = windowSize;
  }

  public async send(conversation: Conversation): Promise<Message> {
    // Filter and keep only the last N meaningful messages
    const meaningfulMessages = conversation.messages.filter((msg) => isMeaningfulMessage(msg.content));
    const recentMessages = meaningfulMessages.slice(-this.windowSize);

    // Generate the bot's response
    return this.provider === 'openai'
      ? await this.sendToOpenAI(recentMessages)
      : await this.sendToAnthropic(recentMessages);
  }

  private async sendToAnthropic(messages: Message[]): Promise<Message> {
    const anthropic = new Anthropic({ apiKey: this.apiKey });
    const message = this.constructAnthropicPrompt(messages);

    const response = await anthropic.messages.create({
      model: 'claude-2',
      messages: [message],
      max_tokens: 1024,
      stop_sequences: ['\n\nHuman:'],
    });

    return {
      role: 'assistant',
      content: response.data.choices[0].message.content.trim(),
    };
  }

  private constructAnthropicPrompt(messages: Message[]): MessageParam {
    let prompt = '';
    messages.forEach((msg) => {
      const role = msg.role === 'user' ? 'Human' : 'Assistant';
      prompt += `\n\n${role}: ${msg.content}`;
    });
    prompt += '\n\nAssistant:';
    return prompt.trim();
  }

  private async sendToOpenAI(messages: Message[]): Promise<Message> {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages,
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      role: 'assistant',
      content: response.data.choices[0].message.content.trim(),
    };
  }
}

