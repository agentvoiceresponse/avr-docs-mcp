#!/usr/bin/env node

import { config } from 'dotenv';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { WikiService } from "./wikiService.js";

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

// Define your tools
const tools: Tool[] = [
  {
    name: "search_wiki_pages",
    description: "Search Wiki.JS pages for specific topics or keywords",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query to find in Wiki.JS pages",
        },
        page: {
          type: "number",
          description: "Page number for pagination (default: 1)",
          default: 1,
        },
        limit: {
          type: "number",
          description: "Number of results per page (default: 10, max: 50)",
          default: 10,
        },
      },
      required: ["query"],
    },
  },
  {
    name: "list_wiki_pages",
    description: "List all available pages in Wiki.JS",
    inputSchema: {
      type: "object",
      properties: {
        page: {
          type: "number",
          description: "Page number for pagination (default: 1)",
          default: 1,
        },
        limit: {
          type: "number",
          description: "Number of results per page (default: 20, max: 50)",
          default: 20,
        },
      },
    },
  },
  {
    name: "get_wiki_page",
    description: "Get a specific page from Wiki.JS by ID or path",
    inputSchema: {
      type: "object",
      properties: {
        pageId: {
          type: "string",
          description: "The ID (numeric) or path (string) of the page to retrieve. Examples: '3' for ID, 'deepgram' for path",
        },
      },
      required: ["pageId"],
    },
  },
  {
    name: "test_wiki_connection",
    description: "Test the connection to Wiki.JS",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// Create the server
const server = new Server(
  {
    name: "avr-docs-mcp",
    version: "1.0.0",
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools,
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!args) {
    throw new Error("Arguments are required");
  }

  try {
    switch (name) {
      case "search_wiki_pages":
        const searchQuery = args.query as string;
        const searchPage = (args.page as number) || 1;
        const searchLimit = Math.min((args.limit as number) || 10, 50);

        const searchResult = await wikiService.searchPages(searchQuery, searchPage, searchLimit);
        
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
              text: `**Search Results for: "${searchQuery}"**\n\n` +
                    `Found ${searchResult.total} pages (showing ${searchResult.pages.length} on page ${searchResult.page})\n\n` +
                    searchContent,
            },
          ],
        };

      case "list_wiki_pages":
        const listPage = (args.page as number) || 1;
        const listLimit = Math.min((args.limit as number) || 20, 50);

        const listResult = await wikiService.listPages(listPage, listLimit);
        
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

      case "get_wiki_page":
        const pageId = args.pageId as string;
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

      case "test_wiki_connection":
        const isConnected = await wikiService.testConnection();
        
        return {
          content: [
            {
              type: "text",
              text: isConnected 
                ? "✅ Successfully connected to Wiki.JS"
                : "❌ Failed to connect to Wiki.JS. Please check your configuration.",
            },
          ],
        };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    throw new Error(`Tool execution failed: ${error instanceof Error ? error.message : String(error)}`);
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("AVR Docs MCP server started with Wiki.JS integration");
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
