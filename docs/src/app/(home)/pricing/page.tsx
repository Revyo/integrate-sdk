import Link from 'next/link';
import { ArrowRight, Check, Sparkles } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { Footer } from '@/components/footer';

const layoutWidthClass = 'container mx-auto px-6 lg:px-12';

const primaryCtaClass = cn(
  buttonVariants({ variant: 'primary', size: 'sm' }),
  'h-10 rounded-lg px-4 text-sm font-semibold shadow-sm hover:shadow-md',
);

const secondaryCtaClass = cn(
  buttonVariants({ variant: 'outline', size: 'sm' }),
  'h-10 rounded-lg px-4 text-sm font-semibold backdrop-blur-sm',
);

const plans = [
  {
    name: 'Starter',
    tagline: 'Ideal for solo devs, hobby projects, and early pilots. Linear cost beyond free.',
    price: '$0.20 / 1,000 requests',
    priceSubtext: '+ 10,000 free requests/month',
    default: true,
    payg: true,
    includedUsage: 'Pay-as-you-go',
    rateLimits: '2 request per second sustained\n20 request per second burst (60s)',
    concurrency: '2 concurrent',
    requestDuration: '10 sec',
    payloadCap: '256 KB',
    logsRetention: '7 days',
    support: 'Community',
    keyFeatures: [],
    highlight: false,
  },
  {
    name: 'Scale',
    tagline: 'For teams moving to production needing reliability & org features.',
    price: '$149 / month per org',
    priceSubtext: '+ same $0.20 / 1,000 requests',
    default: false,
    payg: true,
    includedUsage: 'Pay-as-you-go',
    rateLimits: '10 request per second sustained\n100 request per second burst',
    concurrency: '10 concurrent',
    requestDuration: '30 sec',
    payloadCap: '1 MB',
    logsRetention: '30 days',
    support: 'Priority (8×5, ≤4h first response)',
    keyFeatures: ['SSO + audit logs', 'Prod + Sandbox orgs', 'Same usage rate'],
    highlight: true,
  },
  {
    name: 'Enterprise',
    tagline: 'For orgs with advanced compliance or scale needs.',
    price: 'Custom annual commit',
    priceSubtext: 'Volume discounts',
    default: false,
    payg: false,
    includedUsage: 'Volume discounts',
    rateLimits: 'Custom',
    concurrency: 'Custom',
    requestDuration: 'Custom',
    payloadCap: 'Custom',
    logsRetention: 'Custom',
    support: 'Dedicated (24×5 / 24×7)',
    keyFeatures: ['SLAs', 'Invoicing/POs', 'DPA', 'Private Slack', 'Data residency'],
    highlight: false,
  },
];

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex flex-1 flex-col gap-24 pb-24">
        <section className="relative overflow-hidden border-b border-zinc-200 bg-white/80 py-24 dark:border-zinc-800 dark:bg-zinc-950/60">
          <div className="absolute inset-0 -z-10 bg-linear-to-br from-blue-500/15 via-transparent to-fuchsia-500/20 dark:from-blue-500/30 dark:to-fuchsia-600/30" />
          <div className="absolute -right-24 -top-32 size-64 rounded-full bg-fuchsia-500/15 blur-3xl dark:bg-fuchsia-500/25" aria-hidden />
          <div className="absolute -left-20 bottom-0 size-88 rounded-full bg-blue-500/10 blur-3xl dark:bg-blue-500/30" aria-hidden />
          <div className={cn(layoutWidthClass, 'relative space-y-7 text-center')}>
            <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/80 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
              <Sparkles className="size-3.5" aria-hidden />
              Simple, transparent pricing
            </span>
            <h1 className="text-pretty text-4xl font-semibold leading-tight text-zinc-900 dark:text-white sm:text-5xl lg:text-6xl">
              Choose the plan that fits your needs
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-zinc-600 dark:text-zinc-300">
              Start free, scale as you grow. All plans include access to our full integration library and MCP server infrastructure.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <a href="https://app.integrate.dev" className={primaryCtaClass}>
                Get started
                <ArrowRight className="size-4" aria-hidden />
              </a>
              <Link href="/docs" className={secondaryCtaClass}>
                Explore the docs
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          </div>
        </section>

        <section className={cn(layoutWidthClass, 'space-y-12')}>
          <div className="grid gap-8 lg:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={cn(
                  'relative overflow-hidden rounded-2xl border bg-white/70 p-8 shadow-sm dark:bg-zinc-900/60',
                  plan.highlight
                    ? 'border-blue-500/50 dark:border-blue-400/50 lg:scale-105'
                    : 'border-zinc-200 dark:border-zinc-800',
                )}
              >
                {plan.highlight && (
                  <div className="absolute inset-0 -z-10 bg-linear-to-br from-blue-500/10 via-transparent to-fuchsia-500/10 dark:from-blue-500/20 dark:to-fuchsia-500/20" />
                )}
                {plan.default && (
                  <span className="mb-4 inline-block rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    Default
                  </span>
                )}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-2xl font-semibold text-zinc-900 dark:text-white">{plan.name}</h3>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{plan.tagline}</p>
                  </div>
                  <div>
                    <div className="text-3xl font-semibold text-zinc-900 dark:text-white">{plan.price}</div>
                    {plan.priceSubtext && (
                      <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{plan.priceSubtext}</div>
                    )}
                  </div>
                  <div className="space-y-4 border-t border-zinc-200 pt-6 dark:border-zinc-800">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Included Usage
                      </div>
                      <div className="mt-1 text-sm text-zinc-900 dark:text-white">{plan.includedUsage}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Rate Limits
                      </div>
                      <div className="mt-1 whitespace-pre-line text-sm text-zinc-900 dark:text-white">{plan.rateLimits}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Concurrency
                      </div>
                      <div className="mt-1 text-sm text-zinc-900 dark:text-white">{plan.concurrency}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Request Duration
                      </div>
                      <div className="mt-1 text-sm text-zinc-900 dark:text-white">{plan.requestDuration}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Payload Cap
                      </div>
                      <div className="mt-1 text-sm text-zinc-900 dark:text-white">{plan.payloadCap}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Logs Retention
                      </div>
                      <div className="mt-1 text-sm text-zinc-900 dark:text-white">{plan.logsRetention}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Support
                      </div>
                      <div className="mt-1 text-sm text-zinc-900 dark:text-white">{plan.support}</div>
                    </div>
                    {plan.keyFeatures.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                          Key Features
                        </div>
                        <ul className="mt-2 space-y-2">
                          {plan.keyFeatures.map((feature) => (
                            <li key={feature} className="flex items-start gap-2 text-sm text-zinc-900 dark:text-white">
                              <Check className="mt-0.5 size-4 shrink-0 text-blue-500" aria-hidden />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="pt-4">
                    <a
                      href="https://app.integrate.dev/signup"
                      className={cn(
                        'flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors',
                        plan.highlight
                          ? 'bg-white text-black hover:bg-white/70 dark:bg-white dark:hover:bg-white/60'
                          : 'border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700',
                      )}
                    >
                      Get started
                      <ArrowRight className="size-4" aria-hidden />
                    </a>
                  </div>
                </div>
              </div>
            ))}
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
              Ready to get started?
            </h2>
            <p className="mx-auto max-w-2xl text-base text-zinc-600 dark:text-zinc-300">
              Start building with Integrate SDK today. No credit card required for the Starter plan.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <a href="https://app.integrate.dev" className={primaryCtaClass}>
                Get started
                <ArrowRight className="size-4" aria-hidden />
              </a>
              <Link href="/docs" className={secondaryCtaClass}>
                Read the docs
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

