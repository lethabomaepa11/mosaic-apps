export type CloudRelease = {
  origin: string;
  projectId: string;
  framework: 'nextjs' | 'sveltekit';
  version: string;
};

export const cloudRelease: CloudRelease | null = null;
