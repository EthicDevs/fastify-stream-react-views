import React from "react";
import ReactDOM from "react-dom";
import ReactIs from "react-is";
import styled from "styled-components";

// Re-export these so they are loaded in "right order" from importmap/es-modules-shim
export { React, ReactDOM, ReactIs, styled };

export { IslandsWrapper } from "../components/IslandsWrapper";
export { default as makeIsland } from "../core/makeIsland";
export { wrapIslandsWithComponent } from "../helpers/wrapIslandsWithComponent";

export { reviveIslands } from "./reviveIslands";
