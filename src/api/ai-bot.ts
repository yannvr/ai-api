import axios from "axios";
import { Anthropic } from "@anthropic-ai/sdk";
import { saveConversation } from "./conversation";

type AnthropicRoles = "assistant" | "user";
type OpenAIRoles = "system" | "assistant" | "user";

export interface Message {
  role: AnthropicRoles | OpenAIRoles;
  content: string;
}

export interface Conversation {
  id: string | undefined;
  text: string;
  tags: string[];
  messages: Message[];
  summary: string;
}

class Bot {
  apiKey: string;
  private provider: "openai" | "anthropic";

  constructor(provider: "openai" | "anthropic", apiKey: string) {
    this.provider = provider;
    this.apiKey = apiKey;
  }

  public async send(conversation: Conversation): Promise<string> {
    if (conversation.messages.length > 1) {
      conversation.summary = await this.summarize(conversation.messages);
    }

    if (this.provider === "openai") {
      await saveConversation(conversation);
      return this.sendToChatGPT(conversation);
    } else if (this.provider === "anthropic") {
      console.log("CONVERSATION.SUMMARY", conversation.summary);
      await saveConversation(conversation);
      return this.sendToAnthropic(conversation);
    } else {
      throw new Error("Invalid provider");
    }
  }

  public async summarize(messages: Message[]): Promise<string> {
    if (this.provider === "openai") {
      return this.summarizeWithChatGPT(messages);
    } else if (this.provider === "anthropic") {
      return this.summarizeWithAnthropic(messages);
    } else {
      throw new Error("Invalid provider");
    }
  }

  private async summarizeWithChatGPT(messages: Message[]): Promise<string> {
    const apiUrl = "https://api.openai.com/v1/chat/completions";
    const response = await axios.post(
      apiUrl,
      {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "Summarize the following conversation with key points. The summary should be as short as possible and only include the minimum required to maintain context.",
          },
          ...messages,
        ],
        max_tokens: 50,
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data.choices[0].message.content;
  }

  private async summarizeWithAnthropic(messages: Message[]): Promise<string> {
    const anthropic = new Anthropic({
      apiKey: this.apiKey,
    });

    const response: any = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 50,
      messages: [
        {
          role: "assistant",
          content:
            "Summarize the following conversation with key points. The summary should be as short as possible and only include the minimum required to maintain context.",
        },
        ...messages.map((msg) => ({
          role: "user",
          content: msg.content,
        })),
      ],
    });
    const conversationSummary = response.content[0].text;
    console.log(
      "🚀 ~ Bot ~ summarizeWithAnthropic ~ conversationSummary:",
      conversationSummary
    );
    return conversationSummary;
  }

  private async sendToChatGPT(conversation: Conversation): Promise<string> {
    const apiUrl = "https://api.openai.com/v1/chat/completions";
    const requestBody: any = {
      model: "gpt-3.5-turbo",
      messages: conversation.summary
        ? [
            {
              role: "system",
              content:
                "Use the following summary to maintain context: " +
                conversation.summary,
            },
            ...conversation.messages,
          ]
        : conversation.messages,
    };

    const response = await axios.post(apiUrl, requestBody, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
    });
    return response.data.choices[0].message.content;
  }

  private async sendToAnthropic(conversation: Conversation): Promise<string> {
    const anthropic = new Anthropic({
      apiKey: this.apiKey,
    });

    console.log("summary", conversation.summary);
    const _messages = conversation.summary
      ? [
          {
            role: "assistant",
            content:
              "Use the following summary to maintain context: " +
              conversation.summary,
          },
          ...conversation.messages.map((msg) => ({
            role: "user",
            content: msg.content,
          })),
        ]
      : conversation.messages.map((msg) => ({
          role: "user",
          content: msg.content,
        }));


    const response: any = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 1024,
      messages: _messages,
    });

    console.log("response", response);

    return response.content[0].text;
  }
}

// Example usage:
const openAIBot = new Bot("openai", process.env.OPENAI_API_KEY!);
const anthropicBot = new Bot("anthropic", process.env.ANTHROPIC_API_KEY!);

export { Bot, Conversation, Message };
