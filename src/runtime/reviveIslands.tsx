import React from "react";
import ReactDOM from "react-dom";

import { ReactIsland } from "../types";
import { IslandsWrapper } from "../components/IslandsWrapper";
export { IslandsWrapper }; // re-export so its in the runtime bundle

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
): Promise<string[]> {
  let revivedIslands: string[] = [];
  Object.entries(islands).forEach(([islandId, Island]) => {
    try {
      const props =
        islandId in islandsProps && islandsProps[islandId] != null
          ? islandsProps[islandId]
          : {};
      ReactDOM.render(
        <Island {...props} _csr={true} />,
        document.getElementById(islandId),
        () => revivedIslands.push(islandId),
      );
    } catch (err) {
      const errMsg = (err as Error).message;
      console.log(`Could not revive Island "${islandId}". Error: ${errMsg}`);
    }
  });
  return revivedIslands;
}
