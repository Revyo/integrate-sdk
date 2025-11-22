/**
 * Node.js OAuth Route Adapter
 * Provides OAuth route handlers for Node.js HTTP servers
 */

import { OAuthHandler, type OAuthHandlerConfig } from './base-handler.js';
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'http';

/**
 * Convert Node.js IncomingHttpHeaders to Web Headers
 * 
 * @param nodeHeaders - Node.js request headers
 * @returns Web API Headers object
 */
export function fromNodeHeaders(nodeHeaders: IncomingHttpHeaders): Headers {
  const webHeaders = new Headers();
  for (const [key, value] of Object.entries(nodeHeaders)) {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        value.forEach((v) => webHeaders.append(key, v));
      } else {
        webHeaders.set(key, value);
      }
    }
  }
  return webHeaders;
}

/**
 * Convert Node.js IncomingMessage to Web Request
 * 
 * @param req - Node.js request object
 * @returns Web API Request object
 */
async function toWebRequest(req: IncomingMessage): Promise<Request> {
  const protocol = (req.socket as any).encrypted ? 'https' : 'http';
  const host = req.headers.host || 'localhost';
  const url = `${protocol}://${host}${req.url}`;
  
  const headers = fromNodeHeaders(req.headers);
  
  // Get body for POST/PUT/PATCH requests
  let body: string | undefined;
  if (req.method && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
    body = await new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => data += chunk);
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });
  }
  
  return new Request(url, {
    method: req.method,
    headers,
    body: body || undefined,
  });
}

/**
 * Send Web Response to Node.js ServerResponse
 * 
 * @param webRes - Web API Response object
 * @param nodeRes - Node.js response object
 */
async function sendWebResponse(webRes: Response, nodeRes: ServerResponse): Promise<void> {
  nodeRes.statusCode = webRes.status;
  
  webRes.headers.forEach((value, key) => {
    nodeRes.setHeader(key, value);
  });
  
  const body = await webRes.text();
  nodeRes.end(body);
}

/**
 * Create Node.js OAuth route handler
 * 
 * Use this to create secure OAuth API routes in your Node.js HTTP server
 * that handle authorization with server-side secrets.
 * 
 * @param config - OAuth handler configuration with provider credentials
 * @returns Request handler function for Node.js
 * 
 * @example
 * ```typescript
 * import { createServer } from 'http';
 * import { toNodeHandler } from 'integrate-sdk/adapters/node';
 * 
 * const handler = toNodeHandler({
 *   providers: {
 *     github: {
 *       clientId: process.env.GITHUB_CLIENT_ID!,
 *       clientSecret: process.env.GITHUB_CLIENT_SECRET!,
 *     },
 *   },
 * });
 * 
 * createServer(async (req, res) => {
 *   if (req.url?.startsWith('/api/integrate/')) {
 *     await handler(req, res);
 *   } else {
 *     res.statusCode = 404;
 *     res.end('Not Found');
 *   }
 * }).listen(3000);
 * ```
 */
export function toNodeHandler(config: OAuthHandlerConfig) {
  const oauthHandler = new OAuthHandler(config);

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    try {
      const webReq = await toWebRequest(req);
      const url = new URL(webReq.url);
      const segments = url.pathname.split('/').filter(Boolean);
      const action = segments[segments.length - 1];

      let webRes: Response;

      // Handle POST requests
      if (req.method === 'POST') {
        if (action === 'authorize') {
          // Pass full Web Request for context detection
          const result = await oauthHandler.handleAuthorize(webReq);
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          
          // Add Set-Cookie header if context cookie was created
          if (result.setCookie) {
            headers['Set-Cookie'] = result.setCookie;
          }
          
          webRes = new Response(JSON.stringify(result), {
            status: 200,
            headers,
          });
        } else if (action === 'callback') {
          // Pass full Web Request for context restoration
          const result = await oauthHandler.handleCallback(webReq);
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          
          // Add Set-Cookie header to clear context cookie
          if (result.clearCookie) {
            headers['Set-Cookie'] = result.clearCookie;
          }
          
          webRes = new Response(JSON.stringify(result), {
            status: 200,
            headers,
          });
        } else if (action === 'disconnect') {
          const authHeader = webReq.headers.get('authorization');
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            webRes = new Response(
              JSON.stringify({ error: 'Missing or invalid Authorization header' }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }
            );
          } else {
            const accessToken = authHeader.substring(7);
            const body = await webReq.json();
            const { provider } = body;

            if (!provider) {
              webRes = new Response(
                JSON.stringify({ error: 'Missing provider in request body' }),
                {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' },
                }
              );
            } else {
              // Pass the request object for context extraction
              const result = await oauthHandler.handleDisconnect({ provider }, accessToken, webReq);
              webRes = new Response(JSON.stringify(result), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              });
            }
          }
        } else {
          webRes = new Response(
            JSON.stringify({ error: `Unknown action: ${action}` }),
            {
              status: 404,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }
      }
      // Handle GET requests
      else if (req.method === 'GET' && action === 'status') {
        const provider = url.searchParams.get('provider');
        const authHeader = webReq.headers.get('authorization');

        if (!provider) {
          webRes = new Response(
            JSON.stringify({ error: 'Missing provider query parameter' }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        } else if (!authHeader || !authHeader.startsWith('Bearer ')) {
          webRes = new Response(
            JSON.stringify({ error: 'Missing or invalid Authorization header' }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        } else {
          const accessToken = authHeader.substring(7);
          const result = await oauthHandler.handleStatus(provider, accessToken);
          webRes = new Response(JSON.stringify(result), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      } else {
        webRes = new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      await sendWebResponse(webRes, res);
    } catch (error: any) {
      console.error('[OAuth Handler] Error:', error);
      const errorRes = new Response(
        JSON.stringify({ error: error.message || 'Internal server error' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
      await sendWebResponse(errorRes, res);
    }
  };
}

