#!/usr/bin/env node

import { config } from 'dotenv';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { InitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { WikiService } from "./wikiService.js";
import express, { Request, Response } from 'express';
import cors from 'cors';
import { randomUUID } from "node:crypto";
import { z } from "zod";

// Load environment variables from .env file
config();

// Initialize Wiki.JS service
let wikiService: WikiService;

try {
  wikiService = new WikiService();
} catch (error) {
  console.error("Failed to initialize Wiki.JS service:", error);
  process.exit(1);
}

// Create the MCP server
const server = new McpServer({
  name: "avr-docs-mcp",
  version: "1.1.1",
});

// Register Wiki.JS tools
server.registerTool(
  "search_wiki_pages",
  {
    title: "Search Wiki.JS Pages",
    description: "Search Wiki.JS pages for specific topics or keywords",
    inputSchema: {
      query: z.string().describe("The search query to find in Wiki.JS pages"),
      page: z.number().optional().default(1).describe("Page number for pagination"),
      limit: z.number().optional().default(10).describe("Number of results per page (max: 50)")
    }
  },
  async ({ query, page = 1, limit = 10 }: { query: string; page?: number; limit?: number }) => {
    const searchLimit = Math.min(limit, 50);
    const searchResult = await wikiService.searchPages(query, page, searchLimit);
    
    const searchContent = searchResult.pages.length > 0 
      ? searchResult.pages.map(page => 
          `**${page.title}**\n` +
          `Path: ${page.path}\n` +
          `Updated: ${new Date(page.updatedAt).toLocaleDateString()}\n` +
          `Author: ${page.author.name}\n` +
          `Description: ${page.description || 'No description'}\n` +
          `Tags: ${page.tags.join(', ') || 'No tags'}\n`
        ).join('\n---\n\n')
      : 'No pages found matching your search query.';

    return {
      content: [
        {
          type: "text",
          text: `**Search Results for: "${query}"**\n\n` +
                `Found ${searchResult.total} pages (showing ${searchResult.pages.length} on page ${searchResult.page})\n\n` +
                searchContent,
        },
      ],
    };
  }
);

server.registerTool(
  "list_wiki_pages",
  {
    title: "List Wiki.JS Pages",
    description: "List all available pages in Wiki.JS",
    inputSchema: {
      page: z.number().optional().default(1).describe("Page number for pagination"),
      limit: z.number().optional().default(20).describe("Number of results per page (max: 50)")
    }
  },
  async ({ page = 1, limit = 20 }) => {
    const listLimit = Math.min(limit, 50);
    const listResult = await wikiService.listPages(page, listLimit);
    
    const listContent = listResult.pages.length > 0 
      ? listResult.pages.map(page => 
          `**${page.title}**\n` +
          `Path: ${page.path}\n` +
          `Updated: ${new Date(page.updatedAt).toLocaleDateString()}\n` +
          `Author: ${page.author.name}\n` +
          `Description: ${page.description || 'No description'}\n` +
          `Tags: ${page.tags.join(', ') || 'No tags'}\n`
        ).join('\n---\n\n')
      : 'No pages found.';

    return {
      content: [
        {
          type: "text",
          text: `**Wiki.JS Pages**\n\n` +
                `Total pages: ${listResult.total} (showing ${listResult.pages.length} on page ${listResult.page})\n\n` +
                listContent,
        },
      ],
    };
  }
);

server.registerTool(
  "get_wiki_page",
  {
    title: "Get Wiki.JS Page",
    description: "Get a specific page from Wiki.JS by ID or path",
    inputSchema: {
      pageId: z.string().describe("The ID (numeric) or path (string) of the page to retrieve. Examples: '3' for ID, 'deepgram' for path")
    }
  },
  async ({ pageId }: { pageId: string }) => {
    const page = await wikiService.getPage(pageId);
    
    return {
      content: [
        {
          type: "text",
          text: `**${page.title}**\n\n` +
                `Path: ${page.path}\n` +
                `Created: ${new Date(page.createdAt).toLocaleDateString()}\n` +
                `Updated: ${new Date(page.updatedAt).toLocaleDateString()}\n` +
                `Author: ${page.author.name} (${page.author.email})\n` +
                `Tags: ${page.tags.join(', ') || 'No tags'}\n\n` +
                `**Content:**\n\n${page.content}`,
        },
      ],
    };
  }
);

// Start the server
async function main() {
  const mode = process.env.MCP_MODE || 'stdio';
  const port = parseInt(process.env.PORT || '3000');

  if (mode === 'http') {
    // HTTP mode with StreamableHTTPServerTransport
    const app = express();
    app.use(express.json());

    // Map to store transports by session ID
    const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

    // Health check endpoint
    app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', service: 'avr-docs-mcp', mode: 'http' });
    });

    // Handle POST requests for client-to-server communication
    app.post('/mcp', async (req: Request, res: Response) => {
      // Check for existing session ID
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports[sessionId]) {
        // Reuse existing transport
        transport = transports[sessionId];
      } else if (!sessionId && req.body.method === 'initialize') {
        // New initialization request
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sessionId: string) => {
            // Store the transport by session ID
            transports[sessionId] = transport;
          },
          // DNS rebinding protection is disabled by default for backwards compatibility
          // enableDnsRebindingProtection: true,
          // allowedHosts: ['127.0.0.1'],
        });

        // Clean up transport when closed
        transport.onclose = () => {
          if (transport.sessionId) {
            delete transports[transport.sessionId];
          }
        };

        // Connect to the MCP server
        await server.connect(transport);
      } else {
        // Invalid request
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: No valid session ID provided',
          },
          id: null,
        });
        return;
      }

      // Handle the request
      await transport.handleRequest(req, res, req.body);
    });

    // Reusable handler for GET and DELETE requests
    const handleSessionRequest = async (req: Request, res: Response) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      if (!sessionId || !transports[sessionId]) {
        res.status(400).send('Invalid or missing session ID');
        return;
      }
      
      const transport = transports[sessionId];
      await transport.handleRequest(req, res);
    };

    // Handle GET requests for server-to-client notifications via SSE
    app.get('/mcp', handleSessionRequest);

    // Handle DELETE requests for session termination
    app.delete('/mcp', handleSessionRequest);

    app.listen(port, () => {
      console.log(`AVR Docs MCP server started in HTTP mode on port ${port}`);
      console.log(`Health check: http://localhost:${port}/health`);
      console.log(`MCP endpoint: http://localhost:${port}/mcp`);
      console.log(`\nExample usage:`);
      console.log(`# Initialize session:`);
      console.log(`curl -X POST http://localhost:${port}/mcp \\`);
      console.log(`  -H "Content-Type: application/json" \\`);
      console.log(`  -d '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "test-client", "version": "1.0.0"}}}'`);
      console.log(`# Then use the session ID from response headers for subsequent requests`);
    });
  } else {
    // Stdio mode (default)
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("AVR Docs MCP server started with Wiki.JS integration in stdio mode");
  }
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
