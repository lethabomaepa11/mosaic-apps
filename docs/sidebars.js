/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  guide: [
    'intro',
    'quickstart',
    'architecture',
    'cli',
    'entities',
    'migrations',
    'auto-crud',
    'form-json',
    'builder',
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
