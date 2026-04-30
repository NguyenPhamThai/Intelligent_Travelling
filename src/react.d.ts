declare module "react" {
  export type ReactNode = any;

  export function useState(initial: any): any;

  export function useMemo(factory: any, deps: any[]): any;

  const React: any;
  export default React;
}
