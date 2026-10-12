/** Host applications provide their router without coupling the runtime to it. */
export const MOSAIC_NAVIGATION_CONTEXT = 'mosaic:navigation';
export type MosaicNavigate = (href: string, newTab?: boolean) => void | Promise<void>;
