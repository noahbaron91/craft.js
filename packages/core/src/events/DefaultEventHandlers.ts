import { ROOT_NODE, isChromium, isLinux } from '@noahbaron91/utils';
import { isFunction } from 'lodash';
import React from 'react';

import { CoreEventHandlers, CreateHandlerOptions } from './CoreEventHandlers';
import { Positioner } from './Positioner';
import { createShadow } from './createShadow';

import { Indicator, NodeId, DragTarget, NodeTree } from '../interfaces';

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
          // unbindDragOver();
        };
      },
      drag: (el: HTMLElement, id: NodeId) => {
        if (!store.query.node(id).isDraggable()) {
          return () => {};
        }

        // Calculates the transform of the dragged element
        const calculateTransform = (event: MouseEvent) => {
          const parent = store.query.node(id).ancestors(false)[0];
          let canvasWrapper: HTMLElement;

          if (parent === ROOT_NODE) {
            canvasWrapper = document.getElementById('global-frame');
          } else {
            canvasWrapper = store.query.node(parent).get().dom;
          }

          const { scale } = store.query.getViewport();
          const { x, y } = canvasWrapper.getBoundingClientRect();

          // Gets position relative to canvas wrapper
          const translateX = -x / scale + event.clientX / scale;
          const translateY = -y / scale + event.clientY / scale;

          return { translateX, translateY };
        };

        const handleDragElement = (event: MouseEvent) => {
          if (!store.query.node(id).isDragged()) return;

          // Check if the element is overlapping with a canvas element
          const nodes = store.query.getNodes();

          const overlappedElements = Object.keys(nodes).find((nodeId) => {
            if (nodeId === id) return false;

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

          // Check if element is dragged outside of parent
          const parent = store.query.node(id).ancestors(false)[0];
          const parentElement = store.query.node(parent).get().dom;
          const elementBoundingBox = el.getBoundingClientRect();
          const parentBoundingBox = parentElement.getBoundingClientRect();

          // const isRightOfParent =

          if (parent !== ROOT_NODE) {
            if (
              elementBoundingBox.x >
                parentBoundingBox.left + parentBoundingBox.width ||
              elementBoundingBox.y >
                parentBoundingBox.top + parentBoundingBox.height ||
              elementBoundingBox.x + elementBoundingBox.width <
                parentBoundingBox.x ||
              elementBoundingBox.y + elementBoundingBox.height <
                parentBoundingBox.y
            ) {
              // Move element up a level
              const parentParent = store.query.node(parent).ancestors(false)[0];
              store.actions.move(id, parentParent, 0);
            }
          }

          // const isDraggedOffParent =

          if (overlappedElements && parent !== overlappedElements) {
            // Check if canvas
            const isCanvas = store.query.node(overlappedElements).isCanvas();

            if (isCanvas) {
              store.actions.move(id, overlappedElements, 0);
              // Set to position absolute
              el.style.position = 'absolute';
            }
          }

          // Check if dragging out of overflow

          const { translateX, translateY } = calculateTransform(event);

          const transform = `translateX(${translateX}px) translateY(${translateY}px)`;
          el.style.transform = transform;
        };

        window.addEventListener('mousemove', handleDragElement);

        const unbindDragStart = this.addCraftEventListener(
          el,
          'mousedown',
          (event) => {
            // Testing
            event.craft.stopPropagation();

            const parent = store.query.node(id).ancestors(false)[0];

            if (parent === ROOT_NODE && el.style.position !== 'fixed') {
              const { translateX, translateY } = calculateTransform(event);
              const transform = `translateX(${translateX}px) translateY(${translateY}px)`;

              el.style.transform = transform;
              el.style.position = 'fixed';
              el.style.top = '0px';
              el.style.left = '0px';
            }

            store.actions.setNodeEvent('dragged', id);
          }
        );

        const handleDragEnd = () => {
          store.actions.setNodeEvent('dragged', null);
        };

        window.addEventListener('mouseup', handleDragEnd);

        // TODO: When dragged over elements that are droppable, enable the default craft js drop behaviour
        // const unbindDragOver = this.addCraftEventListener(
        //   el,
        //   'dragover',
        //   (e) => {
        //     console.log('drag over');
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

        return () => {
          el.setAttribute('draggable', 'false');

          unbindDragStart();
          window.removeEventListener('mousemove', handleDragElement);
          window.removeEventListener('mouseup', handleDragEnd);
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

            this.positioner = new Positioner(
              this.options.store,
              this.dragTarget
            );
          }
        );

        const unbindDragEnd = this.addCraftEventListener(el, 'dragend', (e) => {
          e.craft.stopPropagation();

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
