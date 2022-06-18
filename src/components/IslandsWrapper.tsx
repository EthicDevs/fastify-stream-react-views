import React, { FC } from "react";

export const IslandsWrapper: FC<{ islandId: string }> = ({
  children,
  islandId,
}) => {
  const CommentEl = React.createElement(`!--island-${islandId}--`, null, null);
  return (
    <React.Fragment>
      {CommentEl}
      {children}
    </React.Fragment>
  );
};
