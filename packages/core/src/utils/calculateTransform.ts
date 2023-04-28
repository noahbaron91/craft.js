import { EditorStore } from '../editor/store';
import { NodeId } from '../interfaces';

type Settings = {
  customParent?: NodeId;
  initialXPosition?: number;
  initialYPosition?: number;
};

type CallbackProps = {
  left: number;
  top: number;
};

export function calculateTransform(
  store: EditorStore,
  id: NodeId,
  event: MouseEvent,
  cb: ({ left, top }: CallbackProps) => void,
  { customParent, initialXPosition, initialYPosition }: Settings
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

  cb({ left: translateX, top: translateY });
}
