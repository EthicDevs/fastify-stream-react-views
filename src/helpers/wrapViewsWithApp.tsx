import React, { ComponentType, VFC } from "react";

type ViewsWrappedWithApp<T> = Record<string, React.VFC<T>>;

export function wrapViewsWithApp<
  T extends Record<string, unknown> = Record<string, unknown>,
>(views: Record<string, VFC<T>>, App: ComponentType): ViewsWrappedWithApp<T> {
  const entries = Object.entries(views);

  const wrapWithView = (ViewEl: VFC<T>): React.VFC<T> => {
    const wrappedView = (hocProps: T) => {
      return (
        <App>
          <ViewEl {...hocProps} />
        </App>
      );
    };
    wrappedView.displayName = `WithApp(${ViewEl.displayName || ViewEl.name})`;
    return wrappedView;
  };

  const wrappedViews = entries.reduce((acc, [viewName, View]) => {
    acc = { ...acc, [viewName]: wrapWithView(View) };
    return acc;
  }, {} as typeof views);

  return wrappedViews;
}
