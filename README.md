# AVR Docs MCP Server with Wiki.JS Integration

This MCP (Model Context Protocol) server provides integration with Wiki.JS for searching and listing pages from your Wiki.JS instance.

## Features

- **Search Wiki.JS Pages**: Search for pages using keywords or topics
- **List Wiki.JS Pages**: Get a paginated list of all available pages
- **Get Specific Page**: Retrieve a specific page by its ID
- **Connection Testing**: Test the connection to your Wiki.JS instance
- **Multiple Transport Modes**: Support for both stdio and HTTP stream modes
- **Docker Support**: Ready-to-use Docker image with health checks

## Setup

### Prerequisites

1. A running Wiki.JS instance
2. An API key with appropriate permissions for reading pages

### Environment Variables

You can set environment variables in two ways:

#### Option 1: Using a .env file (Recommended)

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit the `.env` file with your actual values:
```bash
# Wiki.JS Configuration
WIKI_JS_BASE_URL=https://your-wiki-instance.com
WIKI_JS_API_KEY=your-api-key-here
LOG_LEVEL=info

# MCP Server Configuration
MCP_MODE=stdio
PORT=3000
```

#### Option 2: Using system environment variables

```bash
export WIKI_JS_BASE_URL="https://your-wiki-instance.com"
export WIKI_JS_API_KEY="your-api-key-here"
export LOG_LEVEL="info"
export MCP_MODE="stdio"
export PORT="3000"
```

### Installation

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

3. Test the connection (optional):
```bash
npm test
```

4. Run the server:
```bash
npm start
```

For development:
```bash
npm run dev
```

## Running Modes

The server supports two modes of operation:

### Stdio Mode (Default)
The server runs in stdio mode by default, communicating through standard input/output. This is the traditional MCP mode.

```bash
npm start
# or
npm run start:http  # for HTTP mode
# or
MCP_MODE=stdio npm start
```

### HTTP Stream Mode
The server can also run in HTTP mode, providing a REST API with Server-Sent Events (SSE) for MCP communication.

```bash
npm run start:http
# or
MCP_MODE=http npm start
```

When running in HTTP mode, the server provides:
- **Health Check**: `GET /health` - Returns server status
- **MCP Endpoint**: `POST /mcp` - MCP communication endpoint

## Docker Usage

### Using the Docker Image

```bash
# Run in stdio mode (default)
docker run -d \
  --name avr-docs-mcp \
  -e WIKI_JS_BASE_URL="https://your-wiki-instance.com" \
  -e WIKI_JS_API_KEY="your-api-key-here" \
  agentvoiceresponse/avr-docs-mcp:latest

# Run in HTTP mode
docker run -d \
  --name avr-docs-mcp \
  -p 3000:3000 \
  -e WIKI_JS_BASE_URL="https://your-wiki-instance.com" \
  -e WIKI_JS_API_KEY="your-api-key-here" \
  -e MCP_MODE="http" \
  -e PORT="3000" \
  agentvoiceresponse/avr-docs-mcp:latest
```

### Docker Compose

```yaml
version: '3.8'

services:
  avr-docs-mcp:
    image: agentvoiceresponse/avr-docs-mcp:latest
    container_name: avr-docs-mcp
    ports:
      - "3000:3000"  # Only needed for HTTP mode
    environment:
      - WIKI_JS_BASE_URL=https://your-wiki-instance.com
      - WIKI_JS_API_KEY=your-api-key-here
      - MCP_MODE=http
      - PORT=3000
      - LOG_LEVEL=info
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## Available Tools

### 1. search_wiki_pages
Search for pages in Wiki.JS using keywords.

**Parameters:**
- `query` (required): The search query
- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Number of results per page (default: 10, max: 50)

### 2. list_wiki_pages
List all available pages in Wiki.JS.

**Parameters:**
- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Number of results per page (default: 20, max: 50)

### 3. get_wiki_page
Get a specific page by its ID or path.

**Parameters:**
- `pageId` (required): The ID (numeric) or path (string) of the page to retrieve. Examples: '3' for ID, 'deepgram' for path



## Wiki.JS API Configuration

This MCP server uses Wiki.JS GraphQL API (`/graphql` endpoint). Make sure your Wiki.JS instance has API access enabled and that your API key has the following permissions:

- `page:read` - To read page content
- `page:list` - To list pages
- `search:read` - To search pages

The server automatically handles GraphQL queries and responses for all operations. Note that Wiki.JS GraphQL API has some limitations:
- Search and list operations don't support native pagination, so pagination is simulated client-side
- Search results don't include full page content
- List results don't include full page content (use `get_wiki_page` for full content)
- Tags are returned as arrays of strings, not comma-separated strings

## Logging

The server includes comprehensive logging with configurable log levels:

- `debug` - Detailed debug information
- `info` - General information (default)
- `warn` - Warning messages only
- `error` - Error messages only

Set the `LOG_LEVEL` environment variable to control logging verbosity.

## Error Handling

The server includes comprehensive error handling for:

- Missing environment variables
- Network connectivity issues
- API authentication failures
- Invalid page IDs
- Rate limiting

## Development

To run in development mode with hot reloading:

```bash
npm run watch
```

## Building

To build for production:

```bash
npm run build
```

The compiled JavaScript will be in the `dist/` directory.

## Support & Community

*   **GitHub:** [https://github.com/agentvoiceresponse](https://github.com/agentvoiceresponse) - Report issues, contribute code.
*   **Discord:** [https://discord.gg/DFTU69Hg74](https://discord.gg/DFTU69Hg74) - Join the community discussion.
*   **Docker Hub:** [https://hub.docker.com/u/agentvoiceresponse](https://hub.docker.com/u/agentvoiceresponse) - Find Docker images.
*   **Wiki:** [https://wiki.agentvoiceresponse.com/en/home](https://wiki.agentvoiceresponse.com/en/home) - Project documentation and guides.

## Support AVR

AVR is free and open-source. If you find it valuable, consider supporting its development:

<a href="https://ko-fi.com/agentvoiceresponse" target="_blank"><img src="https://ko-fi.com/img/githubbutton_sm.svg" alt="Support us on Ko-fi"></a>

## License

MIT License - see the [LICENSE](LICENSE.md) file for details.
