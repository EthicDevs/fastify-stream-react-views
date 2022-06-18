// std
import stream from "stream";

// 3rd party - fastify std
import type { FastifyPluginAsync } from "fastify";
import makeFastifyPlugin from "fastify-plugin";

// lib
import type {
  ReactIsland,
  ReactView,
  StreamReactViewFunction,
  StreamReactViewPluginOptions,
  ViewContext,
  ViewContextBase,
} from "./types";
import {
  FASTIFY_VERSION_TARGET,
  HTML_DOCTYPE,
  HTML_MIME_TYPE,
} from "./constants";
import { DefaultAppComponent } from "./components/DefaultAppComponent";
import {
  buildViewWithProps,
  getHeadTagsStr,
  getHtmlTagsStr,
  isStyledComponentsAvailable,
  renderViewToStaticStream,
  renderViewToStream,
  walkFolderForFiles,
  wrapViewsWithApp,
} from "./helpers";

const streamReactViewsPluginAsync: FastifyPluginAsync<StreamReactViewPluginOptions> =
  async (fastify, options) => {
    if (options?.views == null && options?.viewsFolder == null) {
      throw new Error(`You have not provided either a "views" config key or a "viewsFolder" config key.
Please verify your "views/" folder aswell as the "views" config key in your "fastify-stream-react-views" register config.`);
    }

    let viewsByName: Record<string, ReactView> = {};
    let islandsByName: Record<string, ReactIsland> = {};

    if (options != null && options.viewsFolder != null) {
      const result = await walkFolderForFiles<ReactView>(options.viewsFolder);
      if (result != null) {
        viewsByName = result;
        console.log("Found views:", viewsByName);
      }
    }

    if (options != null && options.islandsFolder != null) {
      const result = await walkFolderForFiles<ReactIsland>(
        options.islandsFolder,
      );
      if (result != null) {
        islandsByName = result;
        console.log("Found islands:", islandsByName);
      }
    }

    if (options != null && options.views != null) {
      viewsByName = { ...viewsByName, ...options.views };
    }

    viewsByName = wrapViewsWithApp(
      viewsByName,
      options != null && options.appComponent != null
        ? options.appComponent
        : DefaultAppComponent,
    );

    fastify.decorateReply("streamReactView", <StreamReactViewFunction>(
      function streamReactView(view, props, viewCtx) {
        if (view in viewsByName === false || viewsByName[view] == null) {
          console.error(
            `Cannot find the requested view ${view} in views:`,
            viewsByName,
          );
          throw new Error(`Cannot find the requested view "${view}".
        Please verify your "viewsFolder" configured folder aswell as the "views" config key in your "fastify-stream-react-views" register config.`);
        }

        return new Promise(async (resolve, reject) => {
          try {
            const endpointStream = new stream.PassThrough();

            // Set correct mime-type on the response
            this.type(HTML_MIME_TYPE);

            // pipe this stream into fastify's raw stream
            endpointStream.pipe(this.raw);

            // Write the html5 doctype
            endpointStream.write(HTML_DOCTYPE);

            let titleStr = options?.appName || "Fastify + React = ❤️";
            if (props != null && "title" in props && props.title != null) {
              titleStr = `${props.title} ${
                options?.titleSeparatorChar || "-"
              } ${titleStr}`;
            }

            const htmlTags = {
              ...(options?.viewContext?.html || {}),
              ...(viewCtx?.html || {}),
            };

            const headTags = [
              ...(options?.viewContext?.head || []),
              ...(viewCtx?.head || []),
            ];

            const htmlTagsStr = getHtmlTagsStr(htmlTags);
            const headTagsStr = getHeadTagsStr(headTags);

            // Write html/head tags
            endpointStream.write(
              `<html ${htmlTagsStr}><head><title>${titleStr}</title>${headTagsStr}</head><body>`,
            );

            const {
              head: _,
              html: __,
              ...baseViewCtx
            } = (options?.viewContext || {}) as ViewContext;

            const viewProps = {
              ...options?.commonProps,
              ...props,
              // \/ ensure last so its not overridden by props/commonProps
              _ssr: true,
              viewCtx: <ViewContextBase>{
                headers: this.request.headers,
                ...(baseViewCtx || {}),
                ...(viewCtx || {}),
              },
            };

            const reactView = viewsByName[view];
            const viewEl = buildViewWithProps(reactView, viewProps);

            const onEndCallback = (err?: unknown) => {
              if (err != null) {
                const error = err as Error;
                console.error(`Cannot render view: "${view}". Error:\n`, error);
                endpointStream.end(
                  `<h1>${error.name}</h1><p>${error.message.replace(
                    "\n",
                    "<br />",
                  )}</p><pre style="max-width:100%;white-space:pre-wrap;"><code>${
                    error.stack
                  }</code></pre></body></html>`,
                );
                return resolve(this.send(endpointStream));
              }

              const { viewCtx } = viewProps;

              if (viewCtx != null) {
                if (viewCtx.redirectUrl != null) {
                  if (endpointStream.readableEnded === false) {
                    endpointStream.end();
                  }
                  return resolve(this.redirect(301, viewCtx.redirectUrl));
                }

                if (viewCtx.status != null) {
                  this.status(viewCtx.status);
                }
              }

              if (endpointStream.readableEnded === false) {
                // Inject Interactive components and their props.
                const script: string = `
<script crossorigin src="https://unpkg.com/react@17.0.2/umd/react.development.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@17.0.2/umd/react-dom.development.js"></script>
<script type="text/javascript">
"use strict";

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

function reviveInteractiveComponents(components) {
  var entries = Object.entries(components);
  var revivedElements = [];
  entries.forEach(function (_ref) {
    var _ref2 = _slicedToArray(_ref, 2);

    var componentId = _ref2[0];
    var getComponent = _ref2[1];

    revivedElements.push(ReactDOM.render(getComponent(), document.getElementById(componentId)));
  });
}

function AppFooter() {
  var _React$useState = React.useState(0);

  var _React$useState2 = _slicedToArray(_React$useState, 2);

  var counter = _React$useState2[0];
  var setCounter = _React$useState2[1];

  var incrementCounter = function incrementCounter() {
    return setCounter(function (prev) {
      return prev + 1;
    });
  };
  var decrementCounter = function decrementCounter() {
    return setCounter(function (prev) {
      return prev - 1;
    });
  };
  return React.createElement(
    "div",
    null,
    React.createElement(
      "strong",
      null,
      "Footer counter: " + counter
    ),
    React.createElement(
      "button",
      { onClick: incrementCounter },
      "INCREMENT"
    ),
    React.createElement(
      "button",
      { onClick: decrementCounter },
      "DECREMENT"
    )
  );
}

var components = {
  "app--footer": function appFooter() {
    return React.createElement(AppFooter, null);
  }
};
reviveInteractiveComponents(components);
</script>
`;
                // Important, close the body & html tags.
                endpointStream.end(`${script}</body></html>`);
              }

              return resolve(this.send(endpointStream));
            };

            if (
              options != null &&
              options.withStyledSSR === true &&
              isStyledComponentsAvailable()
            ) {
              const { ServerStyleSheet } = require("styled-components");
              const sheet = new ServerStyleSheet();
              const jsx = sheet.collectStyles(viewEl);
              const reactViewWithStyledStream = sheet.interleaveWithNodeStream(
                renderViewToStream(jsx),
              );

              reactViewWithStyledStream.pipe(endpointStream, { end: false });
              reactViewWithStyledStream.on("error", onEndCallback);
              reactViewWithStyledStream.on("end", onEndCallback);
            } else {
              const reactViewStream: NodeJS.ReadableStream =
                renderViewToStaticStream(viewEl);

              reactViewStream.pipe(endpointStream, { end: false });
              reactViewStream.on("error", onEndCallback);
              reactViewStream.on("end", onEndCallback);
            }
          } catch (err) {
            console.log("Error in streamReactView:", (err as Error).message);
            reject(err);
          }
        });
      }
    ));
  };

export function makePlugin() {
  return makeFastifyPlugin(streamReactViewsPluginAsync, FASTIFY_VERSION_TARGET);
}
