import { useEffectOnce } from '@noahbaron91/utils';
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
  const { hidden, position, dom, parent, id, isDragging } = useInternalNode(
    (node) => ({
      hidden: node.data.hidden,
      position: node.data.position,
      dom: node.dom,
      parent: node.data.parent,
      isDragging: node.events.dragged,
    })
  );

  const {
    onRender,
    breakpoints,
    parentIsIndicator,
    actions: { addBreakpointNode },
    query: { node },
  } = useInternalEditor((state) => ({
    onRender: state.options.onRender,
    breakpoints: state.breakpoints,
    parentIsIndicator: parent ? state.nodes[parent].data.isIndicator : false,
  }));

  const { left, top } = position;

  // Update breakpoints
  useEffectOnce(() => {
    // Check if id is a root id
    // If it is, then update the breakpointNodes of other root nodes
    const isRootBreakpoint = Object.entries(breakpoints).find(
      ([_, breakpoint]) => breakpoint.nodeId === id
    );

    if (isRootBreakpoint) {
      Object.entries(breakpoints).forEach(([breakpointName, breakpoint]) => {
        addBreakpointNode(id, {
          name: breakpointName,
          breakpointId: breakpoint.nodeId,
        });
      });
    }
  });

  const isRootBreakpoint = Object.values(breakpoints).find(
    (breakpoint) => breakpoint.nodeId === id
  );

  const breakpoint = node(id).breakpoint();

  if (dom && !parentIsIndicator) {
    // Check if draggable (parent is a canvas)

    if (isDragging) {
      dom.style.zIndex = '100000';

      if (parent && node(parent) && node(parent).get().data.isCanvas) {
        dom.style.position = 'absolute';

        if (breakpoint && !isRootBreakpoint) {
          dom.style.top = `${top}px`;
          dom.style.left = `${left}%`;
        } else {
          dom.style.top = `${top}px`;
          dom.style.left = `${left}px`;
        }
      }
    } else {
      if (!breakpoint || isRootBreakpoint) {
        dom.style.position = 'absolute';
        dom.style.top = `${top}px`;
        dom.style.left = `${left}px`;
      } else {
        // dom.style.position = 'relative';

        // dom.style.top = '0';
        // dom.style.left = '0';

        dom.style.position = 'absolute';
        dom.style.top = `${top}px`;
        dom.style.left = `${left}%`;
      }

      dom.style.zIndex = 'auto';
    }

    // Fixes weird line artifacts when dragging
    dom.style.backfaceVisibility = 'hidden';
  }

  // don't display the node since it's hidden
  if (hidden) {
    return null;
  }

  return React.createElement(onRender, { render: render || <DefaultRender /> });
};
