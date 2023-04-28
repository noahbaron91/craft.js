import {
  ERROR_TOP_LEVEL_ELEMENT_NO_ID,
  useEffectOnce,
} from '@noahbaron91/utils';
import React, { useEffect, useState } from 'react';
import invariant from 'tiny-invariant';

import { NodeElement } from './NodeElement';
import { useInternalNode } from './useInternalNode';

import { useInternalEditor } from '../editor/useInternalEditor';
import { NodeId, Position } from '../interfaces';

export const defaultElementProps = {
  is: 'div',
  canvas: false,
  indicator: false,
  custom: {},
  hidden: false,
  position: { top: 0, left: 0 },
};

export const elementPropToNodeData = {
  is: 'type',
  canvas: 'isCanvas',
  indicator: 'isIndicator',
  position: 'position',
};

export type Element<T extends React.ElementType> = {
  id?: NodeId;
  is?: T;
  custom?: Record<string, any>;
  children?: React.ReactNode;
  canvas?: boolean;
  indicator?: boolean;
  position?: Position;
} & React.ComponentProps<T>;

export function Element<T extends React.ElementType>({
  id,
  children,
  ...elementProps
}: Element<T>) {
  const { is } = {
    ...defaultElementProps,
    ...elementProps,
  };

  const { query, actions } = useInternalEditor();
  const { node, inNodeContext } = useInternalNode((node) => ({
    node: {
      id: node.id,
      data: node.data,
    },
  }));

  const [linkedNodeId, setLinkedNodeId] = useState<NodeId | null>(null);

  useEffectOnce(() => {
    invariant(!!id, ERROR_TOP_LEVEL_ELEMENT_NO_ID);
    const { id: nodeId, data } = node;

    if (inNodeContext) {
      let linkedNodeId;

      const existingNode =
        data.linkedNodes &&
        data.linkedNodes[id] &&
        query.node(data.linkedNodes[id]).get();

      // Render existing linked Node if it already exists (and is the same type as the JSX)
      if (existingNode && existingNode.data.type === is) {
        linkedNodeId = existingNode.id;
      } else {
        // otherwise, create and render a new linked Node
        const linkedElement = React.createElement(
          Element,
          elementProps,
          children
        );

        const tree = query.parseReactElement(linkedElement).toNodeTree();

        linkedNodeId = tree.rootNodeId;
        actions.history.ignore().addLinkedNodeFromTree(tree, nodeId, id);
      }

      setLinkedNodeId(linkedNodeId);
    }
  });

  // Add breakpoint nodes from linked nodes
  useEffect(() => {
    const linkedNodes = node.data.linkedNodes;
    const breakpointNodes = node.data.breakpointNodes;

    if (!breakpointNodes) return;

    Object.entries(linkedNodes).forEach(([linkedId, nodeId]) => {
      Object.entries(breakpointNodes).forEach(
        ([breakpoint, breakpointNodeId]) => {
          const newLinedNodes = query.node(breakpointNodeId).get().data
            .linkedNodes;

          const newNodeId = newLinedNodes[linkedId];

          actions.addBreakpointNode(nodeId, {
            breakpointId: newNodeId,
            name: breakpoint,
          });
        }
      );
    });
  }, [
    actions,
    node.data.breakpointNodes,
    node.data.linkedNodes,
    node.data.parent,
    query,
  ]);

  return linkedNodeId ? <NodeElement id={linkedNodeId} /> : null;
}
