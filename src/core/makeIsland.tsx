// 3rd-party
// import React from "react";

// lib
import type { ReactIsland } from "../types";
import { IslandsWrapper } from "../components/IslandsWrapper";
import { wrapIslandsWithComponent } from "../helpers/wrapIslandsWithComponent";

/**
 * A factory function to use as an HOC while exporting default in an Island file.
 * This function takes a component and adds required ids/data attributes for it
 * to work properly when being revived (so its being found and revived
 * @param {ReactIsland<T>} Island - The island to make
 * @returns The Island with ids/data attributes set.
 */
export default function makeIsland<
  T extends Record<string, unknown> = Record<string, unknown>,
>(Island: ReactIsland<T>): ReactIsland<T> {
  const isServerSide = typeof window === "undefined";
  const islandId = Island.islandId || Island.displayName || Island.name;
  if (isServerSide) {
    const islands = wrapIslandsWithComponent(
      { [islandId]: [islandId, Island] },
      IslandsWrapper,
    );
    const islandsValues = Object.values(islands);
    if (islandId in islands && islands[islandId] != null) {
      const [, WrappedIsland] = islands[islandId];
      return WrappedIsland;
    } else if (islandsValues.length >= 1 && islandsValues[0] != null) {
      const [, WrappedIsland] = islandsValues[0];
      return WrappedIsland;
    }
    return Island;
  }
  return Island;
}
