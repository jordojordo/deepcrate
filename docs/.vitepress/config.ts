import { defineConfig } from 'vitepress';

export default defineConfig({
  title:       'DeepCrate',
  description: 'Self-hosted music discovery pipeline',
  srcDir:      './src',
  base:        '/deepcrate/',
  themeConfig: {
    logo: '/logo.svg',
    nav:  [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Reference', link: '/reference/api' },
    ],
    sidebar: {
      '/guide/': [
        {
          text:  'Guide',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Configuration', link: '/guide/configuration' },
            { text: 'Authelia Integration', link: '/guide/authelia-integration' },
            { text: 'Comparison', link: '/guide/comparison' },
          ],
        },
      ],
      '/reference/': [
        {
          text:  'Reference',
          items: [
            { text: 'API Reference', link: '/reference/api' },
            { text: 'Architecture', link: '/reference/architecture' },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/jordojordo/deepcrate' },
    ],
  },
});
