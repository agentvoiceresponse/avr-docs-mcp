#!/usr/bin/env node

import { config } from 'dotenv';
import axios from 'axios';

// Load environment variables
config();

async function testConnection() {
  try {
    const baseUrl = process.env.WIKI_JS_BASE_URL;
    const apiKey = process.env.WIKI_JS_API_KEY;

    if (!baseUrl || !apiKey) {
      console.error('❌ Missing environment variables');
      console.log('Please set WIKI_JS_BASE_URL and WIKI_JS_API_KEY in your .env file');
      process.exit(1);
    }

    console.log('🔧 Testing Wiki.JS GraphQL connection...');
    console.log(`📍 Base URL: ${baseUrl}`);
    console.log(`🔑 API Key: ${apiKey.substring(0, 8)}...`);

    // Test basic GraphQL endpoint
    const graphqlUrl = `${baseUrl.replace(/\/$/, '')}/graphql`;
    console.log(`🔗 GraphQL URL: ${graphqlUrl}`);

    // Simple introspection query to test the endpoint
    const introspectionQuery = {
      query: `
        query {
          __schema {
            queryType {
              name
            }
          }
        }
      `
    };

    console.log('🔍 Testing GraphQL endpoint with introspection query...');
    
    const response = await axios.post(graphqlUrl, introspectionQuery, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    console.log('✅ GraphQL endpoint is accessible!');
    console.log('📊 Response status:', response.status);
    
    if (response.data.errors) {
      console.log('⚠️  GraphQL errors:', JSON.stringify(response.data.errors, null, 2));
    } else {
      console.log('✅ No GraphQL errors');
    }

    // Test a simple system query
    console.log('🔍 Testing system info query...');
    const systemQuery = {
      query: `
        query {
          system {
            info {
              dbVersion
              platform
              nodeVersion
            }
          }
        }
      `
    };

    const systemResponse = await axios.post(graphqlUrl, systemQuery, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    if (systemResponse.data.errors) {
      console.log('⚠️  System query errors:', JSON.stringify(systemResponse.data.errors, null, 2));
    } else {
      console.log('✅ System query successful');
      console.log('📋 Wiki.JS Info:', systemResponse.data.data.system.info);
    }

    // Test pages query
    console.log('🔍 Testing pages query...');
    const pagesQuery = {
      query: `
        query {
          pages {
            list {
              id
              title
              description
              path
            }
          }
        }
      `
    };

    const pagesResponse = await axios.post(graphqlUrl, pagesQuery, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    if (pagesResponse.data.errors) {
      console.log('⚠️  Pages query errors:', JSON.stringify(pagesResponse.data.errors, null, 2));
    } else {
      console.log('✅ Pages query successful');
      const pagesData = pagesResponse.data.data.pages.list;
      console.log(`📄 Total pages: ${pagesData.length}`);
      if (pagesData.length > 0) {
        console.log('📖 Sample page:', pagesData[0].title);
      }
    }

  } catch (error) {
    console.error('❌ Error during testing:', error.message);
    
    if (error.response) {
      console.error('📊 Response status:', error.response.status);
      console.error('📄 Response data:', JSON.stringify(error.response.data, null, 2));
    }
    
    console.log('\n🔧 Troubleshooting tips:');
    console.log('1. Verify WIKI_JS_BASE_URL is correct (should not end with /)');
    console.log('2. Verify WIKI_JS_API_KEY is valid and has proper permissions');
    console.log('3. Check if Wiki.JS instance is running and accessible');
    console.log('4. Ensure GraphQL API is enabled in Wiki.JS');
    
    process.exit(1);
  }
}

testConnection();
