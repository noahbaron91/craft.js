import React from 'react';

import { DefaultRender } from './DefaultRender';

import { useInternalEditor } from '../editor/useInternalEditor';
import { useInternalNode } from '../nodes/useInternalNode';

type RenderNodeToElementType = {
  render?: React.ReactElement;
};
export const RenderNodeToElement: React.FC<React.PropsWithChildren<
  RenderNodeToElementType
>> = ({ render }) => {
  const { hidden, position } = useInternalNode((node) => ({
    hidden: node.data.hidden,
    position: node.data.position,
  }));

  const { onRender } = useInternalEditor((state) => ({
    onRender: state.options.onRender,
  }));

  const { left, top } = position;

  const styles: React.CSSProperties = {
    position: 'fixed',
    left,
    top,
  };

  // don't display the node since it's hidden
  if (hidden) {
    return null;
  }

  return (
    <div style={styles}>
      {React.createElement(onRender, { render: render || <DefaultRender /> })}
    </div>
  );
};
