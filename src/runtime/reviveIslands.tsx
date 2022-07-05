import React from "react";
import ReactDOM from "react-dom";

import type { ReactIsland } from "../types";

/**
 * A function that given an HashMap of Islands, and an HashMap of Islands Props,
 * will try to get island node by ID and then "revive" it by rendering original
 * component on it. This allows to re-render components that were first rendered
 * on the server-side once the HTML page was loaded by user, and to provide small
 * isolated area of interactivity within that Island's component.
 *
 * @returns an array containing the DOM IDs of the Islands that were revived.
 */
export async function reviveIslands(
  islands: Record<string, ReactIsland>,
  islandsProps: Record<string, Record<string, unknown>>,
  islandsEls: HTMLElement[],
): Promise<string[]> {
  let revivedIslands: string[] = [];
  islandsEls.forEach((islandEl, islandIdx) => {
    let _islandId: string = islandEl.id || `${islandIdx}`;
    try {
      const dataIslandIdx = islandEl.dataset.islandid;
      if (dataIslandIdx == null || dataIslandIdx.includes("$$") === false)
        return;
      const [realIslandId, _] = dataIslandIdx.split("$$");
      // if (parseInt(realIslandIdx, 10) !== islandIdx) return;
      const islandsEntries = Object.entries(islands).filter(
        ([iId]) => iId === realIslandId,
      );
      islandsEntries.forEach((island) => {
        if (island == null) return;
        const [islandId, Island] = island;
        _islandId = islandId;
        const props =
          dataIslandIdx in islandsProps && islandsProps[dataIslandIdx] != null
            ? islandsProps[dataIslandIdx]
            : {};
        ReactDOM.render(
          <Island {...props} _csr={true} data-islandid={dataIslandIdx} />,
          islandEl,
        );
        revivedIslands.push(dataIslandIdx);
      });
    } catch (err) {
      const errMsg = (err as Error).message;
      console.log(`Could not revive Island "${_islandId}". Error: ${errMsg}`);
    }
  });

  return revivedIslands;
}
