import { cloneDeep } from 'lodash';

import { createCustomBreakpointTree } from './createCustomBreakpointsTree';

import { EditorStore } from '../editor';
import { NodeId } from '../interfaces';
import { calculateTransform } from '../utils/calculateTransform';

/**
 * Updates node position
 * @param store
 * @param selector
 * @param newParentId
 * @param index
 * @param cb
 */
export function moveNode(
  event: MouseEvent,
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

    const currentWidth = store.query.node(selector).get().dom.clientWidth;

    const breakpointTrees = filteredBreakpointNodes.map(
      ([breakpointName, breakpointParent]) => {
        const newNodeTree = createCustomBreakpointTree(
          store,
          initialNodeTree,
          breakpointName
        );

        // Clone to remove read only properties
        const nodeTreeClone = cloneDeep(newNodeTree);

        const newNodeTreeId = nodeTreeClone.rootNodeId;
        const targetBreakpointWidth = store.query.getState().breakpoints[
          targetBreakpoint
        ].width;

        // Convert from px to vw
        const newWidth = currentWidth / targetBreakpointWidth;

        nodeTreeClone.nodes[
          newNodeTreeId
        ].data.props.desktop.element.width.value = newWidth;
        nodeTreeClone.nodes[
          newNodeTreeId
        ].data.props.desktop.element.width.type = 'vw';

        nodeTreeClone.nodes[
          newNodeTreeId
        ].data.props.tablet.element.width.value = null;
        nodeTreeClone.nodes[
          newNodeTreeId
        ].data.props.tablet.element.width.type = null;

        nodeTreeClone.nodes[
          newNodeTreeId
        ].data.props.mobile.element.width.value = null;
        nodeTreeClone.nodes[
          newNodeTreeId
        ].data.props.mobile.element.width.type = null;

        // Add cloned node tree to the new parent
        return { newNodeTree: nodeTreeClone, breakpointParent, index };
      }
    );

    store.actions.history.merge().addMultipleNodeTrees(breakpointTrees);
    store.actions.history.merge().move(selector, newParentId, index);
  }

  const isMovingIntoDifferentBreakpoint =
    currentBreakpoint &&
    targetBreakpoint &&
    currentBreakpoint !== targetBreakpoint;

  // Moving from a breakpoint into root
  if (currentBreakpoint && !targetBreakpoint) {
    store.actions.history.merge().removeBreakpointNodes(selector);

    // Update width from vw to px
    const widthValue = store.query.node(selector).get().dom.clientWidth;

    store.actions.history.merge().setProp(selector, (props) => {
      const desktopExists =
        'desktop' in props &&
        'element' in props.desktop &&
        'width' in props.desktop.element &&
        'value' in props.desktop.element.width &&
        'type' in props.desktop.element.width;

      if (desktopExists) {
        props.desktop.element.width.value = widthValue;
        props.desktop.element.width.type = 'px';
      }

      const tabletExists =
        'tablet' in props &&
        'element' in props.desktop &&
        'width' in props.desktop.element &&
        'value' in props.desktop.element.width &&
        'type' in props.desktop.element.width;

      if (tabletExists) {
        props.tablet.element.width.value = null;
        props.tablet.element.width.type = null;
      }

      const mobileExists =
        'tablet' in props &&
        'element' in props.desktop &&
        'width' in props.desktop.element &&
        'value' in props.desktop.element.width &&
        'type' in props.desktop.element.width;

      if (mobileExists) {
        props.mobile.element.width.value = null;
        props.mobile.element.width.type = null;
      }
    });

    // Set position to new cursor position
    calculateTransform(
      store,
      selector,
      event,
      ({ left, top }) => {
        store.actions.history
          .merge()
          .move(selector, newParentId, undefined, { top, left });
      },
      {
        customParent: newParentId,
      }
    );
  }

  // Moving from breakpoint into a existing breakpoint
  if (currentBreakpoint && targetBreakpoint) {
    const targetBreakointNodes = store.query.node(newParentId).get().data
      .breakpointNodes;
    const currentBreakpointNodes = store.query.node(selector).get().data
      .breakpointNodes;

    // If not moving into same breakpoint then select the existing linked node of that breakpoint
    if (isMovingIntoDifferentBreakpoint) {
      const newSelectedId = currentBreakpointNodes[targetBreakpoint];
      store.actions.selectNode(newSelectedId);
      return;
    }

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
