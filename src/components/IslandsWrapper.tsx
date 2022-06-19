import React, { FC } from "react";

import { WrapperProps } from "../types";

export const IslandsWrapper: FC<WrapperProps> = ({
  childrenAsFn,
  islandId,
}) => {
  return (
    <React.Fragment>
      {childrenAsFn({
        "data-islandid": islandId,
      })}
    </React.Fragment>
  );
};
