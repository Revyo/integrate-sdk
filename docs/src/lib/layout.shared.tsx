import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export function baseOptions(): BaseLayoutProps {
  return {
    githubUrl: 'https://github.com/revyo/integrate-sdk',
    links: [
      {
        type: 'main',
        url: '/#',
        text: 'Pricing',
      },
    ],
    nav: {
      title: 'Integrate',
    },
  };
}
