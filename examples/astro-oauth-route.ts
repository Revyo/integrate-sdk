/**
 * Astro OAuth Route Example
 * File: pages/api/integrate/[...all].ts
 * 
 * This file should be placed in your Astro project's pages/api/integrate/ directory.
 * It creates a catch-all route that handles all OAuth actions.
 */

import { handler } from '@/lib/integrate-server';
import type { APIRoute } from 'astro';

export const ALL: APIRoute = async (ctx) => {
  return handler(ctx.request, { params: { all: ctx.params.all } });
};

