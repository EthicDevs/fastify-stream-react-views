// lib
import type { ReactIsland, ScriptTag } from "../types";
import { removeCommentsAndSpacing } from "../helpers";
import { ISLAND_RUNTIME_GLOBAL_NAME } from "../constants";

export default async function makePageScript(
  viewId: string,
  {
    encounteredIslandsById,
    islandsPropsById,
    islandsScriptTags,
    useEsImports,
  }: {
    encounteredIslandsById: Record<string, ReactIsland<{}>>;
    islandsPropsById: Record<string, Record<string, unknown>>;
    islandsScriptTags: ScriptTag[];
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
  const islandsRuntimeScriptTag: ScriptTag = {
    id: ISLAND_RUNTIME_GLOBAL_NAME,
    // TODO: Make this use the assets path specified/resolved from options
    src: "/public/islands-runtime.js",
    type: "module",
  };
  const script: string = `${
    useEsImports === true
      ? [islandsRuntimeScriptTag, ...islandsScriptTags]
          .map(({ id, src }) => `  import ${id} from "${src}"`)
          .join(";\n")
      : ""
  };

(function main($${ISLAND_RUNTIME_GLOBAL_NAME}) {
  const e = "${process.env.NODE_ENV || "production"}";
  const v = "${viewId}";

  ${
    isProd === false
      ? `
  const s = new Date().getTime();
  function log(message, args = undefined, tag = "${ISLAND_RUNTIME_GLOBAL_NAME}", now = Date.now()) {
    const logMsg = \`[\${now}][\${tag}] \${message}\`;
    if (args) {
      console.log(logMsg, args);
    } else {
      console.log(logMsg);
    }
  }

  log(\`Reviving Islands in View "\${v}"...\`);
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

  $${ISLAND_RUNTIME_GLOBAL_NAME}.reviveIslands(islands, islandsProps, islandsEls)
    .then(afterRevival)
    .catch(afterRevival);
})(${ISLAND_RUNTIME_GLOBAL_NAME});`;

  return removeCommentsAndSpacing(script);
}
