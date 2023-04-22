import { deprecationWarning, ROOT_NODE } from '@noahbaron91/utils';
import React, { useEffect, useRef } from 'react';

import { useInternalEditor } from '../editor/useInternalEditor';
import { SerializedNodes } from '../interfaces';
import { NodeElement } from '../nodes/NodeElement';

export type Frame = {
  json?: string;
  data?: string | SerializedNodes;
};

const RenderRootNode = () => {
  const {
    timestamp,
    viewport,
    actions: { setViewport },
  } = useInternalEditor((state) => ({
    timestamp:
      state.nodes[ROOT_NODE] && state.nodes[ROOT_NODE]._hydrationTimestamp,
    viewport: state.options.viewport,
  }));

  useEffect(() => {
    function handleScroll(event: WheelEvent) {
      const { deltaX, deltaY } = event;

      const isVerticalScroll = Math.abs(deltaY) > Math.abs(deltaX);

      // Zoom in when scolling and holding ctrl or alt
      if (event.ctrlKey || event.altKey) {
        if (isVerticalScroll) {
          setViewport((previousViewport) => {
            const newScale = previousViewport.scale - deltaY / 500;

            if (newScale > 10) {
              previousViewport.scale = 10;
              return;
            }
            if (newScale < 0.1) {
              previousViewport.scale = 0.1;
              return;
            }

            previousViewport.scale = newScale;
          });
        }
        // Pans viewport when not holding ctrl or alt
      } else {
        setViewport(
          (previousViewport) =>
            (previousViewport.transformX = previousViewport.transformX - deltaX)
        );
        setViewport(
          (previousViewport) =>
            (previousViewport.transformY = previousViewport.transformY - deltaY)
        );
      }
    }

    document.addEventListener('wheel', handleScroll);

    return () => {
      document.removeEventListener('wheel', handleScroll);
    };
  }, [setViewport]);

  if (!timestamp) {
    return null;
  }

  const { scale, transformX, transformY } = viewport;

  const transform = `translateX(${transformX}px) translateY(${transformY}px) scale(${scale})`;

  const canvasStyle: React.CSSProperties = {
    transform,
    position: 'fixed',
    top: 0,
    left: 0,
    isolation: 'isolate',
  };

  return (
    <div id="global-frame" style={canvasStyle}>
      <NodeElement id={ROOT_NODE} key={timestamp} />
    </div>
  );
};

/**
 * A React Component that defines the editable area
 */
export const Frame: React.FC<React.PropsWithChildren<Frame>> = ({
  children,
  json,
  data,
}) => {
  const { actions, query } = useInternalEditor();

  if (!!json) {
    deprecationWarning('<Frame json={...} />', {
      suggest: '<Frame data={...} />',
    });
  }

  const initialState = useRef({
    initialChildren: children,
    initialData: data || json,
  });

  useEffect(() => {
    const { initialChildren, initialData } = initialState.current;

    if (initialData) {
      actions.history.ignore().deserialize(initialData);
    } else if (initialChildren) {
      const rootNode = React.Children.only(
        initialChildren
      ) as React.ReactElement;

      const node = query.parseReactElement(rootNode).toNodeTree((node, jsx) => {
        if (jsx === rootNode) {
          node.id = ROOT_NODE;
        }

        if (node.data.custom.breakpoint && node.data.custom.breakpoint) {
          const breakpointName = node.data.custom.breakpoint;
          actions.updateBreakpointId(node.id, breakpointName);
        }
        return node;
      });

      actions.history.ignore().addNodeTree(node);
    }
  }, [actions, query]);

  return <RenderRootNode />;
};
