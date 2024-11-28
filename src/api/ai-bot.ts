// src/api/ai-bot.ts

import axios from 'axios';
import { Anthropic } from '@anthropic-ai/sdk';
import { MessageParam, Message as AnthropicMessage, ContentBlock } from '@anthropic-ai/sdk/resources';

export type Role = 'user' | 'assistant';

export interface Message {
  role: Role;
  content: ContentBlock[];
}

export interface Conversation {
  name: string;
  tags: string[];
  messages: Message[];
  id?: string; // it doesn't exist for new conversations
  summary?: string; // it doesn't exist for new conversations
}

export class Bot {
  private provider: 'openai' | 'anthropic';
  private apiKey: string;

  constructor(provider: 'openai' | 'anthropic', apiKey: string) {
    this.provider = provider;
    this.apiKey = apiKey;
  }

  public async send(conversation: Conversation): Promise<Message> {
    // Generate the bot's response
    return this.provider === 'openai'
      ? await this.sendToOpenAI(conversation.messages)
      : await this.sendToAnthropic(conversation.messages);
  }

  private async sendToAnthropic(messages: Message[]): Promise<Message> {
    const anthropic = new Anthropic({ apiKey: this.apiKey });
    // const prompt = this.constructAnthropicPrompt(messages);

    const response: AnthropicMessage = await anthropic.messages.create({
      // https://docs.anthropic.com/en/docs/about-claude/models
      // model: 'claude-3-5-opus-latest',
      // model: 'claude-3-5-sonnet-latest',
      // model: 'claude-3-5-haiku-latest',
      // Test legacy models
      model: 'claude-2.0', // cheapest model
      messages,
      max_tokens: 1024,
    });

    console.log('response', response);

    return {
      role: 'assistant',
      content: response.content,
    };
  }

  private async sendToOpenAI(messages: Message[]): Promise<Message> {
    const openAIMessages = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4', // Use 'gpt-4' or 'gpt-3.5-turbo-16k' for larger context window
        messages: openAIMessages,
        max_tokens: 1024,
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
