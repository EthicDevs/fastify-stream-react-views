import React, { ComponentType } from "react";

import type {
  IslandsWrappedWithComponent,
  ReactIsland,
  WrapperProps,
} from "../types";

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
    // case when Island.islandId is already set (thus already wrapped)
    if (Island != null && "islandId" in Island && Island.islandId != null) {
      return Island;
    }
    // case when not yet wrapped with component
    let islandIdx = -1;
    const wrappedView = (hocProps: T) => {
      islandIdx += 1;
      const islandIdxInstance = `${islandId}$$${islandIdx}`;
      return (
        <WrapperComponent
          islandId={islandIdxInstance}
          childrenAsFn={(props) => <Island {...hocProps} {...props} _csr />}
        />
      );
    };
    wrappedView.$type = "ReactIsland" as const;
    wrappedView.displayName = `${
      Island != null && "displayName" in Island
        ? Island.displayName
        : undefined || islandId
    }`;
    wrappedView.island = Island;
    wrappedView.islandId = wrappedView.displayName;
    return wrappedView;
  };

  const wrappedViews = entries.reduce(
    (acc, [islandId, [islandPath, Island]]) => {
      islandId = `${
        Island != null && "displayName" in Island
          ? Island.displayName
          : undefined || islandId
      }`;
      acc = {
        ...acc,
        [islandId]: [islandPath, wrapWithComponent(islandId, Island)],
      };
      return acc;
    },
    {} as IslandsWrappedWithComponent<T>,
  );

  return wrappedViews;
}
