# `@ethicdevs/fastify-stream-react-views`

![Built-in TypeScript definitions](https://i.ibb.co/N1rVwjY/255a118f56f5346b97e56325a1217a16-1.png)
[![NPM](https://img.shields.io/npm/v/@ethicdevs/fastify-stream-react-views?color=red)](https://www.npmjs.com/package/@ethicdevs/fastify-stream-react-views)
[![MIT License](https://img.shields.io/github/license/ethicdevs/fastify-stream-react-views.svg?color=blue)](https://github.com/ethicdevs/fastify-stream-react-views/blob/master/LICENSE)

What started as a fastify reply decorator to renderToMarkupStream a React
component as a view/template (plain-old fashioned SSR/monolith/PHP way, without
CSR/hydration) is becoming a full-featured framework to build SSR/Islands
based applications without the usual pain! 🚀

---

## Looking for an SSR+Island ready solution?

Discover [the React Monolith framework](https://github.com/EthicDevs/react-monolith)
which is a framework we built on-top of this library so you don't have to! ⚡️

Sample usage for getting started quickly can be found in the
[the React Monolith samples repository](https://github.com/EthicDevs/react-monolith-samples)

---

## Installation

```shell
$ yarn add @ethicdevs/fastify-stream-react-views
# or
$ npm i @ethicdevs/fastify-stream-react-views
```

## Usage

First create a `server.ts` file that will act as the application entry point.

```ts
// src/server.ts
import { join, resolve} from "path";
import fastify from "fastify";
import streamReactViews from "@ethicdevs/fastify-stream-react-views";

function main() {
  const app = fastify();

  // ... more fastify server setup ...

  app.register(streamReactViews, {
    appName: "YourAppName", // optional
    titleSeparatorChar: "∙", // optional
    commonProps: { // optional
      foo: 'bar',
      baz: 1,
    }
    islandsFolder: resolve(join(__dirname, 'islands'), // optional
    viewsFolder: resolve(join(__dirname, 'views'), // required
    viewContext: { // optional
      html: {
        dir: "ltr",
      },
      head: [
        { kind: "meta", charset: "utf-8" },
        {
          kind: "meta",
          name: "viewport",
          content: "width=device-width, initial-scale=1",
        },
        {
          kind: "link",
          rel: "icon",
          type: "image/x-icon",
          href: "/public/favicon.ico",
        },
      ],
    },
    withStyledSSR: true, // optional, set to true for styled-component usage
  });

  app.get('/', (_, reply) => {
    return reply.streamReactView('home', {
      title: "This will set the page title in tab bar!",
      hello: 'world',
      punctuation: '!'
    });
  });

  app.listen(...); // as usual
}

main();
```

Add an `HomeView` to test things works like this:

```tsx
// src/views/HomeView.tsx
import type { ReactView } from "@ethicdevs/fastify-stream-react-views";
import React, { VFC } from "react";

import Counter from "../islands/Counter";

type HomeViewProps = {
  hello: string;
  punctuation?: "." | "!" | "?";
};

const HomeView: ReactView = ({ hello, punctuation }) => {
  return (
    <>
      <h1>{`Hello, ${hello}${punctuation || "!"}`}</h1>
      <Counter defaultValue={42} />
    </>
  );
};

export default HomeView;
```

Then the `Counter` Island so this component becomes interactive when page has
loaded on the client-side (i.e. browser):

```tsx
// src/islands/Counter.tsx
import type { ReactIsland } from "@ethicdevs/fastify-stream-react-views";
import React, { useState } from "react";

type CounterProps = {
  defaultValue?: number;
};

const Counter: ReactIsland<CounterProps> = ({ defaultValue = 0 }) => {
  const [counter, setCounter] = useState(defaultValue);
  const incrementCounter = () => setCounter((prev) => prev + 1);
  const decrementCounter = () => setCounter((prev) => prev - 1);
  return (
    <div>
      <strong aria-description={"Counter value"}>{`${counter}`}</strong>
      <button onClick={decrementCounter} title={"Decrement counter"}>
        -
      </button>
      <button onClick={incrementCounter} title={"Increment counter"}>
        +
      </button>
    </div>
  );
};

export default Counter;
```

Then navigate to the ip:port you listen to, and see the magic by inspecting both
at the page source code level, as well as devtools/page inspector. Look how the
generated HTML is neat and contains everything needed for the client to start
being interactive in no-time (~6ms to be interactive in this example). Enjoy ;)

## License

[MIT](https://github.com/ethicdevs/fastify-stream-react-views/blob/master/LICENSE)
