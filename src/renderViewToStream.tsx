// 3rd party - react std
import React from "react";
import ReactDOM from "react-dom/server";

import { ReactView } from "./types";

export function buildViewWithProps<P>(
  View: ReactView<P>,
  props: P,
): JSX.Element {
  return <View {...props} ssr />;
}

export function renderViewToStream(viewEl: JSX.Element): NodeJS.ReadableStream {
  return ReactDOM.renderToStaticNodeStream(viewEl);
}
