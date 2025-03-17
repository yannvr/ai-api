# ai-api

## Overview

This project is an AI-powered API that interacts with OpenAI and Anthropic AI models to provide conversational capabilities. It also integrates with AWS DynamoDB for storing conversations and user settings.

## Features

- **Conversation Management**: Create, retrieve, update, and delete conversations.
- **Tag Management**: Add, edit, and delete tags for conversations.
- **Message Handling**: Append messages to conversations and fetch quotes.
- **User Settings**: Update user-specific settings.
- **CORS Middleware**: Handle Cross-Origin Resource Sharing (CORS) for specific origins.

## Installation

To install dependencies:

```bash
bun install
```

## Environment Setup

1. Copy the example environment file to create your own:

```bash
cp .env.example .env
```

2. Edit the `.env` file with your actual API keys and credentials:
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `ANTHROPIC_API_KEY`: Your Anthropic (Claude) API key
   - `CONF_AWS_ACCESS_KEY_ID`, `CONF_AWS_SECRET_ACCESS_KEY`, `CONF_AWS_REGION`: Your AWS credentials for DynamoDB access

## Running the Server

To run the server:

```bash
bun run server.ts
```

## API Endpoints

### Conversations

- `GET /conversations`: Retrieve a list of conversations.
- `GET /conversation`: Retrieve a conversation by ID.
- `POST /conversation`: Create a new conversation.
- `DELETE /conversation`: Delete a conversation by ID.
- `PUT /conversation/name`: Update the name of a conversation.
- `POST /conversation/tag`: Add a tag to a conversation.
- `PUT /conversation/tag`: Edit a tag in a conversation.
- `DELETE /conversation/tag`: Delete a tag from a conversation.

### Messages

- `POST /sendPrompt`: Send a prompt to the AI model and get a response.
- `GET /fetchQuote`: Fetch a random quote.

### User Settings

- `POST /settings`: Update user-specific settings.

## TODO

- Detect metadata to update summary

This project was created using `bun init` in bun v1.1.21. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
