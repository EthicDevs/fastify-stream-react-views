// 3rd party - react std
import React, { FC } from "react";
import ReactDOM from "react-dom/server";

export async function renderToStream(
  viewPath: string,
  props: { [x: string]: unknown },
): Promise<NodeJS.ReadableStream> {
  const View: FC<typeof props & { ssr: boolean }> = require(viewPath);
  return ReactDOM.renderToStaticNodeStream(<View {...props} ssr />);
}
