// TODO: deprecate in favor of testUtils
export const createTestNode = (id, data = {}, config: any = {}) => {
  return {
    ...config,
    id,
    data: {
      props: {},
      custom: {},
      hidden: false,
      isCanvas: false,
      isIndicator: false,
      position: {
        global: {
          left: 0,
          top: 0,
        },
      },
      nodes: [],
      linkedNodes: {},
      ...data,
    },
    related: {},
    events: {
      selected: false,
      dragged: false,
      hovered: false,
      ...(config.events || {}),
    },
    rules: {
      canMoveIn: () => true,
      canMoveOut: () => true,
      canDrag: () => true,
      canDrop: () => true,
      ...(config.rules || {}),
    },
  };
};
