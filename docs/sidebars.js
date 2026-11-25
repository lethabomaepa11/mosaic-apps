/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  guide: [
    'intro',
    {
      type: 'category',
      label: 'Getting started',
      collapsed: false,
      items: ['quickstart', 'cloud-studio', 'workflows'],
    },
    {
      type: 'category',
      label: 'Studio',
      items: ['builder', 'components/gallery', 'components/catalog', 'theming', 'history'],
    },
    {
      type: 'category',
      label: 'Framework',
      items: ['architecture', 'cli', 'entities', 'migrations', 'auto-crud', 'form-json', 'state-management', 'extensions', 'app-integrations'],
    },
    {
      type: 'category',
      label: 'Deployment',
      items: ['deployment', 'deployment-vercel', 'deployment-studio', 'security', 'pwa'],
    },
    {
      type: 'category',
      label: 'Help and roadmap',
      items: ['recipes', 'faq', 'roadmap'],
    },
  ],
};

module.exports = sidebars;
