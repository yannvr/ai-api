import axios from "axios";
import { Anthropic } from "@anthropic-ai/sdk";

type AnthropicRoles = "assistant" | "user";
type OpenAIRoles = "system" | "assistant" | "user";

export interface Message {
  role: AnthropicRoles | OpenAIRoles;
  content: string;
}

export interface Conversation {
  id: string | undefined;
  name: string;
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

  public async send(conversation: Conversation): Promise<Message> {

    if (this.provider === "openai") {
      if (conversation.messages.length > 0) {
        conversation.summary = await this.summarize(conversation);
      }
      return this.sendToChatGPT(conversation);
    } else if (this.provider === "anthropic") {
      if (conversation.messages.length > 0) {
        conversation.summary = await this.summarize(conversation);
      }
      return this.sendToAnthropic(conversation);
    } else {
      throw new Error("Invalid provider");
    }
  }

  public async summarize(conversation: Conversation): Promise<string> {
    if (this.provider === "openai") {
      return this.summarizeWithChatGPT(conversation);
    } else if (this.provider === "anthropic") {
      return this.summarizeWithAnthropic(conversation);
    } else {
      throw new Error("Invalid provider");
    }
  }

  private async summarizeWithChatGPT(conversation: Conversation): Promise<string> {
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

  private async summarizeWithAnthropic(conversation: Conversation): Promise<string> {
    const anthropic = new Anthropic({
      apiKey: this.apiKey,
    });
    let summaryPrompt;
    console.log("🚀 ~ Bot ~ summarizeWithAnthropic ~ conversation:", conversation)

    if (!conversation.summary) {
      summaryPrompt = `Summarize the following conversation with key points.
      The summary should be as short as possible and only include the minimum required to maintain context: "${conversation.messages[0].content}"`;
    } else {
      summaryPrompt = `
      - if the latest message provides information about the user then update summary "${conversation.summary}" combined with the latest message "${conversation.messages[0].content}"
      - Otherwise, reply with "${conversation.summary}".`
    }
    console.log("🚀 ~ Bot ~ summarizeWithAnthropic ~ summaryPrompt:", summaryPrompt)


    const response: any = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 50,
      messages: [
        {
          role: "user" as AnthropicRoles,
          content: summaryPrompt,
          }
      ],
    });
    console.log("🚀 ~ Bot ~ summarizeWithAnthropic ~ response:", response);
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

  private async sendToAnthropic(conversation: Conversation): Promise<Message> {
    const anthropic = new Anthropic({
      apiKey: this.apiKey,
    });

    console.log("sendToAnthropic ~ conversation", conversation);

    let prompt = conversation.messages[0].content;

    if (conversation.summary) {
      prompt = `Use the following summary to maintain context: ${conversation.summary} and reply to the latest message: ${conversation.messages[0].content}`;
    }

    console.log("sendToAnthropic ~ conversation", prompt);
    const response: any = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: prompt,
        }
      ]
    });
    console.log("🚀 ~ Bot ~ sendToAnthropic ~ response:", response)


    return {
      role: "assistant",
      content: response.content[0].text
    }
  }
}

// Example usage:
// const openAIBot = new Bot("openai", process.env.OPENAI_API_KEY!);
// const anthropicBot = new Bot("anthropic", process.env.ANTHROPIC_API_KEY!);

export { Bot };
