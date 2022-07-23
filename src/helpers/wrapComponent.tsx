import React, { ComponentType, VFC } from "react";

export function wrapComponent<P = {}, C extends VFC<P> = VFC<P>>(
  Component: C,
  Wrapper: ComponentType,
): C {
  const _wrapComponent = (ComponentEl: VFC<P>, WrapperEl: ComponentType): C => {
    const wrappedEl = (hocProps: P) => {
      return (
        <WrapperEl>
          <ComponentEl {...hocProps} />
        </WrapperEl>
      );
    };
    wrappedEl.displayName = `With${
      WrapperEl != null && "name" in WrapperEl
        ? WrapperEl.name
        : undefined || "UnnamedWrapper"
    }(${
      ComponentEl != null && "name" in ComponentEl
        ? ComponentEl.name
        : undefined || "UnknownComponent"
    })`;
    return wrappedEl as C;
  };
  return _wrapComponent(Component, Wrapper);
}
