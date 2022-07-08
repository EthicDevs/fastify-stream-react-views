// 3rd-party
import React from "react";
// lib
import type { ReactView } from "../types";

export type DefaultNotFoundErrorViewProps = {};

const DefaultNotFoundErrorView: ReactView<DefaultNotFoundErrorViewProps> = () => {
  return (
    <div>
      <h1>🕵️‍♂️ Mh. That's strange, this page has disapeared...</h1>
      <p>Sorry but this page cannot be found (error 404)</p>
      {process.env.NODE_ENV === "development" && (
        <details>
          <summary>Find out more about this error:</summary>
          <p>
            This error happens when a view has been requested but it has not
            been found in your config's specified `viewFolder`.
          </p>
          <p>
            Check that the file you are trying to render `reply.streamReactView()`
            actually exists on disk and that it correctly export default a React
            component of type `ReactIsland` and it is named the same as the file.
          </p>
          <p>
            If that still does not work, check the `app.manifest.json` file to
            see if the view was detected, if not, please open a bug on our repo.
          </p>
        </details>
      )}
      <a
        href="/"
        title={"Back to home"}
        role={"button"}
      >
        Back to Home
      </a>
    </div>
  );
};

export default DefaultNotFoundErrorView;
