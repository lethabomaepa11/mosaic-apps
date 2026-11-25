/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  guide: [
    'intro',
    'quickstart',
    'cloud-studio',
    'workflows',
    'extensions',
    'app-integrations',
    'architecture',
    'cli',
    'entities',
    'migrations',
    'auto-crud',
    'form-json',
    'builder',
    'history',
    'state-management',
    {
      type: 'category',
      label: 'Components',
      items: ['components/catalog', 'components/gallery'],
    },
    'pwa',
    'theming',
    'security',
    'deployment',
    'deployment-studio',
    'deployment-vercel',
    'roadmap',
    'recipes',
    'faq',
  ],
};

module.exports = sidebars;
