// @ts-check
/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Mosaic',
  tagline: 'The metadata-driven full-stack platform — model, migrate, design, deploy',
  favicon: 'img/favicon.svg',

  url: process.env.MOSAIC_DOCS_URL ?? 'http://localhost:3003',
  baseUrl: process.env.MOSAIC_DOCS_BASE_URL ?? '/',
  organizationName: 'lethabomaepa11',
  projectName: 'mosaic-apps',

  onBrokenLinks: 'throw',

  markdown: {
    hooks: { onBrokenMarkdownLinks: 'warn' },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          editUrl: 'https://github.com/lethabomaepa11/mosaic-apps/tree/main/docs/',
        },
        blog: {
          showReadingTime: true,
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: 'img/mosaic-social.png',
      navbar: {
        title: 'Mosaic',
        logo: { alt: 'Mosaic logo', src: 'img/logo.svg' },
        items: [
          { type: 'docSidebar', sidebarId: 'guide', position: 'left', label: 'Docs' },
          { to: '/docs/components/catalog', label: 'Components', position: 'left' },
          { to: '/docs/auto-crud', label: 'API reference', position: 'left' },
          { to: '/blog', label: 'Blog', position: 'left' },
          {
            href: 'https://github.com/lethabomaepa11/mosaic-apps',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              { label: 'Quickstart', to: '/docs/intro' },
              { label: 'CLI', to: '/docs/cli' },
              { label: 'Migrations', to: '/docs/migrations' },
            ],
          },
          {
            title: 'Guides',
            items: [
              { label: 'Form JSON spec', to: '/docs/form-json' },
              { label: 'Builder guide', to: '/docs/builder' },
              { label: 'PWA guide', to: '/docs/pwa' },
            ],
          },
          {
            title: 'More',
            items: [
              { label: 'Blog', to: '/blog' },
              { label: 'GitHub', href: 'https://github.com/lethabomaepa11/mosaic-apps' },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Mosaic contributors.`,
      },
      prism: {
        theme: { plain: { color: '#e6edf3', backgroundColor: '#0d1117' }, styles: [] },
        darkTheme: { plain: { color: '#e6edf3', backgroundColor: '#0d1117' }, styles: [] },
        additionalLanguages: ['json', 'bash', 'sql'],
      },
      colorMode: {
        defaultMode: 'light',
        respectPrefersColorScheme: true,
      },
    }),
};

module.exports = config;
