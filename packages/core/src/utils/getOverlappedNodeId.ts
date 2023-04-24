import { EditorStore } from '../editor/store';
import { NodeId } from '../interfaces';

export function getOverlappedNodeId(
  event: MouseEvent,
  store: EditorStore,
  id: NodeId
) {
  const el = store.query.node(id).get().dom;
  if (!el) return;

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

    if (!el) return false;

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

  const topLevelOverlappedElement = overlappedElements.find((elementId) => {
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
  });

  return topLevelOverlappedElement;
}
