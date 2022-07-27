import React from "react";
import ReactDOM from "react-dom";
import ReactIs from "react-is";
import styled from "styled-components";

import { IslandsWrapper } from "../components/IslandsWrapper";
import { default as makeIsland } from "../core/makeIsland";
import { wrapIslandsWithComponent } from "../helpers/wrapIslandsWithComponent";
import { reviveIslands } from "./reviveIslands";

const IslandsRuntime = {
  IslandsWrapper,
  makeIsland,
  reviveIslands,
  wrapIslandsWithComponent,
};

// Re-export these so they are loaded in "right order" from importmap/es-modules-shim
export { React, ReactDOM, ReactIs, styled, IslandsRuntime };

