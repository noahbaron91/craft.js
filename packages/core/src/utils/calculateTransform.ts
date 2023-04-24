import { EditorStore } from '../editor/store';
import { NodeId } from '../interfaces';

export function calculateTransform(
  store: EditorStore,
  id: NodeId,
  event: MouseEvent,
  cb: (translateX: number, translateY) => void,
  customParent?: NodeId,
  initialXPosition?: number,
  initialYPosition?: number
) {
  event.preventDefault();

  const elementDom = store.query.node(id).get().dom;
  if (!elementDom) return;

  const parent = customParent || store.query.node(id).ancestors(false)[0];

  const parentElement = store.query.node(parent).get().dom;
  if (!parentElement) return;

  const { scale } = store.query.getState().options.viewport;
  const { x, y } = parentElement.getBoundingClientRect();

  const { left, top } = elementDom.getBoundingClientRect();

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
}
