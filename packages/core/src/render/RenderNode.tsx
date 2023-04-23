import { ROOT_NODE, useEffectOnce } from '@noahbaron91/utils';
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
  } = useInternalEditor((state) => ({
    onRender: state.options.onRender,
    breakpoints: state.breakpoints,
    parentIsIndicator: parent ? state.nodes[parent].data.isIndicator : false,
  }));

  const { left, top } = position;

  // Update breakpoints
  useEffectOnce(() => {
    // Check if id is a root id
    // If so, then update the breakpointNodes of other root nodes
    const isRootBreakpoint = Object.entries(breakpoints).find(
      ([_, breakpoint]) => breakpoint.nodeId === id
    );

    if (isRootBreakpoint) {
      Object.entries(breakpoints).forEach(([breakpointName, breakpoint]) => {
        if (breakpoint.nodeId === id) return;

        addBreakpointNode(id, {
          name: breakpointName,
          breakpointId: breakpoint.nodeId,
        });
      });
    }
  });

  // const updatePositions = () => {
  //   if (dom && position && parent) {
  //     const parent = store.query.node(id).ancestors(false)[0];
  //     const { top, left } = position;

  //     const styles = getComputedStyle(dom);
  //     if (!styles) return;

  //     const positionStyle = styles.getPropertyValue('position');
  //     const zIndex = styles.getPropertyValue('z-index');

  //     if (isDragging) {
  //       if (parent === ROOT_NODE && positionStyle !== 'fixed') {
  //         dom.style.position = 'fixed';
  //       }

  //       if (parent !== ROOT_NODE && positionStyle !== 'absolute') {
  //         dom.style.position = 'absolute';
  //       }

  //       if (zIndex !== '99999') {
  //         dom.style.zIndex = '99999';
  //       }
  //     }

  //     if (!parentIsIndicator) {
  //       if (parent !== ROOT_NODE && positionStyle !== 'absolute') {
  //         dom.style.position = 'absolute';
  //       }

  //       if (parent === ROOT_NODE && positionStyle !== 'fixed') {
  //         dom.style.position = 'fixed';
  //       }

  //       const transform = `translateX(${left}px) translateY(${top}px)`;
  //       dom.style.transform = transform;
  //     }
  //   }
  // };

  if (dom && !parentIsIndicator) {
    if (parent === ROOT_NODE) {
      dom.style.position = 'fixed';
    } else {
      dom.style.position = 'absolute';
    }

    if (isDragging) {
      dom.style.zIndex = '100000';
    } else {
      dom.style.zIndex = 'auto';
    }

    const transform = `translateX(${left}px) translateY(${top}px)`;
    dom.style.transform = transform;
  }

  // don't display the node since it's hidden
  if (hidden) {
    return null;
  }

  return React.createElement(onRender, { render: render || <DefaultRender /> });
};
