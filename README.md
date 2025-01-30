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
