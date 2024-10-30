/* Example usage:
const openAIBot = new Bot('openai', process.env.OPENAI_API_KEY!);
const anthropicBot = new Bot('anthropic', process.env.ANTHROPIC_API_KEY!);
*/

import axios from "axios";
import { Anthropic } from "@anthropic-ai/sdk";

type AnthropicRoles = "assistant" | "user";
type OpenAIRoles = "system" | "assistant" | "user";

export interface Message {
  role: AnthropicRoles | OpenAIRoles;
  content: string;
}

class Bot {
  private apiKey: string;
  private provider: "openai" | "anthropic";

  constructor(provider: "openai" | "anthropic", apiKey: string) {
    this.provider = provider;
    this.apiKey = apiKey;
  }

  public async send(messages: Message[]): Promise<string> {
    let summary = "";
    if (messages.length > 1) {
      summary = await this.summarize(messages);
    }

    if (this.provider === "openai") {
      return this.sendToChatGPT(messages, summary);
    } else if (this.provider === "anthropic") {
      return this.sendToAnthropic(messages, summary);
    } else {
      throw new Error("Invalid provider");
    }
  }

  private async summarize(messages: Message[]): Promise<string> {
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
    const conversationSummary = response.data.choices[0].message.content;
    console.log(
      "🚀 ~ Bot ~ summarizeWithChatGPT ~ conversationSummary:",
      conversationSummary
    );
    return conversationSummary;
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

  private async sendToChatGPT(
    messages: Message[],
    summary: string
  ): Promise<string> {
    const apiUrl = "https://api.openai.com/v1/chat/completions";
    const response = await axios.post(
      apiUrl,
      {
        model: "gpt-3.5-turbo",
        messages: summary
          ? [
              {
                role: "system",
                content:
                  "Use the following summary to maintain context: " + summary,
              },
              ...messages,
            ]
          : messages,
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

  private async sendToAnthropic(
    messages: Message[],
    summary?: string
  ): Promise<string> {
    const anthropic = new Anthropic({
      apiKey: this.apiKey,
    });

    console.log("summary", summary);
    const _messages = summary
      ? [
          {
            role: "assistant",
            content:
              "Use the following summary to maintain context: " + summary,
          },
          ...messages.map((msg) => ({ role: "user", content: msg.content })),
        ]
      : messages.map((msg) => ({ role: "user", content: msg.content }));

    console.log("_messages", _messages);

    const response: Anthropic.Messages.Message =
      await anthropic.messages.create({
        model: "claude-3-5-sonnet-20240620",
        max_tokens: 1024,
        messages: _messages,
      });

    console.log("response", response);

    return response.content[0].text;
  }
}

export { Bot };
