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
  onBrokenAnchors: 'throw',

  markdown: {
    hooks: { onBrokenMarkdownLinks: 'throw' },
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
      docs: { sidebar: { autoCollapseCategories: true } },
      navbar: {
        title: 'Mosaic',
        logo: { alt: 'Mosaic logo', src: 'img/logo.svg' },
        items: [
          { type: 'docSidebar', sidebarId: 'guide', position: 'left', label: 'Docs' },
          { to: '/api', label: 'API', position: 'left' },
          { href: 'https://cloud.mosaictalent.co.za', label: 'Cloud', position: 'right' },
          {
            href: 'https://github.com/lethabomaepa11/mosaic-apps',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        links: [
          {
            title: 'Mosaic',
            items: [
              { label: 'Documentation', to: '/docs/intro' },
              { label: 'Mosaic Cloud', to: '/docs/cloud-studio' },
              { label: 'Road to v1', to: '/docs/roadmap' },
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
