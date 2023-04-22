import { getRandomId } from '@noahbaron91/utils';

import { EditorStore } from '../editor/store';
import { Node } from '../interfaces';

export function cloneNodeTree(idToClone: string, store: EditorStore) {
  const nodeTree = store.query.node(idToClone).toNodeTree();
  const newNodes = {};

  const changeNodeId = (node: Node, newParentId?: string) => {
    const newNodeId = getRandomId();

    const childNodes = node.data.nodes.map((childId) =>
      changeNodeId(nodeTree.nodes[childId], newNodeId)
    );

    const linkedNodes = Object.keys(node.data.linkedNodes).reduce(
      (accum, id) => {
        const newLinkedNodeId = changeNodeId(
          nodeTree.nodes[node.data.linkedNodes[id]],
          newNodeId
        );
        return {
          ...accum,
          [id]: newLinkedNodeId,
        };
      },
      {}
    );

    let tmpNode = {
      ...node,
      id: newNodeId,
      data: {
        ...node.data,
        parent: newParentId || node.data.parent,
        nodes: childNodes,
        linkedNodes,
      },
    };
    let freshnode = store.query.parseFreshNode(tmpNode).toNode();
    newNodes[newNodeId] = freshnode;
    return newNodeId;
  };

  const rootNodeId = changeNodeId(nodeTree.nodes[nodeTree.rootNodeId]);
  return {
    rootNodeId,
    nodes: newNodes,
  };
}
