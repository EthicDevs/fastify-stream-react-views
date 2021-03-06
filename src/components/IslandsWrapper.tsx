import React, { FC } from "react";

import type { WrapperProps } from "../types";

export const IslandsWrapper: FC<WrapperProps> = ({
  childrenAsFn,
  islandId,
}) => {
  return (
    <div key={islandId} data-islandid={islandId}>
      {childrenAsFn({
        "data-islandid": islandId,
      })}
    </div>
  );
};
