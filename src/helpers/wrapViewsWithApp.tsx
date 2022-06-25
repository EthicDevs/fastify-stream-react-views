import React, { ComponentType } from "react";

import { ReactView } from "../types";

type ViewsWrappedWithApp<T> = Record<string, [string, React.VFC<T>]>;

export function wrapViewsWithApp<
  T extends Record<string, unknown> = Record<string, unknown>,
>(
  views: Record<string, [string, ReactView<T>]>,
  App: ComponentType,
): ViewsWrappedWithApp<T> {
  const entries = Object.entries(views);

  const wrapWithView = (
    viewName: string,
    ViewEl: ReactView<T>,
  ): React.VFC<T> => {
    const wrappedView = (hocProps: T) => {
      return (
        <App>
          <ViewEl {...hocProps} _ssr />
        </App>
      );
    };
    wrappedView.displayName = `WithApp(${ViewEl.displayName || viewName})`;
    return wrappedView;
  };

  const wrappedViews = entries.reduce((acc, [viewName, [viewPath, View]]) => {
    acc = { ...acc, [viewName]: [viewPath, wrapWithView(viewName, View)] };
    return acc;
  }, {} as ViewsWrappedWithApp<T>);

  return wrappedViews;
}
