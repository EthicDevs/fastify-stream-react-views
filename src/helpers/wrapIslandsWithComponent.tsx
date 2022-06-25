import React, { ComponentType } from "react";

import { ReactIsland, WrapperProps } from "../types";

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
    const wrappedView = (hocProps: T) => {
      return (
        <WrapperComponent
          islandId={islandId}
          childrenAsFn={(props) => <Island {...hocProps} {...props} _csr />}
        />
      );
    };
    wrappedView.displayName = `${
      WrapperComponent.displayName || "WrappedIsland"
    }(${Island.displayName || Island.name})`;
    wrappedView.island = Island;
    wrappedView.islandId = islandId;
    return wrappedView;
  };

  const wrappedViews = entries.reduce(
    (acc, [islandId, [islandPath, Island]]) => {
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
