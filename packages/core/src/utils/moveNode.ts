import { EditorStore } from '../editor';
import { Node, NodeId, NodeTree } from '../interfaces';

export function createCustomBreakpointTree(
  store: EditorStore,
  nodeTree: NodeTree,
  breakpoint: string
): NodeTree {
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
/**
 * Updates node position
 * @param store
 * @param selector
 * @param newParentId
 * @param index
 * @param cb
 */
export function moveNode(
  store: EditorStore,
  selector: string,
  newParentId: NodeId,
  index?: number,
  cb?: () => void
) {
  const currentBreakpoint = store.query.node(selector).breakpoint();
  const targetBreakpoint = store.query.node(newParentId).breakpoint();

  // Moving from root into a breakpoint
  if (!currentBreakpoint && targetBreakpoint) {
    store.actions.generateBreakpointNodes(selector, targetBreakpoint);

    const initialNodeTree = store.query.node(selector).toNodeTree();
    const breakpointNodes = store.query.node(newParentId).get().data
      .breakpointNodes;

    // Dont add node to the breakpoint we're moving into
    const filteredBreakpointNodes = Object.entries(breakpointNodes).filter(
      ([breakpointName]) => breakpointName !== targetBreakpoint
    );

    const breakpointTrees = filteredBreakpointNodes.map(
      ([breakpointName, breakpointParent]) => {
        const newNodeTree = createCustomBreakpointTree(
          store,
          initialNodeTree,
          breakpointName
        );
        // Add cloned node tree to the new parent
        return { newNodeTree, breakpointParent, index };
      }
    );

    store.actions.addMultipleNodeTrees(breakpointTrees);

    store.actions.move(selector, newParentId, index);
  }

  // Moving from a breakpoint into root
  if (currentBreakpoint && !targetBreakpoint) {
    store.actions.removeBreakpointNodes(selector);

    store.actions.move(selector, newParentId, index);
  }

  // Moving from breakpoint into a new breakpoint
  if (currentBreakpoint && targetBreakpoint) {
    const targetBreakointNodes = store.query.node(newParentId).get().data
      .breakpointNodes;
    const currentBreakpointNodes = store.query.node(selector).get().data
      .breakpointNodes;

    const moveElements = Object.entries(currentBreakpointNodes).map(
      ([breakpoint, selector]) => ({
        selector,
        newParentId: targetBreakointNodes[breakpoint],
        index: undefined,
      })
    );

    store.actions.moveMultiple(moveElements);
  }

  // Moving from non-breakpoint into non-breakpoint
  if (!currentBreakpoint && !targetBreakpoint) {
    store.actions.move(selector, newParentId, index);
  }

  cb && cb();
}
