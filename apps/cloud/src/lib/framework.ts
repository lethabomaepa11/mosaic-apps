export type AppFramework = 'sveltekit' | 'nextjs';

export const frameworkLabel = (framework: string) => framework === 'nextjs' ? 'Next.js' : 'SvelteKit';
