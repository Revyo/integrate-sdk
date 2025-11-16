import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export function baseOptions(includeMainLinks: boolean = true): BaseLayoutProps {
  const links: BaseLayoutProps['links'] = [];

  if (includeMainLinks) {
    links.push(
      {
        type: 'main',
        url: '/docs',
        text: 'Docs',
      },
      {
        type: 'main',
        url: '/pricing',
        text: 'Pricing',
      }
    );
  }

  links.push(
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
    }
  );

  return {
    githubUrl: 'https://github.com/integratedotdev/typescript-sdk',
    links,
    nav: {
      title: 'Integrate',
    },
    themeSwitch: {
      enabled: false,
    },
  };
}
