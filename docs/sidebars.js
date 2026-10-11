/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  guide: [
    'intro',
    'quickstart',
    'architecture',
    'cli',
    'npm-packages',
    'entities',
    'migrations',
    'auto-crud',
    'form-json',
    'builder',
    'state-management',
    {
      type: 'category',
      label: 'Components',
      items: ['components/catalog'],
    },
    'pwa',
    'theming',
    'security',
    'deployment',
    'comparisons',
    'recipes',
    'faq',
  ],
};

module.exports = sidebars;
