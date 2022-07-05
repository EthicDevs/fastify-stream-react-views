// lib
import type { ReactIsland } from "../types";
import { removeCommentsAndSpacing } from "./removeCommentsAndSpacing";

export async function makePageScript(
  viewId: string,
  {
    encounteredIslandsById,
    islandsPropsById,
  }: {
    encounteredIslandsById: Record<string, ReactIsland<{}>>;
    islandsPropsById: Record<string, Record<string, unknown>>;
  },
): Promise<string> {
  const encounteredIslandsEntries = Object.entries(encounteredIslandsById);
  const islandsPropsEntries = Object.entries(islandsPropsById);

  const script: string = `
(function main(_fastifyStreamReactViews) {
  const s = new Date().getTime();
  const v = "${viewId}";

  function log(message, args = undefined, tag = "islands", now = Date.now()) {
    const logMsg = \`[\${now}][\${tag}] \${message}\`;
    if (args) {
      console.log(logMsg, args);
    } else {
      console.log(logMsg);
    }
  }

  log(\`Reviving Islands for view "\${v}"...\`);

  var islands = {
  ${encounteredIslandsEntries
    .map(([islandId]) => `  "${islandId}": ${islandId}.default`)
    .join(",\n")}
  };
  var islandsEls = document.querySelectorAll('[data-islandid]') || [];
  var islandsProps = {
  ${islandsPropsEntries
    .map(([k, v]) => `  "${k}": ${JSON.stringify(v)}`)
    .join(",\n")},
  };

  log('islands:', islands);
  log('islandsEls:', islandsEls);
  log('islandsProps:', islandsProps);

  function afterRevival(revivalResults) {
    if (revivalResults != null && Array.isArray(revivalResults)) {
      log("Revived Islands:", revivalResults);
    } else {
      log("Could not revive Islands. Error:", revivalResults);
    }
    const e = new Date().getTime();
    const duration = e - s;
    log(\`Done in \${duration}ms\`);
  }

  _fastifyStreamReactViews.reviveIslands(islands, islandsProps, islandsEls)
    .then(afterRevival)
    .catch(afterRevival);
})(globalThis.fastifyStreamReactViews);`;

  return removeCommentsAndSpacing(script);
}
