import { ROOT_NODE, isChromium, isLinux } from '@noahbaron91/utils';

import { CoreEventHandlers, CreateHandlerOptions } from './CoreEventHandlers';
import { Positioner } from './Positioner';

import { Indicator, NodeId, DragTarget } from '../interfaces';

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

        const createIndicator = (containerId: string, event: MouseEvent) => {
          // Create indicator
          this.dragTarget = {
            type: 'existing',
            nodes: [id],
          };

          this.positioner = new Positioner(this.options.store, this.dragTarget);

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

        const checkIfElementIsMissingStyles = () => {
          const parent = store.query.node(id).ancestors(false)[0];

          const styles = getComputedStyle(el);
          const position = styles.getPropertyValue('position');
          const zIndex = styles.getPropertyValue('z-index');

          if (parent === ROOT_NODE && position !== 'fixed') {
            el.style.position = 'fixed';
          }

          if (parent !== ROOT_NODE && position !== 'absolute') {
            el.style.position = 'absolute';
          }

          if (zIndex !== '99999') {
            el.style.zIndex = '99999';
          }
        };

        const handleDragElement = (event: MouseEvent) => {
          if (!store.query.node(id).isDragged()) return;
          const parent = store.query.node(id).ancestors(false)[0];

          // If the element is an indicator canvas element make sure an indicator exists
          if (store.query.node(parent).isIndicator()) {
            const parentParent = store.query.node(parent).ancestors(false)[0];
            store.actions.move(id, parentParent, 0);
          }

          // Check if the element is overlapping with a canvas element
          const moveElementIntoOverlappedCanvas = () => {
            const nodes = store.query.getNodes();

            const overlappedElements = Object.keys(nodes).filter((nodeId) => {
              if (nodeId === id) return false;

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

            const canMoveIn =
              topLevelOverlappedElement && parent !== topLevelOverlappedElement;

            if (canMoveIn) {
              const isIndicator = store.query
                .node(topLevelOverlappedElement)
                .isIndicator();

              if (isIndicator) {
                createIndicator(topLevelOverlappedElement, event);
              } else {
                store.actions.move(id, topLevelOverlappedElement, 0);
              }
            }
          };

          const checkIfElementIsDraggedOutsideOfParent = () => {
            const parentElement = store.query.node(parent).get().dom;

            const elementBoundingBox = el.getBoundingClientRect();
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
                // Move element up a level
                const parentParent = store.query
                  .node(parent)
                  .ancestors(false)[0];

                store.actions.move(id, parentParent, 0);
              }
            }
          };

          const checkIfIndicatorIsValid = () => {
            if (!store.query.node(id).isDragged()) return;

            if (!this.positioner) return;
            const indicator = this.positioner.getIndicator();
            const elementBoundingBox = el.getBoundingClientRect();
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
              this.positioner.cleanup();
              this.positioner = null;
              this.dragTarget = null;
            }
          };

          // checkIfElementIsMissingStyles();
          moveElementIntoOverlappedCanvas();
          checkIfElementIsDraggedOutsideOfParent();
          checkIfIndicatorIsValid();

          const { translateX, translateY } = calculateTransform(event);

          const transform = `translateX(${translateX}px) translateY(${translateY}px)`;
          checkIfElementIsMissingStyles();
          el.style.transform = transform;
        };

        window.addEventListener('mousemove', handleDragElement);

        const unbindDragStart = this.addCraftEventListener(
          el,
          'mousedown',
          (event) => {
            event.craft.stopPropagation();
            checkIfElementIsMissingStyles();
            store.actions.setNodeEvent('dragged', id);
          }
        );

        const handleDragEnd = () => {
          if (!store.query.node(id).isDragged()) return;

          store.actions.setNodeEvent('dragged', null);
          el.style.zIndex = '1';

          if (!this.positioner) return;

          // Drop element
          const indicator = this.positioner.getIndicator();
          const index =
            indicator.placement.index +
            (indicator.placement.where === 'after' ? 1 : 0);
          store.actions.move(id, indicator.placement.parent.id, index);

          // Cleanup indicator
          store.actions.setIndicator(null);
          this.dragTarget = null;
          this.positioner.cleanup();
          this.positioner = null;
        };

        // Changes the dragging indicator to drop
        document.addEventListener('dragover', (event) => {
          event.preventDefault();
        });

        window.addEventListener('mouseup', handleDragEnd);

        return () => {
          el.setAttribute('draggable', 'false');

          unbindDragStart();
          window.removeEventListener('mousemove', handleDragElement);
          window.removeEventListener('mouseup', handleDragEnd);
        };
      },
      create: (
        el: HTMLElement,
        userElement: React.ReactElement,
        options?: Partial<CreateHandlerOptions>
      ) => {
        el.setAttribute('draggable', 'true');

        const unbindDragStart = this.addCraftEventListener(
          el,
          'dragstart',
          (e) => {
            e.craft.stopPropagation();
            let tree;

            // TODO: Reimplement this
            // if (typeof userElement === 'function') {
            //   const result = userElement();
            //   if (React.isValidElement(result)) {
            //     tree = store.query.parseReactElement(result).toNodeTree();
            //   } else {
            //     tree = result;
            //   }
            // } else {
            //   tree = store.query.parseReactElement(userElement).toNodeTree();
            // }

            // Create ghost element from tree
            tree = store.query.parseReactElement(userElement).toNodeTree();
            store.actions.setDragElement(userElement, e);

            this.dragTarget = {
              type: 'new',
              tree,
            };
          }
        );

        // const unbindDragOver = this.addCraftEventListener(
        //   el,
        //   'dragover',
        //   (event) => {
        //     event.preventDefault();
        //     // Render element at cursor position with low opacity
        //   }
        // );

        const unbindDragEnd = this.addCraftEventListener(el, 'dragend', (e) => {
          e.craft.stopPropagation();

          store.actions.setDragElement(null, null);

          const dragTarget = this.dragTarget;

          if (dragTarget.type === 'new') {
            store.actions.addNodeTree(dragTarget.tree, ROOT_NODE, 0);
          }

          this.dropElement((dragTarget, indicator) => {
            if (dragTarget.type === 'existing') {
              return;
            }

            // const index =
            //   indicator.placement.index +
            //   (indicator.placement.where === 'after' ? 1 : 0);
            // store.actions.addNodeTree(
            //   dragTarget.tree,
            //   indicator.placement.parent.id,
            //   index
            // );
            // if (options && isFunction(options.onCreate)) {
            //   options.onCreate(dragTarget.tree);
            // }
          });

          // Cleanup indicator
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
