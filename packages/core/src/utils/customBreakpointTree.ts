import { EditorStore } from '../editor';
import { Node, NodeTree } from '../interfaces';

export function customBreakpointTree(
  store: EditorStore,
  nodeTree: NodeTree,
  breakpoint: string
) {
  const newNodes = {};

  const changeNodeId = (node: Node, newParentId?: string) => {
    const newNodeId = node.data.breakpointNodes[breakpoint];

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
