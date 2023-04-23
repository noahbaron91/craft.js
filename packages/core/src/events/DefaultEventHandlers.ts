import { ROOT_NODE, isChromium, isLinux } from '@noahbaron91/utils';
import { isFunction } from 'lodash';
import React from 'react';

import { CoreEventHandlers, CreateHandlerOptions } from './CoreEventHandlers';
import { Positioner } from './Positioner';
import { createShadow } from './createShadow';

import {
  Indicator,
  NodeId,
  DragTarget,
  NodeTree,
  Position,
} from '../interfaces';
import { cloneNodeTree } from '../utils/cloneNodeTree';

export type DefaultEventHandlersOptions = {
  isMultiSelectEnabled: (e: MouseEvent) => boolean;
};

/**
 * Specifies Editor-wide event handlers and connectors
 */
export class DefaultEventHandlers<O = {}> extends CoreEventHandlers<
  DefaultEventHandlersOptions & O
> {
  /**
   * Note: Multiple drag shadows (ie: via multiselect in v0.2 and higher) do not look good on Linux Chromium due to way it renders drag shadows in general,
   * so will have to fallback to the single shadow approach above for the time being
   * see: https://bugs.chromium.org/p/chromium/issues/detail?id=550999
   */
  static forceSingleDragShadow = isChromium() && isLinux();

  draggedElementShadow: HTMLElement;
  dragTarget: DragTarget;
  positioner: Positioner | null = null;
  currentSelectedElementIds = [];

  onDisable() {
    this.options.store.actions.clearEvents();
  }

  handlers() {
    const store = this.options.store;

    return {
      connect: (el: HTMLElement, id: NodeId) => {
        store.actions.setDOM(id, el);

        return this.reflect((connectors) => {
          connectors.select(el, id);
          connectors.hover(el, id);
          connectors.drop(el, id);
        });
      },
      select: (el: HTMLElement, id: NodeId) => {
        const unbindOnMouseDown = this.addCraftEventListener(
          el,
          'mousedown',
          (e) => {
            e.craft.stopPropagation();

            let newSelectedElementIds = [];

            if (id) {
              const { query } = store;
              const selectedElementIds = query.getEvent('selected').all();
              const isMultiSelect = this.options.isMultiSelectEnabled(e);

              /**
               * Retain the previously select elements if the multi-select condition is enabled
               * or if the currentNode is already selected
               *
               * so users can just click to drag the selected elements around without holding the multi-select key
               */

              if (isMultiSelect || selectedElementIds.includes(id)) {
                newSelectedElementIds = selectedElementIds.filter(
                  (selectedId) => {
                    const descendants = query
                      .node(selectedId)
                      .descendants(true);
                    const ancestors = query.node(selectedId).ancestors(true);

                    // Deselect ancestors/descendants
                    if (descendants.includes(id) || ancestors.includes(id)) {
                      return false;
                    }

                    return true;
                  }
                );
              }

              if (!newSelectedElementIds.includes(id)) {
                newSelectedElementIds.push(id);
              }
            }

            store.actions.setNodeEvent('selected', newSelectedElementIds);
          }
        );

        const unbindOnClick = this.addCraftEventListener(el, 'click', (e) => {
          e.craft.stopPropagation();

          const { query } = store;
          const selectedElementIds = query.getEvent('selected').all();

          const isMultiSelect = this.options.isMultiSelectEnabled(e);
          const isNodeAlreadySelected = this.currentSelectedElementIds.includes(
            id
          );

          let newSelectedElementIds = [...selectedElementIds];

          if (isMultiSelect && isNodeAlreadySelected) {
            newSelectedElementIds.splice(newSelectedElementIds.indexOf(id), 1);
            store.actions.setNodeEvent('selected', newSelectedElementIds);
          } else if (!isMultiSelect && selectedElementIds.length > 1) {
            newSelectedElementIds = [id];
            store.actions.setNodeEvent('selected', newSelectedElementIds);
          }

          this.currentSelectedElementIds = newSelectedElementIds;
        });

        return () => {
          unbindOnMouseDown();
          unbindOnClick();
        };
      },
      hover: (el: HTMLElement, id: NodeId) => {
        const unbindMouseover = this.addCraftEventListener(
          el,
          'mouseover',
          (e) => {
            e.craft.stopPropagation();
            store.actions.setNodeEvent('hovered', id);
          }
        );

        return () => {
          unbindMouseover();
        };
      },
      drop: (el: HTMLElement, targetId: NodeId) => {
        const unbindDragOver = this.addCraftEventListener(
          el,
          'dragover',
          (e) => {
            e.craft.stopPropagation();
            e.preventDefault();

            if (!this.positioner) {
              return;
            }

            const indicator = this.positioner.computeIndicator(
              targetId,
              e.clientX,
              e.clientY
            );

            if (!indicator) {
              return;
            }

            store.actions.setIndicator(indicator);
          }
        );

        const unbindDragEnter = this.addCraftEventListener(
          el,
          'dragenter',
          (e) => {
            e.craft.stopPropagation();
            e.preventDefault();
          }
        );

        return () => {
          unbindDragEnter();
          unbindDragOver();
        };
      },
      drag: (el: HTMLElement, id: NodeId) => {
        if (!store.query.node(id).isDraggable()) {
          return () => {};
        }

        // el.setAttribute('draggable', 'false');
        // el.setAttribute('draggable', 'true');

        // const unbindDragStart = this.addCraftEventListener(
        //   el,
        //   'dragstart',
        //   (e) => {
        //     e.craft.stopPropagation();

        //     const { query, actions } = store;

        //     let selectedElementIds = query.getEvent('selected').all();

        //     const isMultiSelect = this.options.isMultiSelectEnabled(e);
        //     const isNodeAlreadySelected = this.currentSelectedElementIds.includes(
        //       id
        //     );

        //     if (!isNodeAlreadySelected) {
        //       if (isMultiSelect) {
        //         selectedElementIds = [...selectedElementIds, id];
        //       } else {
        //         selectedElementIds = [id];
        //       }
        //       store.actions.setNodeEvent('selected', selectedElementIds);
        //     }

        //     actions.setNodeEvent('dragged', selectedElementIds);

        //     const selectedDOMs = selectedElementIds.map(
        //       (id) => query.node(id).get().dom
        //     );

        //     this.draggedElementShadow = createShadow(
        //       e,
        //       selectedDOMs,
        //       DefaultEventHandlers.forceSingleDragShadow
        //     );

        //     this.dragTarget = {
        //       type: 'existing',
        //       nodes: selectedElementIds,
        //     };

        //     this.positioner = new Positioner(
        //       this.options.store,
        //       this.dragTarget
        //     );
        //   }
        // );

        // const unbindDragEnd = this.addCraftEventListener(el, 'dragend', (e) => {
        //   e.craft.stopPropagation();

        //   this.dropElement((dragTarget, indicator) => {
        //     if (dragTarget.type === 'new') {
        //       return;
        //     }

        //     const index =
        //       indicator.placement.index +
        //       (indicator.placement.where === 'after' ? 1 : 0);

        //     store.actions.move(
        //       dragTarget.nodes,
        //       indicator.placement.parent.id,
        //       index
        //     );
        //   });
        // });
        let initialXPosition = null;
        let initialYPosition = null;

        const calculateTransform = (
          event: MouseEvent,
          cb: (translateX: number, translateY) => void,
          customParent?: NodeId
        ) => {
          event.preventDefault();

          const parent =
            customParent || store.query.node(id).ancestors(false)[0];

          const parentElement = store.query.node(parent).get().dom;

          const { scale } = store.query.getState().options.viewport;
          const { x, y } = parentElement.getBoundingClientRect();
          const { left, top } = el.getBoundingClientRect();

          if (!initialXPosition || !initialYPosition) {
            initialXPosition = event.clientX - left;
            initialYPosition = event.clientY - top;
          }

          // Gets position relative to parent
          const translateX =
            -x / scale + event.clientX / scale - initialXPosition / scale;
          const translateY =
            -y / scale + event.clientY / scale - initialYPosition / scale;

          cb(translateX, translateY);
        };

        const getOverlappedNodeId = (event: MouseEvent) => {
          const nodes = store.query.getNodes();
          const parent = store.query.node(id).get().data.parent;

          const { width, height } = el.getBoundingClientRect();
          const { scale } = store.query.getState().options.viewport;

          const elementWidth = width * scale;
          const elementHeight = height * scale;

          const overlappedElements = Object.keys(nodes).filter((nodeId) => {
            if (nodeId === id) return false;
            if (!store.query.node(nodeId).isCanvas()) return false;

            const node = nodes[nodeId];
            const el = node.dom;

            const { x, y, width, height } = el.getBoundingClientRect();

            const isXAxisOverlapped =
              event.clientX < x + width - elementWidth / 2 &&
              event.clientX > x - elementWidth / 2;

            const isYAxisOverlapped =
              event.clientY > y - elementHeight / 2 &&
              event.clientY < y + height - elementHeight / 2;

            const isOverlapped = isXAxisOverlapped && isYAxisOverlapped;

            return isOverlapped;
          });

          const topLevelOverlappedElement = overlappedElements.find(
            (elementId) => {
              if (!elementId || elementId === id) return false;

              const canMoveIn =
                overlappedElements &&
                topLevelOverlappedElement &&
                parent !== topLevelOverlappedElement;

              if (canMoveIn) {
                store.actions.move(id, topLevelOverlappedElement, 0);
              }

              const parents = store.query.node(elementId).descendants(true);
              return parents.every((id) => !overlappedElements.includes(id));
            }
          );

          return topLevelOverlappedElement;
        };

        const handleDragElement = (event: MouseEvent) => {
          const checkIfDraggedIntoCanvas = () => {
            // If a root breakpoint don't drag into anything
            const isBreakpoint = Object.entries(
              store.query.getState().breakpoints
            ).some(([key, { nodeId }]) => nodeId === id);

            if (isBreakpoint) return;
            const topLevelOverlappedElement = getOverlappedNodeId(event);

            const canMoveIn = !!topLevelOverlappedElement;

            if (canMoveIn) {
              // Not located inside a breakpoint
              if (!store.query.node(topLevelOverlappedElement).breakpoint()) {
                store.actions.move(id, topLevelOverlappedElement, 0);
                return;
              }

              // Check if breakpoint nodes exists and just move them up a level or else add
              const elementBreakpointNodes = store.query.getState().nodes[id]
                .data.breakpointNodes;

              if (Object.keys(elementBreakpointNodes).length > 0) {
                const overlappedElementBreakpointNodes = store.query.getState()
                  .nodes[topLevelOverlappedElement].data.breakpointNodes;

                calculateTransform(
                  event,
                  (left, top) => {
                    Object.entries(elementBreakpointNodes).forEach(
                      ([breakpointName, nodeId]) => {
                        store.actions.move(
                          nodeId,
                          overlappedElementBreakpointNodes[breakpointName],
                          0
                        );

                        store.actions.setPosition(nodeId, { left, top });
                      }
                    );
                  },
                  topLevelOverlappedElement
                );
              } else {
                calculateTransform(
                  event,
                  (left, top) => {
                    const breakpointNodes = store.query.getState().nodes[
                      topLevelOverlappedElement
                    ].data.breakpointNodes;

                    const newBreakpointNodes = [id];

                    Object.entries(breakpointNodes).forEach(([_, nodeId]) => {
                      const clonedTree = cloneNodeTree(id, store);
                      store.actions.addNodeTree(clonedTree, nodeId, 0, {
                        left,
                        top,
                      });

                      newBreakpointNodes.push(clonedTree.rootNodeId);
                    });

                    // Update linked breakpoint nodes
                    newBreakpointNodes.forEach((nodeId) => {
                      newBreakpointNodes.forEach((breakpointId) => {
                        if (nodeId === breakpointId) return;
                        const breakpointName = store.query
                          .node(breakpointId)
                          .breakpoint();

                        store.actions.addBreakpointNode(nodeId, {
                          name: breakpointName,
                          breakpointId: breakpointId,
                        });
                      });
                    });

                    // Set before moving to avoid false detection when checking if dragged outside of parent
                    store.actions.setPosition(id, { left, top });
                  },
                  topLevelOverlappedElement
                );
              }

              store.actions.move(id, topLevelOverlappedElement, 0);
            }
          };

          const checkIfDraggedOutsideOfParent = () => {
            const parent = store.query.node(id).get().data.parent;
            const parentElement = store.query.node(parent).get().dom;

            const element = store.query.node(id).get().dom;
            const elementBoundingBox = element.getBoundingClientRect();
            const parentBoundingBox = parentElement.getBoundingClientRect();

            const isRightOfParent =
              elementBoundingBox.x >
              parentBoundingBox.left + parentBoundingBox.width;

            const isLeftOfParent =
              elementBoundingBox.x + elementBoundingBox.width <
              parentBoundingBox.x;

            const isAboveParent =
              elementBoundingBox.y + elementBoundingBox.height <
              parentBoundingBox.y;

            const isBelowParent =
              elementBoundingBox.y >
              parentBoundingBox.top + parentBoundingBox.height;

            if (parent !== ROOT_NODE) {
              if (
                isRightOfParent ||
                isBelowParent ||
                isLeftOfParent ||
                isAboveParent
              ) {
                const overlappedNodeId = getOverlappedNodeId(event) || 'ROOT';

                const parentParentHasBreakpoint = !!store.query
                  .node(overlappedNodeId)
                  .breakpoint();

                const breakpointNodes = store.query.node(id).get().data
                  .breakpointNodes;

                if (parentParentHasBreakpoint) {
                  Object.entries(breakpointNodes).forEach(([_, nodeId]) => {
                    store.actions.move(nodeId, overlappedNodeId, 0);
                  });
                } else {
                  store.actions.move(id, overlappedNodeId, 0);

                  // Delete linked nodes
                  Object.entries(breakpointNodes).forEach(([_, nodeId]) => {
                    store.actions.removeBreakpointNode(nodeId);
                  });
                }
              }
            }
          };

          calculateTransform(event, (left, top) => {
            const newPositon = {
              top,
              left,
            };

            store.actions.setPosition(id, newPositon);
          });

          checkIfDraggedOutsideOfParent();
          checkIfDraggedIntoCanvas();
        };

        el.addEventListener('mousedown', (event) => {
          // Only drag on left click
          if (event.button !== 0) {
            event.preventDefault();
            return;
          }

          event.stopPropagation();

          window.addEventListener('mousemove', handleDragElement);
          window.addEventListener('mouseup', handleDragEnd);
        });

        const handleDragEnd = () => {
          // Reset drag postition
          initialXPosition = null;
          initialYPosition = null;

          window.removeEventListener('mousemove', handleDragElement);
          window.removeEventListener('mouseup', handleDragEnd);
        };

        return () => {
          // el.setAttribute('draggable', 'false');
          // unbindDragStart();
          // unbindDragEnd();
        };
      },
      create: (
        el: HTMLElement,
        userElement: React.ReactElement | (() => NodeTree | React.ReactElement),
        options?: Partial<CreateHandlerOptions>
      ) => {
        el.setAttribute('draggable', 'true');

        const unbindDragStart = this.addCraftEventListener(
          el,
          'dragstart',
          (e) => {
            e.craft.stopPropagation();
            let tree;
            if (typeof userElement === 'function') {
              const result = userElement();
              if (React.isValidElement(result)) {
                tree = store.query.parseReactElement(result).toNodeTree();
              } else {
                tree = result;
              }
            } else {
              tree = store.query.parseReactElement(userElement).toNodeTree();
            }

            const dom = e.currentTarget as HTMLElement;
            this.draggedElementShadow = createShadow(
              e,
              [dom],
              DefaultEventHandlers.forceSingleDragShadow
            );
            this.dragTarget = {
              type: 'new',
              tree,
            };

            // this.positioner = new Positioner(
            //   this.options.store,
            //   this.dragTarget
            // );
          }
        );

        const unbindDrag = this.addCraftEventListener(el, 'drag', (event) => {
          if (!el.getAttribute('draggable')) return;

          // const createIndicator = (containerId: string, event: MouseEvent) => {
          //   this.positioner = new Positioner(
          //     this.options.store,
          //     this.dragTarget
          //   );

          //   if (!this.positioner) {
          //     return;
          //   }

          //   const indicator = this.positioner.computeIndicator(
          //     containerId,
          //     event.clientX,
          //     event.clientY
          //   );

          //   if (!indicator) {
          //     return;
          //   }

          //   store.actions.setIndicator(indicator);
          // };

          // const moveElementIntoOverlappedCanvas = () => {
          //   const nodes = store.query.getNodes();

          //   const overlappedElements = Object.keys(nodes).filter((nodeId) => {
          //     if (!nodeId || nodeId === ROOT_NODE) return false;
          //     if (!store.query.node(nodeId).isCanvas()) return false;

          //     const node = nodes[nodeId];
          //     const el = node.dom;
          //     const { x, y, width, height } = el.getBoundingClientRect();

          //     return (
          //       event.clientX > x &&
          //       event.clientX < x + width &&
          //       event.clientY > y &&
          //       event.clientY < y + height
          //     );
          //   });

          //   // Filter overlapped elements to get the top level element
          //   const topLevelOverlappedElement = overlappedElements.find(
          //     (elementId) => {
          //       if (!elementId) return false;

          //       const parents = store.query.node(elementId).descendants(true);
          //       return parents.every((id) => !overlappedElements.includes(id));
          //     }
          //   );

          //   if (topLevelOverlappedElement) {
          //     const isIndicator = store.query
          //       .node(topLevelOverlappedElement)
          //       .isIndicator();

          //     if (isIndicator) {
          //       createIndicator(topLevelOverlappedElement, event);
          //     } else if (this.dragTarget.type === 'new') {
          //       this.dragTarget.containerId = topLevelOverlappedElement;
          //     }
          //   }
          // };

          // const checkIfIndicatorIsValid = () => {
          //   if (!this.positioner) return;

          //   const indicator = this.positioner.getIndicator();

          //   if (!indicator) return;

          //   const parentBoundingBox = indicator.placement.parent.dom.getBoundingClientRect();

          //   if (!parentBoundingBox) return;

          //   const isRightOfParent =
          //     event.x > parentBoundingBox.left + parentBoundingBox.width;

          //   const isLeftOfParent = event.x < parentBoundingBox.x;

          //   const isAboveParent = event.y < parentBoundingBox.y;

          //   const isBelowParent =
          //     event.y > parentBoundingBox.top + parentBoundingBox.height;

          //   if (
          //     isRightOfParent ||
          //     isBelowParent ||
          //     isLeftOfParent ||
          //     isAboveParent
          //   ) {
          //     store.actions.setIndicator(null);
          //     this.positioner.cleanup();
          //     this.positioner = null;

          //     if (this.dragTarget.type === 'existing') {
          //       this.dragTarget = null;
          //     }
          //   }
          // };

          event.craft.stopPropagation();
          // checkIfIndicatorIsValid();
          // moveElementIntoOverlappedCanvas();
        });

        const unbindDragEnd = this.addCraftEventListener(el, 'dragend', (e) => {
          e.craft.stopPropagation();

          const dragTarget = this.dragTarget;

          if (!this.positioner) {
            if (dragTarget.type === 'new') {
              let canvasWrapper: HTMLElement;

              canvasWrapper = document.getElementById('global-frame');
              // if (dragTarget.containerId === ROOT_NODE) {
              //   canvasWrapper = document.getElementById('global-frame');
              // } else {
              //   canvasWrapper = store.query.node(dragTarget.containerId).get()
              //     .dom;
              // }

              const { x, y } = canvasWrapper.getBoundingClientRect();
              const { scale } = store.query.getState().options.viewport;

              const translateX = -x / scale + e.clientX / scale;
              const translateY = -y / scale + e.clientY / scale;
              const position: Position = { left: translateX, top: translateY };

              store.actions.addNodeTree(dragTarget.tree, 'ROOT', 0, position);
            }
          }

          this.dropElement((dragTarget, indicator) => {
            if (dragTarget.type === 'existing') {
              return;
            }

            const index =
              indicator.placement.index +
              (indicator.placement.where === 'after' ? 1 : 0);

            store.actions.addNodeTree(
              dragTarget.tree,
              indicator.placement.parent.id,
              index
            );

            if (options && isFunction(options.onCreate)) {
              options.onCreate(dragTarget.tree);
            }
          });
        });

        return () => {
          el.removeAttribute('draggable');
          unbindDragStart();
          unbindDragEnd();
          unbindDrag();
        };
      },
    };
  }

  private dropElement(
    onDropNode: (dragTarget: DragTarget, placement: Indicator) => void
  ) {
    const store = this.options.store;

    if (!this.positioner) {
      return;
    }

    const draggedElementShadow = this.draggedElementShadow;

    const indicator = this.positioner.getIndicator();

    if (this.dragTarget && indicator && !indicator.error) {
      onDropNode(this.dragTarget, indicator);
    }

    if (draggedElementShadow) {
      draggedElementShadow.parentNode.removeChild(draggedElementShadow);
      this.draggedElementShadow = null;
    }

    this.dragTarget = null;

    store.actions.setIndicator(null);
    store.actions.setNodeEvent('dragged', null);
    this.positioner.cleanup();

    this.positioner = null;
  }
}
