// lib
import type { ReactIsland } from "../types";
import { removeCommentsAndSpacing } from "../helpers";

export default async function makePageScript(
  viewId: string,
  {
    encounteredIslandsById,
    islandsPropsById,
    useEsImports,
  }: {
    encounteredIslandsById: Record<string, ReactIsland<{}>>;
    islandsPropsById: Record<string, Record<string, unknown>>;
    useEsImports: boolean;
    importsMap?: {
      id: string;
      moduleName: string;
      src: string;
    }[];
  },
): Promise<string> {
  const encounteredIslandsEntries = Object.entries(encounteredIslandsById);
  const islandsPropsEntries = Object.entries(islandsPropsById);

  const isProd = process.env.NODE_ENV === "production";
  const script: string = `
(function main(_fastifyStreamReactViews) {
  const e = "${process.env.NODE_ENV || "production"}";
  const v = "${viewId}";

  ${
    isProd === false
      ? `
  const s = new Date().getTime();
  function log(message, args = undefined, tag = "islands", now = Date.now()) {
    const logMsg = \`[\${now}][\${tag}] \${message}\`;
    if (args) {
      console.log(logMsg, args);
    } else {
      console.log(logMsg);
    }
  }

  log(\`Reviving Islands for view "\${v}"...\`);
  `
      : ""
  }

  var islands = {
  ${encounteredIslandsEntries
    .map(([islandId]) =>
      useEsImports === true
        ? `  "${islandId}": ${islandId}`
        : `  "${islandId}": ${islandId}.default`,
    )
    .join(",\n")}
  };
  var islandsEls = document.querySelectorAll('[data-islandid]') || [];
  var islandsProps = {
  ${islandsPropsEntries
    .map(([k, v]) => `  "${k}": ${JSON.stringify(v)}`)
    .join(",\n")},
  };

  ${
    isProd === false
      ? `
  log('islands:', islands);
  log('islandsEls:', islandsEls);
  log('islandsProps:', islandsProps);
  `
      : ""
  }

  function afterRevival(revivalResults) {
    ${
      isProd === false
        ? `
    if (revivalResults != null && Array.isArray(revivalResults)) {
      log("Revived Islands:", revivalResults);
    } else {
      log("Could not revive Islands. Error:", revivalResults);
    }
    const e = new Date().getTime();
    const duration = e - s;
    log(\`Done in \${duration}ms\`);
    return undefined;
    `
        : "return undefined;" // TODO: Allow to pass some error reporting script here from config
    }
  }

  _fastifyStreamReactViews.reviveIslands(islands, islandsProps, islandsEls)
    .then(afterRevival)
    .catch(afterRevival);
})(globalThis.fastifyStreamReactViews);`;

  return removeCommentsAndSpacing(script);
}
