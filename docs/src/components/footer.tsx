import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ThemeToggle } from 'fumadocs-ui/components/layout/theme-toggle';

const layoutWidthClass = 'container mx-auto px-6 lg:px-12';

export function Footer() {
    return (
        <footer className="mt-auto border-t border-zinc-200 bg-white/80 py-12 dark:border-zinc-800 dark:bg-zinc-950/60">
            <div className={cn(layoutWidthClass, 'space-y-8')}>
                <div className="grid gap-10 text-sm text-zinc-600 dark:text-zinc-300 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-3">
                        <p className="text-base font-semibold text-zinc-900 dark:text-white">Integrate SDK</p>
                        <p className="max-w-xs text-sm">
                            A type-safe TypeScript SDK for connecting AI systems to the Integrate MCP server.
                        </p>
                        <Link href="/docs" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400">
                            Read the documentation
                            <ArrowRight className="size-4" aria-hidden />
                        </Link>
                    </div>
                    <div className="space-y-2">
                        <p className="font-semibold text-zinc-900 dark:text-white">Getting started</p>
                        <ul className="space-y-1">
                            <li>
                                <Link href="/docs/getting-started/installation" className="hover:text-blue-600 dark:hover:text-blue-400">
                                    Installation
                                </Link>
                            </li>
                            <li>
                                <Link href="/docs/getting-started/quick-start" className="hover:text-blue-600 dark:hover:text-blue-400">
                                    Quick Start
                                </Link>
                            </li>
                            <li>
                                <Link href="/docs/reference/api-reference" className="hover:text-blue-600 dark:hover:text-blue-400">
                                    API Reference
                                </Link>
                            </li>
                        </ul>
                    </div>
                    <div className="space-y-2">
                        <p className="font-semibold text-zinc-900 dark:text-white">Integrations</p>
                        <ul className="space-y-1">
                            <li>
                                <Link href="/docs/integrations" className="hover:text-blue-600 dark:hover:text-blue-400">
                                    Built-in Integrations
                                </Link>
                            </li>
                            <li>
                                <Link href="/docs/ai/vercel-ai" className="hover:text-blue-600 dark:hover:text-blue-400">
                                    Vercel AI SDK
                                </Link>
                            </li>
                        </ul>
                    </div>
                    <div className="space-y-2">
                        <p className="font-semibold text-zinc-900 dark:text-white">Resources</p>
                        <ul className="space-y-1">
                            <li>
                                <Link href="/docs/reference/architecture" className="hover:text-blue-600 dark:hover:text-blue-400">
                                    Architecture
                                </Link>
                            </li>
                            <li>
                                <Link href="/docs/guides/advanced-usage" className="hover:text-blue-600 dark:hover:text-blue-400">
                                    Advanced usage
                                </Link>
                            </li>
                            <li>
                                <Link href="/pricing" className="hover:text-blue-600 dark:hover:text-blue-400">
                                    Pricing
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>
                <div className="flex items-center justify-center border-t border-zinc-200 pt-8 dark:border-zinc-800">
                    <ThemeToggle />
                </div>
            </div>
        </footer>
    );
}

