import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://colloquium-journals.github.io',
  base: '/colloquium',
  integrations: [
    starlight({
      title: 'Colloquium',
      description: 'Open-source scientific journal publishing with conversational review and bot automation.',
      social: {
        github: 'https://github.com/colloquium-press/colloquium',
      },
      customCss: ['./src/styles/custom.css'],
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Introduction', slug: 'getting-started/introduction' },
            { label: 'Quick Start', slug: 'getting-started/quick-start' },
            { label: 'First Submission', slug: 'getting-started/first-submission' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'Journal Administration', slug: 'guides/journal-administration' },
            { label: 'Editorial Workflow', slug: 'guides/editorial-workflow' },
            { label: 'Conversations', slug: 'guides/conversations' },
            { label: 'Authentication', slug: 'guides/authentication' },
          ],
        },
        {
          label: 'Bot Development',
          items: [
            { label: 'Introduction', slug: 'bots/introduction' },
            { label: 'Getting Started', slug: 'bots/getting-started' },
            { label: 'Architecture', slug: 'bots/architecture' },
            { label: 'API Access', slug: 'bots/api-access' },
            { label: 'Configuration', slug: 'bots/configuration' },
            { label: 'Testing', slug: 'bots/testing' },
          ],
        },
        {
          label: 'Deployment',
          items: [
            { label: 'Overview', slug: 'deployment/overview' },
            { label: 'Docker Compose', slug: 'deployment/docker-compose' },
            { label: 'Cloud Platforms', slug: 'deployment/cloud-platforms' },
            { label: 'Upgrading', slug: 'deployment/upgrading' },
          ],
        },
      ],
    }),
    tailwind({ applyBaseStyles: false }),
  ],
});
