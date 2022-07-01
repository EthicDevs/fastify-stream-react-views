import React, { ComponentType } from "react";

import type { ReactIsland, WrapperProps } from "../types";

type IslandsWrappedWithComponent<T> = Record<string, [string, ReactIsland<T>]>;

export function wrapIslandsWithComponent<
  T extends Record<string, unknown> = Record<string, unknown>,
>(
  islands: Record<string, [string, ReactIsland<T>]>,
  WrapperComponent: ComponentType<WrapperProps>,
): IslandsWrappedWithComponent<T> {
  const entries = Object.entries(islands);
  const wrapWithComponent = (
    islandId: string,
    Island: ReactIsland<T>,
  ): ReactIsland<T> => {
    if (Island.islandId != null) return Island;
    let islandIdx = -1;
    const wrappedView = (hocProps: T) => {
      islandIdx += 1;
      const islandIdxInstance = `${islandId}$$${islandIdx}`;
      console.log("wrappedView/", islandIdxInstance);
      return (
        <WrapperComponent
          islandId={islandIdxInstance}
          childrenAsFn={(props) => <Island {...hocProps} {...props} _csr />}
        />
      );
    };
    wrappedView.$type = "ReactIsland" as const;
    wrappedView.displayName = `${Island.displayName || Island.name}`;
    wrappedView.island = Island;
    wrappedView.islandId = wrappedView.displayName;
    return wrappedView;
  };

  const wrappedViews = entries.reduce(
    (acc, [islandId, [islandPath, Island]]) => {
      islandId = `${Island.displayName || Island.name}`;
      acc = {
        ...acc,
        [islandId]: [
          islandPath,
          wrapWithComponent(islandId, Island),
        ],
      };
      return acc;
    },
    {} as IslandsWrappedWithComponent<T>,
  );

  return wrappedViews;
}
