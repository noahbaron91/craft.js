import {
  BOTTOM_INDICATOR_NAME,
  HORIZONTAL_CENTER_INDICATOR_NAME,
  LEFT_INDICATOR_NAME,
  RIGHT_INDICATOR_NAME,
  TOP_INDICATOR_NAME,
  VERTICAL_CENTER_INDICATOR_NAME,
} from '@noahbaron91/utils';

import { EditorStore } from '../editor/store';
import { NodeId } from '../interfaces';

export const createIndicator = (
  store: EditorStore,
  id: NodeId,
  position:
    | 'top'
    | 'left'
    | 'bottom'
    | 'right'
    | 'horizontal-center'
    | 'vertical-center'
) => {
  const globalFrame = document.getElementById('global-frame');

  if (!globalFrame) return;

  const globalFrameBoundingBox = globalFrame.getBoundingClientRect();
  const parent = store.query.node(id).ancestors(false)[0];
  const parentNode = store.query.node(parent).get();
  const parentDom = parentNode.dom;

  if (!parentDom) return;

  const parentBoundingBox = parentDom.getBoundingClientRect();

  const { scale } = store.query.getState().options.viewport;

  switch (position) {
    case 'top': {
      const leftRelativeToGlobalFrame =
        (parentBoundingBox.left - globalFrameBoundingBox.left) / scale;
      const topRelativeToGlobalFrame =
        (parentBoundingBox.top - globalFrameBoundingBox.top) / scale;

      const payload = {
        top: topRelativeToGlobalFrame,
        left: leftRelativeToGlobalFrame,
        width: parentBoundingBox.width / scale,
        height: 2,
        data: TOP_INDICATOR_NAME,
      };

      store.actions.history.ignore().createIndicator(payload);

      break;
    }
    case 'bottom': {
      const leftRelativeToGlobalFrame =
        (parentBoundingBox.left - globalFrameBoundingBox.left) / scale;
      const topRelativeToGlobalFrame =
        (parentBoundingBox.top - globalFrameBoundingBox.top) / scale;

      const payload = {
        top: topRelativeToGlobalFrame + parentBoundingBox.height / scale,
        left: leftRelativeToGlobalFrame,
        width: parentBoundingBox.width / scale,
        height: 2,
        data: BOTTOM_INDICATOR_NAME,
      };

      store.actions.history.ignore().createIndicator(payload);

      break;
    }
    case 'left': {
      const globalFrameBoundingBox = globalFrame.getBoundingClientRect();

      const leftRelativeToGlobalFrame =
        (parentBoundingBox.left - globalFrameBoundingBox.left) / scale;
      const topRelativeToGlobalFrame =
        (parentBoundingBox.top - globalFrameBoundingBox.top) / scale;

      const payload = {
        top: topRelativeToGlobalFrame,
        left: leftRelativeToGlobalFrame,
        width: 2,
        height: parentBoundingBox.height / scale,
        data: LEFT_INDICATOR_NAME,
      };

      store.actions.history.ignore().createIndicator(payload);

      break;
    }
    case 'right': {
      const leftRelativeToGlobalFrame =
        (parentBoundingBox.left - globalFrameBoundingBox.left) / scale;
      const topRelativeToGlobalFrame =
        (parentBoundingBox.top - globalFrameBoundingBox.top) / scale;

      const payload = {
        top: topRelativeToGlobalFrame,
        left: leftRelativeToGlobalFrame + parentBoundingBox.width / scale,
        width: 2,
        height: parentBoundingBox.height / scale,
        data: RIGHT_INDICATOR_NAME,
      };

      store.actions.history.ignore().createIndicator(payload);

      break;
    }
    case 'horizontal-center': {
      const leftRelativeToGlobalFrame =
        (parentBoundingBox.left - globalFrameBoundingBox.left) / scale;
      const topRelativeToGlobalFrame =
        (parentBoundingBox.top - globalFrameBoundingBox.top) / scale;

      const payload = {
        top: topRelativeToGlobalFrame,
        left: leftRelativeToGlobalFrame + parentBoundingBox.width / 2 / scale,
        width: 2,
        height: parentBoundingBox.height / scale,
        data: HORIZONTAL_CENTER_INDICATOR_NAME,
      };

      store.actions.history.ignore().createIndicator(payload);

      break;
    }

    case 'vertical-center': {
      const leftRelativeToGlobalFrame =
        (parentBoundingBox.left - globalFrameBoundingBox.left) / scale;
      const topRelativeToGlobalFrame =
        (parentBoundingBox.top - globalFrameBoundingBox.top) / scale;

      const payload = {
        top: topRelativeToGlobalFrame + parentBoundingBox.height / 2 / scale,
        left: leftRelativeToGlobalFrame,
        width: parentBoundingBox.width / scale,
        height: 2,
        data: VERTICAL_CENTER_INDICATOR_NAME,
      };

      store.actions.history.ignore().createIndicator(payload);
    }
  }
};
