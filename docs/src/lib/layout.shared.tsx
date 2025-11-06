import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export function baseOptions(): BaseLayoutProps {
  return {
    githubUrl: 'https://github.com/revyo/integrate-sdk',
    links: [
      {
        type: 'main',
        url: '/pricing',
        text: 'Pricing',
      },
      {
        type: 'button',
        url: 'https://app.integrate.dev',
        text: 'Sign In',
        secondary: true,
      },
      {
        type: 'button',
        url: 'https://app.integrate.dev/signup',
        text: 'Get Started',
        secondary: true,
      },
    ],
    nav: {
      title: 'Integrate',
    },
    themeSwitch: {
      enabled: false,
    },
  };
}
