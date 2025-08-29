import axios, { AxiosInstance } from 'axios';

export interface WikiPage {
  id: string;
  title: string;
  description?: string;
  path: string;
  locale: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  author: {
    id: string;
    name: string;
    email: string;
  };
  tags: string[];
}

export interface WikiSearchResult {
  pages: WikiPage[];
  total: number;
  page: number;
  limit: number;
}

export interface WikiPageListResult {
  pages: WikiPage[];
  total: number;
  page: number;
  limit: number;
}

export class WikiService {
  private client: AxiosInstance;
  private baseUrl: string;
  private apiKey: string;
  private logLevel: string;

  constructor() {
    const baseUrl = process.env.WIKI_JS_BASE_URL;
    const apiKey = process.env.WIKI_JS_API_KEY;
    this.logLevel = process.env.LOG_LEVEL || 'info';

    if (!baseUrl) {
      throw new Error('WIKI_JS_BASE_URL environment variable is required');
    }

    if (!apiKey) {
      throw new Error('WIKI_JS_API_KEY environment variable is required');
    }

    this.baseUrl = baseUrl;
    this.apiKey = apiKey;

    // Remove trailing slash from base URL
    this.baseUrl = this.baseUrl.replace(/\/$/, '');

    this.client = axios.create({
      baseURL: `${this.baseUrl}/graphql`,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    this.log('info', `WikiService initialized with base URL: ${this.baseUrl}`);
  }

  private log(level: string, message: string): void {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const currentLevel = levels[this.logLevel as keyof typeof levels] || 1;
    const messageLevel = levels[level as keyof typeof levels] || 1;

    if (messageLevel >= currentLevel) {
      const timestamp = new Date().toISOString();
      console.error(`[${timestamp}] [${level.toUpperCase()}] WikiService: ${message}`);
    }
  }

  /**
   * Execute GraphQL query
   */
  private async executeQuery(query: string, variables: any = {}): Promise<any> {
    try {
      this.log('debug', `Executing GraphQL query: ${query.substring(0, 100)}...`);
      this.log('debug', `Variables: ${JSON.stringify(variables)}`);
      
      const response = await this.client.post('', {
        query,
        variables,
      });

      if (response.data.errors) {
        this.log('error', `GraphQL errors: ${JSON.stringify(response.data.errors)}`);
        throw new Error(`GraphQL errors: ${JSON.stringify(response.data.errors)}`);
      }

      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.log('error', `GraphQL request failed: ${error.response?.data?.message || error.message}`);
        if (error.response?.data) {
          this.log('error', `Response data: ${JSON.stringify(error.response.data)}`);
        }
        throw new Error(`GraphQL request failed: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Search for pages in Wiki.JS
   */
  async searchPages(query: string, page: number = 1, limit: number = 10): Promise<WikiSearchResult> {
    try {
      this.log('debug', `Searching pages with query: "${query}", page: ${page}, limit: ${limit}`);
      
      const graphqlQuery = `
        query SearchPages($query: String!) {
          pages {
            search(query: $query) {
              results {
                id
                title
                description
                path
                locale
              }
              totalHits
            }
          }
        }
      `;

      const result = await this.executeQuery(graphqlQuery, {
        query,
      });

      const searchData = result.pages.search;
      
      this.log('info', `Search completed. Found ${searchData.totalHits} pages`);
      
      // Simulate pagination since Wiki.JS search doesn't support it natively
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedResults = searchData.results.slice(startIndex, endIndex);
      
      return {
        pages: paginatedResults.map((page: any) => ({
          id: page.id,
          title: page.title,
          description: page.description || '',
          path: page.path,
          locale: page.locale,
          content: '', // Search results don't include content
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          publishedAt: new Date().toISOString(),
          author: {
            id: '0',
            name: 'Unknown',
            email: ''
          },
          tags: []
        })),
        total: searchData.totalHits,
        page,
        limit,
      };
    } catch (error) {
      this.log('error', `Search failed: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Wiki.JS search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * List all pages in Wiki.JS
   */
  async listPages(page: number = 1, limit: number = 20): Promise<WikiPageListResult> {
    try {
      this.log('debug', `Listing pages, page: ${page}, limit: ${limit}`);
      
      const graphqlQuery = `
        query ListPages {
          pages {
            list {
              id
              title
              description
              path
              locale
              contentType
              isPublished
              isPrivate
              createdAt
              updatedAt
              tags
            }
          }
        }
      `;

      const result = await this.executeQuery(graphqlQuery);

      const allPages = result.pages.list;
      
      // Simulate pagination since Wiki.JS list doesn't support it natively
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedPages = allPages.slice(startIndex, endIndex);
      
      this.log('info', `Page listing completed. Found ${allPages.length} pages`);
      
      return {
        pages: paginatedPages.map((page: any) => ({
          id: page.id.toString(),
          title: page.title,
          description: page.description || '',
          path: page.path,
          locale: page.locale,
          content: '', // List doesn't include content
          createdAt: page.createdAt,
          updatedAt: page.updatedAt,
          publishedAt: page.isPublished ? page.updatedAt : undefined,
          author: {
            id: '0',
            name: 'Unknown',
            email: ''
          },
          tags: Array.isArray(page.tags) ? page.tags.map((tag: any) => tag.title) : []
        })),
        total: allPages.length,
        page,
        limit,
      };
    } catch (error) {
      this.log('error', `Page listing failed: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Wiki.JS page listing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get a specific page by ID or path
   */
  async getPage(pageId: string): Promise<WikiPage> {
    try {
      this.log('debug', `Getting page with ID/path: ${pageId}`);
      
      // Check if pageId is numeric (ID) or string (path)
      const isNumeric = /^\d+$/.test(pageId);
      
      let graphqlQuery: string;
      let variables: any;
      
      if (isNumeric) {
        // Get by ID
        graphqlQuery = `
          query GetPageById($id: Int!) {
            pages {
              single(id: $id) {
                id
                title
                description
                path
                locale
                content
                contentType
                isPublished
                isPrivate
                createdAt
                updatedAt
                tags {
                  id
                  title
                }
                authorId
                authorName
                authorEmail
              }
            }
          }
        `;
        variables = { id: parseInt(pageId) };
      } else {
        // Get by path
        graphqlQuery = `
          query GetPageByPath($path: String!, $locale: String!) {
            pages {
              singleByPath(path: $path, locale: $locale) {
                id
                title
                description
                path
                locale
                content
                contentType
                isPublished
                isPrivate
                createdAt
                updatedAt
                tags {
                  id
                  title
                }
                authorId
                authorName
                authorEmail
              }
            }
          }
        `;
        variables = { path: pageId, locale: 'en' };
      }

      const result = await this.executeQuery(graphqlQuery, variables);

      const page = isNumeric ? result.pages.single : result.pages.singleByPath;
      
      if (!page) {
        throw new Error(`Page not found: ${pageId}`);
      }
      
      this.log('info', `Page retrieved successfully: ${page.title}`);
      return {
        id: page.id.toString(),
        title: page.title,
        description: page.description || '',
        path: page.path,
        locale: page.locale,
        content: page.content,
        createdAt: page.createdAt,
        updatedAt: page.updatedAt,
        publishedAt: page.isPublished ? page.updatedAt : undefined,
        author: {
          id: page.authorId.toString(),
          name: page.authorName || 'Unknown',
          email: page.authorEmail || ''
        },
        tags: Array.isArray(page.tags) ? page.tags.map((tag: any) => tag.title) : []
      };
    } catch (error) {
      this.log('error', `Page retrieval failed: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Wiki.JS page retrieval failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get a specific page by path
   */
  async getPageByPath(path: string): Promise<WikiPage> {
    return this.getPage(path);
  }

  /**
   * Test the connection to Wiki.JS
   */
  async testConnection(): Promise<boolean> {
    try {
      this.log('debug', 'Testing connection to Wiki.JS');
      
      const graphqlQuery = `
        query TestConnection {
          system {
            info {
              dbVersion
              platform
              nodeVersion
            }
          }
        }
      `;

      await this.executeQuery(graphqlQuery);
      
      this.log('info', 'Connection test successful');
      return true;
    } catch (error) {
      this.log('error', `Connection test failed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
}
