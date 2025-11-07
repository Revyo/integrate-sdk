import Link from 'next/link';
import { codeToHtml } from 'shiki';
import {
  ArrowRight,
  BarChart3,
  Cpu,
  Layers,
  Lock,
  Plug,
  Sparkles,
  Workflow,
} from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { Footer } from '@/components/footer';

const layoutWidthClass = 'container mx-auto px-6 lg:px-12';

const codeSample = `import {
  createMCPServer,
  githubPlugin,
  gmailPlugin,
} from 'integrate-sdk';

export const { client: serverClient } = createMCPServer({
  redirectUri: 'http://localhost:3000',
  plugins: [
    githubPlugin({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      scopes: ['repo', 'user'],
    }),
    gmailPlugin({
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
      scopes: ['https://www.googleapis.com/auth/gmail.send'],
    }),
  ],
});

await client.github.createIssue({
  owner: 'integrate-dev',
  repo: 'roadmap',
  title: 'Ship agent hand-offs',
});`;

const vercelAICodeSample = `import { createMCPServer, githubPlugin, getVercelAITools } from "integrate-sdk";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

// 1. Create and connect MCP client
const mcpClient = createMCPServer({
  plugins: [
    githubPlugin({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      scopes: ['repo', 'user'],
    }),
  ],
});

// 2. Get tools in Vercel AI SDK format
const tools = getVercelAITools(mcpClient);

// 3. Use with AI models
const result = await generateText({
  model: openai("gpt-5"),
  prompt: 'Create a GitHub issue titled "Bug in login" in myrepo',
  tools,
  maxSteps: 5,
});

console.log(result.text);`;

const primaryCtaClass = cn(
  buttonVariants({ variant: 'primary', size: 'sm' }),
  'h-10 rounded-lg px-4 text-sm font-semibold shadow-sm hover:shadow-md',
);

const secondaryCtaClass = cn(
  buttonVariants({ variant: 'outline', size: 'sm' }),
  'h-10 rounded-lg px-4 text-sm font-semibold backdrop-blur-sm',
);

const featureHighlights = [
  {
    icon: <Plug className="size-6 text-blue-500" aria-hidden />,
    title: 'Unified integrations',
    description:
      'Drop in GitHub, Gmail, Notion, and any MCP integration with a single type-safe client.',
  },
  {
    icon: <Workflow className="size-6 text-fuchsia-500" aria-hidden />,
    title: 'AI native tooling',
    description:
      'Expose third-party actions securely to AI agents and workflows without bespoke APIs.',
  },
  {
    icon: <Lock className="size-6 text-emerald-500" aria-hidden />,
    title: 'OAuth handled for you',
    description:
      'Provide credentials once; the Integrate MCP server manages the full OAuth handshake.',
  },
];

const buildingBlocks = [
  {
    title: 'Plugin architecture',
    description:
      'Enable only the MCP tools you need. Each plugin brings typed method calls, validation, and discovery.',
  },
  {
    title: 'Observability built-in',
    description:
      'Log, replay, and audit every tool call to understand how agents are acting on external systems.',
  },
];

const integrationStacks = [
  'GitHub',
  'Gmail',
  'Notion',
  'Slack',
  'Cursor',
  'Linear',
  'Vercel',
  'Zendesk',
];

export default async function HomePage() {
  const [lightCodeHtml, darkCodeHtml, lightVercelAICodeHtml, darkVercelAICodeHtml] = await Promise.all([
    codeToHtml(codeSample, {
      lang: 'ts',
      theme: 'github-light-default',
    }),
    codeToHtml(codeSample, {
      lang: 'ts',
      theme: 'github-dark',
    }),
    codeToHtml(vercelAICodeSample, {
      lang: 'ts',
      theme: 'github-light-default',
    }),
    codeToHtml(vercelAICodeSample, {
      lang: 'ts',
      theme: 'github-dark',
    }),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex flex-1 flex-col gap-24 pb-24">
        <section className="relative overflow-hidden border-b border-zinc-200 bg-white/80 py-24 dark:border-zinc-800 dark:bg-zinc-950/60">
          <div className="absolute inset-0 -z-10 bg-linear-to-br from-blue-500/15 via-transparent to-fuchsia-500/20 dark:from-blue-500/30 dark:to-fuchsia-600/30" />
          <div className="absolute -right-24 -top-32 size-64 rounded-full bg-fuchsia-500/15 blur-3xl dark:bg-fuchsia-500/25" aria-hidden />
          <div className="absolute -left-20 bottom-0 size-88 rounded-full bg-blue-500/10 blur-3xl dark:bg-blue-500/30" aria-hidden />
          <div className={cn(layoutWidthClass, 'relative grid gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center')}>
            <div className="space-y-7">
              <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/80 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
                <Sparkles className="size-3.5" aria-hidden />
                The MCP bridge for AI developers
              </span>
              <h1 className="text-pretty text-4xl font-semibold leading-tight text-zinc-900 dark:text-white sm:text-5xl lg:text-5xl">
                Connect AI agents to production services without shipping new backends.
              </h1>
              <p className="max-w-xl text-lg text-zinc-600 dark:text-zinc-300">
                Integrate SDK gives your AI systems a secure, typed gateway into third-party APIs. Configure plugins, stream MCP tool calls, and instrument everything with confidence.
              </p>
              <div className="flex flex-wrap gap-3">
                <a href="https://app.integrate.dev" className={primaryCtaClass}>
                  Get started
                  <ArrowRight className="size-4" aria-hidden />
                </a>
                <Link href="/docs" className={secondaryCtaClass}>
                  Explore the docs
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                <div className="flex items-center gap-2">
                  <Cpu className="size-4" aria-hidden />
                  Built for AI orchestration
                </div>
                <div className="flex items-center gap-2">
                  <Layers className="size-4" aria-hidden />
                  Plugin-based MCP client
                </div>
                <div className="flex items-center gap-2">
                  <Lock className="size-4" aria-hidden />
                  OAuth lives server-side
                </div>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white/80 shadow-xl backdrop-blur-sm dark:border-zinc-700/60 dark:bg-zinc-900/70">
              <div className="absolute -top-20 right-10 size-40 rounded-full bg-fuchsia-500/20 blur-2xl dark:bg-fuchsia-500/30" aria-hidden />
              <div className="text-sm">
                <div
                  className="hidden dark:block"
                  dangerouslySetInnerHTML={{ __html: darkCodeHtml }}
                />
                <div
                  className="block dark:hidden"
                  dangerouslySetInnerHTML={{ __html: lightCodeHtml }}
                />
              </div>
            </div>
          </div>
        </section>

        <section
          className={cn(
            layoutWidthClass,
            'grid gap-6 md:rounded-3xl border border-zinc-200 bg-white/70 p-10 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60 sm:grid-cols-3 sm:p-12',
          )}
        >
          {featureHighlights.map((feature) => (
            <div key={feature.title} className="space-y-3">
              <div className="flex size-12 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
                {feature.icon}
              </div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                {feature.title}
              </h2>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                {feature.description}
              </p>
            </div>
          ))}
        </section>

        <section className={cn(layoutWidthClass, 'grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-center')}>
          <div className="space-y-6">
            <span className="inline-flex items-center rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
              Build on proven patterns
            </span>
            <h2 className="text-pretty text-3xl font-semibold text-zinc-900 dark:text-white sm:text-4xl">
              The building blocks for production-ready AI integrations.
            </h2>
            <p className="text-base text-zinc-600 dark:text-zinc-300">
              Integrate SDK packages best practices learned from teams connecting autonomous agents to critical systems. Stay type-safe, compliant, and resilient without reinventing your backend.
            </p>
            <ul className="grid gap-5">
              {buildingBlocks.map((item) => (
                <li key={item.title} className="rounded-2xl border border-zinc-200 bg-white/60 p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                    {item.description}
                  </p>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white/80 shadow-xl backdrop-blur-sm dark:border-zinc-700/60 dark:bg-zinc-900/70">
            <div className="text-sm">
              <div
                className="hidden dark:block"
                dangerouslySetInnerHTML={{ __html: darkVercelAICodeHtml }}
              />
              <div
                className="block dark:hidden"
                dangerouslySetInnerHTML={{ __html: lightVercelAICodeHtml }}
              />
            </div>
          </div>
        </section>

        <section className={cn(layoutWidthClass, 'space-y-8')}>
          <div className="space-y-4 text-center">
            <h2 className="text-3xl font-semibold text-zinc-900 dark:text-white sm:text-4xl">
              Works with your favourite tools
            </h2>
            <p className="mx-auto max-w-2xl text-base text-zinc-600 dark:text-zinc-300">
              Integrate ships with first-party plugins and a simple API for adding anything our MCP server supports. Bring your own credentials and keep OAuth inside your secure environment.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {integrationStacks.map((name) => (
              <span key={name} className="rounded-full border border-zinc-200 px-4 py-2 backdrop-blur-sm dark:border-zinc-700">
                {name}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-4 text-sm text-zinc-600 dark:text-zinc-300">
            <span className="flex items-center gap-2">
              <Plug className="size-4 text-blue-500" aria-hidden />
              20+ built-in plugins
            </span>
            <span className="flex items-center gap-2">
              <Workflow className="size-4 text-fuchsia-500" aria-hidden />
              We provide the MCP server for you
            </span>
            <span className="flex items-center gap-2">
              <Layers className="size-4 text-emerald-500" aria-hidden />
              Request new plugins
            </span>
          </div>
        </section>

        <section
          className={cn(
            layoutWidthClass,
            'relative overflow-hidden md:rounded-[32px] border border-zinc-200 bg-white/80 p-12 text-center dark:border-zinc-800 dark:bg-zinc-900/70',
          )}
        >
          <div className="absolute inset-0 -z-10 bg-linear-to-br from-fuchsia-500/20 via-transparent to-blue-500/20 dark:from-fuchsia-500/25 dark:to-blue-500/25" />
          <div className="space-y-6">
            <h2 className="text-3xl font-semibold text-zinc-900 dark:text-white sm:text-4xl">
              Integrate any app to equip your AI or app.
            </h2>
            <p className="mx-auto max-w-2xl text-base text-zinc-600 dark:text-zinc-300">
              Start with the Quick Start guide, wire up credentials in minutes, and empower your agents to act like senior operators across every SaaS your team relies on.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <a href="https://app.integrate.dev" className={primaryCtaClass}>
                Get started
                <ArrowRight className="size-4" aria-hidden />
              </a>
              <Link href="/docs/integrations/vercel-ai" className={secondaryCtaClass}>
                See the Vercel AI guide
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
