import { ROOT_NODE } from '@noahbaron91/utils';
import React, { useCallback } from 'react';

import { DefaultRender } from './DefaultRender';

import { useInternalEditor } from '../editor/useInternalEditor';
import { useInternalNode } from '../nodes/useInternalNode';

type RenderNodeToElementType = {
  render?: React.ReactElement;
  style?: React.CSSProperties;
};

export const RenderNodeToElement: any = ({ render }) => {
  const {
    hidden,
    position,
    dom,
    parent,
    store,
    id,
    isDragging,
  } = useInternalNode((node) => ({
    hidden: node.data.hidden,
    position: node.data.position['global'],
    dom: node.dom,
    parent: node.data.parent,
    isDragging: node.events.dragged,
  }));

  const { parentIsIndicator } = useInternalEditor((state, query) => ({
    parentIsIndicator: parent ? state.nodes[parent].data.isIndicator : false,
  }));

  const { onRender } = useInternalEditor((state) => ({
    onRender: state.options.onRender,
  }));

  const updatePositions = useCallback(() => {
    if (dom && position && parent) {
      const parent = store.query.node(id).ancestors(false)[0];
      const { top, left } = position;

      const styles = getComputedStyle(dom);
      if (!styles) return;

      const positionStyle = styles.getPropertyValue('position');
      const zIndex = styles.getPropertyValue('z-index');

      if (isDragging) {
        if (parent === ROOT_NODE && positionStyle !== 'fixed') {
          dom.style.position = 'fixed';
        }

        if (parent !== ROOT_NODE && positionStyle !== 'absolute') {
          dom.style.position = 'absolute';
        }

        if (zIndex !== '99999') {
          dom.style.zIndex = '99999';
        }
      }

      if (!parentIsIndicator) {
        if (parent !== ROOT_NODE && positionStyle !== 'absolute') {
          dom.style.position = 'absolute';
        }

        if (parent === ROOT_NODE && positionStyle !== 'fixed') {
          dom.style.position = 'fixed';
        }

        const transform = `translateX(${left}px) translateY(${top}px)`;
        dom.style.transform = transform;
      }
    }
  }, [dom, position, parent, store.query, id, isDragging, parentIsIndicator]);

  // don't display the node since it's hidden
  if (hidden) {
    return null;
  }

  updatePositions();

  return React.createElement(onRender, {
    render: render || <DefaultRender />,
  });
};
