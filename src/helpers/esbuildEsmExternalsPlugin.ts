import type { Plugin as ESBuildPlugin } from "esbuild";
import escapeStringRegexp from "escape-string-regexp";

const NAME = "esm-externals";
const NAMESPACE = NAME;

function makeFilter(externals: string[]) {
  // TODO support for query strings?
  return new RegExp(
      '^(' + externals.map(escapeStringRegexp).join('|') + ')(\\/.*)?$',
  )
}

export function esbuildEsmExternalsPlugin({ externals }: { externals: string[] }) {
  return {
    name: NAME,
    setup(build) {
      const filter = makeFilter(externals)
      build.onResolve({ filter: /.*/, namespace: NAMESPACE }, (args) => {
        return {
          path: args.path,
          external: true,
        }
      })
      build.onResolve({ filter }, (args) => {
        return {
          path: args.path,
          namespace: NAMESPACE,
        }
      })
      build.onLoad({ filter: /.*/, namespace: NAMESPACE }, (args) => {
        if (args.path === 'styled-components') {
          return {
            contents: `export { styled as default } from ${JSON.stringify(args.path)}; export * from ${JSON.stringify(args.path)};`,
          }
        }
        return {
          contents: `export * as default from ${JSON.stringify(args.path)}; export * from ${JSON.stringify(args.path)};`,
        }
      })
    },
  } as ESBuildPlugin;
}
