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
      WrapperEl != null ? WrapperEl.name : "UnnamedWrapper"
    }(${ComponentEl != null ? ComponentEl.name : "UnknownComponent"})`;
    return wrappedEl as C;
  };
  return _wrapComponent(Component, Wrapper);
}
