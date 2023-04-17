import { ROOT_NODE } from '@noahbaron91/utils';
import React, { useEffect, useRef } from 'react';

import { useInternalEditor } from '../editor/useInternalEditor';
import { NodeProvider } from '../nodes/NodeContext';

export const RenderDraggedElement = () => {
  const {
    scale,
    draggedElement: { element: draggedElement, event: draggedEvent },
  } = useInternalEditor((state) => ({
    draggedElement: state.draggedElement,
    scale: state.options.viewport.scale,
  }));
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !draggedElement || !draggedEvent) return;

    draggedEvent.dataTransfer.setDragImage(
      ref.current,
      draggedEvent.clientX,
      draggedEvent.clientY
    );
  }, [draggedElement, draggedEvent, ref, scale]);

  if (!draggedElement) return <></>;

  const transform = `scale(${scale})`;

  const Style: React.CSSProperties = {
    transform,
    position: 'fixed',
    top: '-100%',
    left: '-100%',
  };

  // Need to create element for image preview on drag. Should be outside of the editor
  return (
    <div style={Style} id="designly--dragged" ref={ref}>
      <NodeProvider id={ROOT_NODE}>{draggedElement}</NodeProvider>;
    </div>
  );
};
