import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { baseOptions } from '@/lib/layout.shared';
import { ThemeToggle } from 'fumadocs-ui/components/layout/theme-toggle';

export default function Layout({ children }: LayoutProps<'/docs'>) {
  return (
    <DocsLayout
      tree={source.pageTree}
      {...baseOptions()}
      themeSwitch={{
        enabled: true,
      }}
    >
      {children}
    </DocsLayout>
  );
}
