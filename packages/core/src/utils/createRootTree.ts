import { getRandomId } from '@noahbaron91/utils';

import { EditorStore } from '../editor';
import { NodeTree, Node } from '../interfaces';

export function createRootTree(
  store: EditorStore,
  nodeTree: NodeTree,
  breakpointName: string
) {
  const iterateChildren = (node: Node) => {
    let breakpointNodes = {};
    // Create breakpoint nodes
    Object.keys(store.query.getState().breakpoints).forEach((name) => {
      if (breakpointName === name) {
        breakpointNodes = { ...breakpointNodes, [name]: nodeTree.rootNodeId };
        return;
      }

      breakpointNodes = { ...breakpointNodes, [name]: getRandomId() };
    });

    // state.nodes[id].data.breakpointNodes = breakpointNodes;
    node.data.breakpointNodes = breakpointNodes;

    if (node.data.nodes.length > 0) {
      node.data.nodes.forEach((childNodeId) =>
        iterateChildren(nodeTree.nodes[childNodeId])
      );
    }

    Object.values(node.data.linkedNodes).forEach((linkedNodeId) =>
      iterateChildren(nodeTree.nodes[linkedNodeId])
    );
  };

  iterateChildren(nodeTree.nodes[nodeTree.rootNodeId]);

  return nodeTree;
}
