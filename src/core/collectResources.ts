// lib
import type {
  StreamReactViewPluginOptions,
  ReactIsland,
  ReactView,
} from "../types";

import { DefaultAppComponent } from "../components/DefaultAppComponent";
import { IslandsWrapper } from "../components/IslandsWrapper";
import {
  walkFolderForFiles,
  wrapIslandsWithComponent,
  wrapViewsWithApp,
} from "../helpers";

export default async function collectResources(
  options: StreamReactViewPluginOptions,
) {
  const AppComponent =
    options != null && options.appComponent != null
      ? options.appComponent
      : DefaultAppComponent;

  let islandsById: { [islandId: string]: [string, ReactIsland] } = {};
  let viewsById: { [viewId: string]: [string, ReactView] } = {};

  if (options != null && options.islandsFolder != null) {
    const islands = await walkFolderForFiles<ReactIsland>(
      options.islandsFolder,
    );
    if (islands) {
      islandsById = islands;
    }
  }

  if (options != null && options.viewsFolder != null) {
    const views = await walkFolderForFiles<ReactView>(options.viewsFolder);
    if (views != null) {
      viewsById = views;
    }
  }

  return {
    islandsById: wrapIslandsWithComponent(islandsById, IslandsWrapper),
    viewsById: wrapViewsWithApp(viewsById, AppComponent),
  };
}
