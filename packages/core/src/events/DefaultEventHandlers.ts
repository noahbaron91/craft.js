import {
  ROOT_NODE,
  isChromium,
  isLinux,
  CraftDOMEvent,
  LEFT_INDICATOR_NAME,
  TOP_INDICATOR_NAME,
  HORIZONTAL_CENTER_INDICATOR_NAME,
  RIGHT_INDICATOR_NAME,
  BOTTOM_INDICATOR_NAME,
  VERTICAL_CENTER_INDICATOR_NAME,
} from '@noahbaron91/utils';
import { isFunction, throttle } from 'lodash';
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
import {
  cleanupIndicator,
  createCustomBreakpointTree,
  cloneNodeTree,
  createRootTree,
  getOverlappedNodeId,
  moveNode,
  createIndicator,
} from '../utils';

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
            const isSelectingEnabled = store.query.getOptions()
              .isSelectingEnabled;

            // Selecting is disabled when drag creating a new element`
            if (!isSelectingEnabled) return;

            if ((e.target as HTMLDivElement).attributes['data-indicator'])
              return;

            e.craft.stopPropagation();

            let newSelectedElementIds = [];

            // Don't select when panning or right click
            if (e.button !== 0) return;

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

        let initialXPosition = null;
        let initialYPosition = null;

        // const createIndicator = (containerId: string, event: MouseEvent) => {
        //   if (this.positioner) return;

        //   this.dragTarget = {
        //     type: 'existing',
        //     nodes: [id],
        //   };

        //   this.positioner = new Positioner(this.options.store, this.dragTarget);

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

        const calculateTransform = (
          event: MouseEvent,
          cb: (translateX: number, translateY) => void,
          customParent?: NodeId
        ) => {
          const parent =
            customParent || store.query.node(id).ancestors(false)[0];
          const parentNode = store.query.node(parent).get();
          const parentElement = parentNode.dom;

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

          const node = store.query.node(id);

          if (!node || !node.get() || !node.get().data)
            return cb(translateX, translateY);

          const isRootBreakpoint = Object.values(
            store.query.getState().breakpoints
          ).some((breapoint) => breapoint.nodeId === id);

          const currentBreakpoint = node.breakpoint();

          if (!currentBreakpoint || isRootBreakpoint) {
            return cb(translateX, translateY);
          }

          cb((translateX / parentElement.clientWidth) * 100, translateY);
        };

        const handleDragElement = throttle((event: MouseEvent) => {
          event.preventDefault();

          if (!store.query.getEvent('dragged').contains(id)) return;
          if (id === ROOT_NODE) return;

          const checkIfDraggedIntoCanvas = () => {
            // If a root breakpoint don't drag into anything
            const isRootBreakpoint = Object.values(
              store.query.getState().breakpoints
            ).some(({ nodeId }) => nodeId === id);

            if (isRootBreakpoint) return;

            const topLevelOverlappedElement = getOverlappedNodeId(
              event,
              store,
              id
            );

            const isAncestor = store.query
              .node(id)
              .ancestors(true)
              .includes(topLevelOverlappedElement);

            const canMoveIn = !!topLevelOverlappedElement && !isAncestor;

            if (canMoveIn) {
              // Check if an indicator
              // const isIndicator = store.query
              //   .node(topLevelOverlappedElement)
              //   .isIndicator();

              // if (isIndicator) {
              //   createIndicator(topLevelOverlappedElement, event);
              //   return;
              // }

              // Not located inside a breakpoint
              if (!store.query.node(topLevelOverlappedElement).breakpoint()) {
                moveNode(
                  event,
                  store,
                  id,
                  topLevelOverlappedElement,
                  undefined
                );
                return;
              }

              moveNode(
                event,
                store,
                id,
                topLevelOverlappedElement,
                undefined,
                () => {
                  const elementBreakpointNodes = store.query.node(id).get().data
                    .breakpointNodes;

                  calculateTransform(
                    event,
                    (left, top) => {
                      Object.values(elementBreakpointNodes).forEach(
                        (nodeId) => {
                          store.actions.setPosition(nodeId, () => ({
                            left,
                            top,
                          }));
                        }
                      );
                    },
                    topLevelOverlappedElement
                  );
                }
              );
            }
          };

          const checkIfDraggedOutsideOfParent = () => {
            const parent = store.query.node(id).get().data.parent;
            const parentElement = store.query.node(parent).get().dom;

            const element = store.query.node(id).get().dom;
            const elementBoundingBox = element.getBoundingClientRect();
            const parentBoundingBox = parentElement.getBoundingClientRect();

            let isRightOfParent =
              elementBoundingBox.x >
              parentBoundingBox.left + parentBoundingBox.width;

            let isLeftOfParent =
              elementBoundingBox.x + elementBoundingBox.width <
              parentBoundingBox.x;

            let isAboveParent =
              elementBoundingBox.y + elementBoundingBox.height <
              parentBoundingBox.y;

            let isBelowParent =
              elementBoundingBox.y >
              parentBoundingBox.top + parentBoundingBox.height;

            const isIndicator = store.query.node(parent).isIndicator();

            if (isIndicator) {
              isRightOfParent =
                event.clientX >
                parentBoundingBox.left + parentBoundingBox.width;

              isLeftOfParent = event.clientX < parentBoundingBox.x;

              isAboveParent = event.clientY < parentBoundingBox.y;

              isBelowParent =
                event.clientY >
                parentBoundingBox.top + parentBoundingBox.height;
            }

            if (parent !== ROOT_NODE) {
              if (
                isRightOfParent ||
                isBelowParent ||
                isLeftOfParent ||
                isAboveParent
              ) {
                const overlappedNodeId = isIndicator
                  ? store.query.node(parent).get().data.parent
                  : getOverlappedNodeId(event, store, id) || ROOT_NODE;

                if (overlappedNodeId) {
                  moveNode(event, store, id, overlappedNodeId, 0);
                }
              }
            }
          };

          const checkIfIndicatorIsValid = () => {
            if (!this.positioner) return;

            const indicator = this.positioner.getIndicator();
            const element = store.query.node(id).get().dom;
            const elementBoundingBox = element.getBoundingClientRect();
            const parentBoundingBox = indicator.placement.parent.dom.getBoundingClientRect();

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

            if (
              isRightOfParent ||
              isBelowParent ||
              isLeftOfParent ||
              isAboveParent
            ) {
              store.actions.setIndicator(null);
              this.positioner?.cleanup();
              this.positioner = null;
              this.dragTarget = null;
            }
          };

          // Calculates indicator position when moving in relation to parent
          const computeIndicator = (): { top: boolean; left: boolean } => {
            let { scale } = store.query.getState().options.viewport;
            if (scale > 1) scale = 1;

            // When scale is too small there are issues with snapping
            const parent = store.query.node(id).get().data.parent;

            const element = store.query.node(id).get().dom;
            const parentElement = store.query.node(parent).get().dom;

            const elementBoundingBox = element.getBoundingClientRect();
            const parentBoundingBox = parentElement.getBoundingClientRect();

            const calculatePositonIndicator = (): {
              top: boolean;
              left: boolean;
            } => {
              const positionRelativeToParent = (): {
                top: boolean;
                left: boolean;
              } => {
                const calculateSnappingToParent = () => {
                  const isSnappingToLeft =
                    Math.abs(
                      event.clientX / scale -
                        initialXPosition / scale -
                        parentBoundingBox.left / scale
                    ) < 10;

                  const isSnappingToRight =
                    Math.abs(
                      parentBoundingBox.left / scale +
                        parentBoundingBox.width / scale -
                        (event.clientX / scale -
                          initialXPosition / scale +
                          elementBoundingBox.width / scale)
                    ) < 10;

                  const isSnappingToTop =
                    Math.abs(
                      event.clientY / scale -
                        initialYPosition / scale -
                        parentBoundingBox.top / scale
                    ) < 10;

                  const isSnappingToBottom =
                    Math.abs(
                      parentBoundingBox.top / scale +
                        parentBoundingBox.height / scale -
                        (event.clientY / scale -
                          initialYPosition / scale +
                          elementBoundingBox.height / scale)
                    ) < 10;

                  const parentCenterX =
                    parentBoundingBox.left / scale +
                    parentBoundingBox.width / 2 / scale;

                  const elementCenterX =
                    event.clientX / scale -
                    initialXPosition / scale +
                    elementBoundingBox.width / 2 / scale;

                  const isSnappingToHorizontalCenter =
                    Math.abs(parentCenterX - elementCenterX) < 10;

                  const parentCenterY =
                    parentBoundingBox.top / scale +
                    parentBoundingBox.height / 2 / scale;

                  const elementCenterY =
                    event.clientY / scale -
                    initialYPosition / scale +
                    elementBoundingBox.height / 2 / scale;

                  const isSnappingToVerticalCenter =
                    Math.abs(parentCenterY - elementCenterY) < 10;

                  return {
                    isSnappingToLeft,
                    isSnappingToRight,
                    isSnappingToTop,
                    isSnappingToBottom,
                    isSnappingToHorizontalCenter,
                    isSnappingToVerticalCenter,
                  };
                };

                const {
                  isSnappingToBottom,
                  isSnappingToLeft,
                  isSnappingToRight,
                  isSnappingToTop,
                  isSnappingToHorizontalCenter,
                  isSnappingToVerticalCenter,
                } = calculateSnappingToParent();

                let isLockedTop = false;
                let isLockedLeft = false;

                const snapToParent = (
                  position:
                    | 'top'
                    | 'bottom'
                    | 'left'
                    | 'right'
                    | 'horizontal-center'
                    | 'vertical-center'
                ) => {
                  switch (position) {
                    case 'left': {
                      const foundIndicator = document.querySelector(
                        `[data-position="${LEFT_INDICATOR_NAME}"]`
                      );

                      if (!foundIndicator) createIndicator(store, id, 'left');

                      store.actions.history
                        .ignore()
                        .setPosition(id, (position) => ({
                          left: 0,
                          top: position.top,
                        }));

                      isLockedLeft = true;
                      break;
                    }
                    case 'right': {
                      const foundIndicator = document.querySelector(
                        `[data-position="${RIGHT_INDICATOR_NAME}"]`
                      );

                      if (!foundIndicator) createIndicator(store, id, 'right');

                      const calculateLeftPosition = () => {
                        const breakpoint = store.query.node(id).breakpoint();

                        if (breakpoint) {
                          const leftPercentagePosition =
                            100 -
                            (elementBoundingBox.width /
                              parentBoundingBox.width) *
                              100;

                          return leftPercentagePosition;
                        } else {
                          return (
                            parentBoundingBox.width - elementBoundingBox.width
                          );
                        }
                      };

                      const left = calculateLeftPosition();

                      store.actions.history
                        .ignore()
                        .setPosition(id, (position) => ({
                          left: left,
                          top: position.top,
                        }));

                      isLockedLeft = true;
                      break;
                    }
                    case 'top': {
                      const foundIndicator = document.querySelector(
                        `[data-position="${TOP_INDICATOR_NAME}"]`
                      );

                      if (!foundIndicator) createIndicator(store, id, 'top');

                      store.actions.history
                        .ignore()
                        .setPosition(id, (position) => ({
                          left: position.left,
                          top: 0,
                        }));

                      isLockedTop = true;
                      break;
                    }
                    case 'bottom': {
                      const foundIndicator = document.querySelector(
                        `[data-position="${TOP_INDICATOR_NAME}"]`
                      );

                      if (!foundIndicator) createIndicator(store, id, 'bottom');

                      const topPosition =
                        parentBoundingBox.height / scale -
                        elementBoundingBox.height / scale;

                      store.actions.history
                        .ignore()
                        .setPosition(id, (position) => ({
                          left: position.left,
                          top: topPosition,
                        }));

                      isLockedTop = true;

                      break;
                    }
                    case 'horizontal-center': {
                      const foundIndicator = document.querySelector(
                        `[data-position="${HORIZONTAL_CENTER_INDICATOR_NAME}"]`
                      );

                      if (!foundIndicator)
                        createIndicator(store, id, 'horizontal-center');

                      const parentCenterX = parentBoundingBox.width / 2 / scale;

                      const breakpoint = store.query.node(id).breakpoint();

                      const leftPosition =
                        parentCenterX - elementBoundingBox.width / 2 / scale;

                      if (breakpoint) {
                        const leftPercentage =
                          (leftPosition / (parentBoundingBox.width / scale)) *
                          100;

                        store.actions.history
                          .ignore()
                          .setPosition(id, (position) => ({
                            left: leftPercentage,
                            top: position.top,
                          }));
                      } else {
                        store.actions.history
                          .ignore()
                          .setPosition(id, (position) => ({
                            left: leftPosition,
                            top: position.top,
                          }));
                      }

                      isLockedLeft = true;

                      break;
                    }
                    case 'vertical-center': {
                      const foundIndicator = document.querySelector(
                        `[data-position="${VERTICAL_CENTER_INDICATOR_NAME}"]`
                      );

                      if (!foundIndicator)
                        createIndicator(store, id, 'vertical-center');

                      const parentCenterY =
                        parentBoundingBox.height / 2 / scale;

                      const topPosition =
                        parentCenterY - elementBoundingBox.height / 2 / scale;

                      store.actions.history
                        .ignore()
                        .setPosition(id, (position) => ({
                          left: position.left,
                          top: topPosition,
                        }));

                      isLockedTop = true;

                      break;
                    }
                  }
                };

                if (isSnappingToLeft) {
                  snapToParent('left');
                } else {
                  cleanupIndicator(LEFT_INDICATOR_NAME);
                }

                if (isSnappingToRight) {
                  snapToParent('right');
                } else {
                  cleanupIndicator(RIGHT_INDICATOR_NAME);
                }

                if (isSnappingToTop) {
                  snapToParent('top');
                } else {
                  cleanupIndicator(TOP_INDICATOR_NAME);
                }

                if (isSnappingToBottom) {
                  snapToParent('bottom');
                } else {
                  cleanupIndicator(BOTTOM_INDICATOR_NAME);
                }

                if (isSnappingToHorizontalCenter) {
                  snapToParent('horizontal-center');
                } else {
                  cleanupIndicator(HORIZONTAL_CENTER_INDICATOR_NAME);
                }

                if (isSnappingToVerticalCenter) {
                  snapToParent('vertical-center');
                } else {
                  cleanupIndicator(VERTICAL_CENTER_INDICATOR_NAME);
                }

                return { left: isLockedLeft, top: isLockedTop };
              };

              return positionRelativeToParent();
            };

            return calculatePositonIndicator();
          };

          calculateTransform(event, (left, top) => {
            const newPositon = {
              top,
              left,
            };

            const {
              left: lockedLeftPosition,
              top: lockedTopPosition,
            } = computeIndicator();

            if (!lockedLeftPosition && !lockedTopPosition) {
              store.actions.history
                .throttle(2500)
                .setPosition(id, () => newPositon);

              return;
            }

            if (lockedLeftPosition && lockedTopPosition) return;

            if (lockedLeftPosition) {
              store.actions.history
                .throttle(2500)
                .setPosition(id, (position) => ({
                  left: position.left,
                  top: newPositon.top,
                }));

              return;
            }

            if (lockedTopPosition) {
              store.actions.history
                .throttle(2500)
                .setPosition(id, (position) => ({
                  left: newPositon.left,
                  top: position.top,
                }));

              return;
            }
          });

          checkIfDraggedOutsideOfParent();
          checkIfIndicatorIsValid();
          checkIfDraggedIntoCanvas();
        }, 40);

        const handleDragStart = (event: CraftDOMEvent<MouseEvent>) => {
          const isSelectingEnabled = store.query.getOptions()
            .isSelectingEnabled;

          if (!isSelectingEnabled) return;

          // If a text element is selected and a selection exists, don't drag
          const isTextElement =
            store.query.node(id).get().data.displayName === 'Text';

          if (isTextElement) {
            const selection = window.getSelection();

            if (selection.rangeCount !== 0) {
              const range = selection.getRangeAt(0);
              // Check if editing element
              if (el.contains(range.commonAncestorContainer)) return;
            }
          }

          const editor = document.getElementById('editor');
          if (
            (event.target as HTMLDivElement).attributes['data-indicator'] ||
            !editor.contains(event.target as Node)
          )
            return;

          // Only drag on left click
          if (event.button !== 0) {
            return;
          }

          // const parent = store.query.node(id).get().data.parent;

          // if (store.query.node(parent).isIndicator()) {
          //   createIndicator(parent, event);
          // }

          const breakpoint = store.query.node(id).breakpoint();
          let designlyBreakpoint = breakpoint && breakpoint.toLowerCase();
          if (designlyBreakpoint === 'root') designlyBreakpoint = 'desktop';

          event.craft.stopPropagation();
          store.actions.setNodeEvent('dragged', id);

          window.addEventListener('mousemove', handleDragElement);
          window.addEventListener('mouseup', handleDragEnd);
        };

        const handleDragEnd = (event: MouseEvent) => {
          store.actions.setNodeEvent('dragged', null);

          // Use negative margin when negative position is used
          const isRootBreakpointNode = Object.values(
            store.query.getState().breakpoints
          ).some((breakpoint) => breakpoint.nodeId === id);

          const breakpoint = store.query.node(id).breakpoint();

          let designlyBreakpoint = breakpoint && breakpoint.toLowerCase();
          if (designlyBreakpoint === 'root') designlyBreakpoint = 'desktop';

          if (!isRootBreakpointNode && designlyBreakpoint) {
            const position = store.query.node(id).get().data.position;

            if (position.top < 0 && position.left < 0) {
              store.actions.history.ignore().setPosition(id, () => ({
                left: 0,
                top: 0,
              }));
            } else if (position.top < 0) {
              store.actions.history.ignore().setPosition(id, (position) => ({
                left: position.left,
                top: 0,
              }));
            } else if (position.left < 0) {
              store.actions.history.ignore().setPosition(id, (position) => ({
                top: position.top,
                left: 0,
              }));
            }
          }

          // Reset drag postition
          initialXPosition = null;
          initialYPosition = null;

          window.removeEventListener('mousemove', handleDragElement);
          window.removeEventListener('mouseup', handleDragEnd);

          // Cleanup indicator
          Array.from(
            document.getElementsByClassName('designly---indicator')
          ).forEach((indicator) => indicator.remove());

          if (!this.positioner) return;

          // Drop element
          const indicator = this.positioner.getIndicator();
          const index =
            indicator.placement.index +
            (indicator.placement.where === 'after' ? 1 : 0);

          const palcementId = indicator.placement.parent.id;
          moveNode(event, store, id, palcementId, index);

          // Cleanup indicator
          store.actions.setIndicator(null);
          this.dragTarget = null;
          this.positioner.cleanup();
          this.positioner = null;
        };

        // Fires when the element is moved
        // if (store.query.getEvent('dragged').contains(id)) {
        //   window.addEventListener('mousemove', handleDragElement);
        // }
        this.addCraftEventListener(el, 'mousedown', handleDragStart);
        // el.addEventListener('mousedown', handleDragStart);

        return () => {
          // window.removeEventListener('mousemove', handleDragElement);
          // window.removeEventListener('mouseup', handleDragEnd);
          el.removeEventListener('mousedown', handleDragStart);
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
            e.stopPropagation();

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
              containerId: ROOT_NODE,
              tree,
            };
          }
        );

        const unbindDrag = this.addCraftEventListener(el, 'drag', (event) => {
          if (!el.getAttribute('draggable')) return;

          const createIndicator = (containerId: string, event: MouseEvent) => {
            this.positioner = new Positioner(
              this.options.store,
              this.dragTarget
            );

            if (!this.positioner) {
              return;
            }

            const indicator = this.positioner.computeIndicator(
              containerId,
              event.clientX,
              event.clientY
            );

            if (!indicator) {
              return;
            }

            store.actions.setIndicator(indicator);
          };

          const moveElementIntoOverlappedCanvas = () => {
            const nodes = store.query.getNodes();

            const overlappedElements = Object.keys(nodes).filter((nodeId) => {
              if (!nodeId || nodeId === ROOT_NODE) return false;
              if (!store.query.node(nodeId).isCanvas()) return false;

              const node = nodes[nodeId];
              const el = node.dom;
              const { x, y, width, height } = el.getBoundingClientRect();

              return (
                event.clientX > x &&
                event.clientX < x + width &&
                event.clientY > y &&
                event.clientY < y + height
              );
            });

            // Filter overlapped elements to get the top level element
            const topLevelOverlappedElement = overlappedElements.find(
              (elementId) => {
                if (!elementId) return false;

                const parents = store.query.node(elementId).descendants(true);
                return parents.every((id) => !overlappedElements.includes(id));
              }
            );

            if (topLevelOverlappedElement) {
              const isIndicator = store.query
                .node(topLevelOverlappedElement)
                .isIndicator();

              if (isIndicator) {
                createIndicator(topLevelOverlappedElement, event);
              }

              // else if (this.dragTarget.type === 'new') {
              //   this.dragTarget.containerId =
              //     topLevelOverlappedElement || ROOT_NODE;
              // }
            }
          };

          const checkIfIndicatorIsValid = () => {
            if (!this.positioner) return;

            const indicator = this.positioner.getIndicator();

            if (!indicator) return;

            const parentBoundingBox = indicator.placement.parent.dom.getBoundingClientRect();

            if (!parentBoundingBox) return;

            const isRightOfParent =
              event.x > parentBoundingBox.left + parentBoundingBox.width;

            const isLeftOfParent = event.x < parentBoundingBox.x;

            const isAboveParent = event.y < parentBoundingBox.y;

            const isBelowParent =
              event.y > parentBoundingBox.top + parentBoundingBox.height;

            if (
              isRightOfParent ||
              isBelowParent ||
              isLeftOfParent ||
              isAboveParent
            ) {
              store.actions.setIndicator(null);
              this.positioner.cleanup();
              this.positioner = null;

              if (this.dragTarget.type === 'existing') {
                this.dragTarget = null;
              }
            }
          };

          event.craft.stopPropagation();
          checkIfIndicatorIsValid();
          moveElementIntoOverlappedCanvas();
        });

        const unbindDragEnd = this.addCraftEventListener(
          el,
          'dragend',
          (event) => {
            event.craft.stopPropagation();
            event.stopPropagation();

            const dragTarget = this.dragTarget;

            if (!this.positioner) {
              if (dragTarget.type === 'new') {
                const nodes = store.query.getNodes();

                const overlappedElements = Object.keys(nodes).filter(
                  (nodeId) => {
                    if (!nodeId || nodeId === ROOT_NODE) return false;
                    if (!store.query.node(nodeId).isCanvas()) return false;

                    const node = nodes[nodeId];
                    const el = node.dom;
                    const { x, y, width, height } = el.getBoundingClientRect();

                    return (
                      event.clientX > x &&
                      event.clientX < x + width &&
                      event.clientY > y &&
                      event.clientY < y + height
                    );
                  }
                );

                // Filter overlapped elements to get the top level element
                const overlappedDropId =
                  overlappedElements.find((elementId) => {
                    if (!elementId) return false;

                    const parents = store.query
                      .node(elementId)
                      .descendants(true);
                    return parents.every(
                      (id) => !overlappedElements.includes(id)
                    );
                  }) || 'ROOT';

                const targetBreakpoint = store.query
                  .node(overlappedDropId)
                  .breakpoint();

                const isIndicator = store.query
                  .node(overlappedDropId)
                  .isIndicator();

                if (isIndicator) return;

                const { x, y } = store.query
                  .node(overlappedDropId)
                  .get()
                  .dom.getBoundingClientRect();
                const { scale } = store.query.getState().options.viewport;

                const translateX = -x / scale + event.clientX / scale;
                const translateY = -y / scale + event.clientY / scale;

                const breakpoints = store.query.getState().breakpoints;
                const breakpointWidth = breakpoints[targetBreakpoint]?.width;

                const position: Position =
                  targetBreakpoint && breakpointWidth
                    ? {
                        left: (translateX / breakpointWidth) * 100,
                        top: translateY,
                      }
                    : {
                        left: translateX,
                        top: translateY,
                      };

                // If the element is dropped into a canvas with a breakpoint
                if (overlappedDropId && targetBreakpoint) {
                  const rootTree = createRootTree(
                    store,
                    dragTarget.tree,
                    overlappedDropId
                  );

                  const breakpointNodes = store.query
                    .node(overlappedDropId)
                    .get().data.breakpointNodes;

                  const breakpointTrees = Object.entries(breakpointNodes).map(
                    ([breakpointName, nodeId]) => {
                      const clonedTree = createCustomBreakpointTree(
                        store,
                        rootTree,
                        breakpointName
                      );

                      return {
                        breakpointParent: nodeId,
                        index: 0,
                        newNodeTree: clonedTree,
                        position,
                      };
                    }
                  );

                  store.actions.addMultipleNodeTrees(breakpointTrees);

                  // If the element is dropped into a cavnas element without a breakpoint
                } else if (overlappedDropId && !targetBreakpoint) {
                  store.actions.addNodeTree(
                    dragTarget.tree,
                    overlappedDropId,
                    undefined,
                    position
                  );
                }
              }
            }

            this.dropElement((dragTarget, indicator) => {
              if (dragTarget.type === 'existing') {
                return;
              }

              const index =
                indicator.placement.index +
                (indicator.placement.where === 'after' ? 1 : 0);

              const id = dragTarget.tree.rootNodeId;
              const topLevelOverlappedElement = indicator.placement.parent.id;
              const targetBreakpointName = store.query
                .node(topLevelOverlappedElement)
                .breakpoint();
              const breakpointNodes = store.query.getState().nodes[
                topLevelOverlappedElement
              ].data.breakpointNodes;

              const newBreakpointNodes = [id];

              Object.entries(breakpointNodes).forEach(
                ([breakpointNode, nodeId]) => {
                  if (targetBreakpointName === breakpointNode) return;

                  const clonedTree = cloneNodeTree(dragTarget.tree, store);
                  store.actions.addNodeTree(clonedTree, nodeId, index);
                  newBreakpointNodes.push(clonedTree.rootNodeId);
                }
              );

              store.actions.addNodeTree(
                dragTarget.tree,
                indicator.placement.parent.id,
                index
              );

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

              if (options && isFunction(options.onCreate)) {
                options.onCreate(dragTarget.tree);
              }
            });
          }
        );

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
