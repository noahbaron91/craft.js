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

  window.addEventListener('dragover', (event) => event.preventDefault());

  useEffect(() => {
    const editor = document.getElementById('editor');

    function handleScroll(event: WheelEvent) {
      event.preventDefault();

      const { deltaX, deltaY } = event;

      const isVerticalScroll = Math.abs(deltaY) > Math.abs(deltaX);

      // Zoom in when scolling and holding ctrl or alt
      if (event.ctrlKey || event.altKey) {
        if (isVerticalScroll) {
          const SENSITIVITY = 0.0005;
          setViewport((previousViewport) => {
            let newScale = previousViewport.scale - deltaY * SENSITIVITY;

            if (newScale > 10) {
              newScale = 10;
            }
            if (newScale < 0.1) {
              newScale = 0.1;
            }

            const ratio = 1 - newScale / previousViewport.scale;
            const translateX =
              previousViewport.transformX +
              (event.clientX - previousViewport.transformX) * ratio;
            const translateY =
              previousViewport.transformY +
              (event.clientY - previousViewport.transformY) * ratio;

            previousViewport.scale = newScale;
            previousViewport.transformX = translateX;
            previousViewport.transformY = translateY;

            event.preventDefault();
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

    function handleMouseMove(event: MouseEvent) {
      setViewport((previousViewport) => {
        const SENSITIVITY = 0.75;

        previousViewport.transformX =
          previousViewport.transformX + event.movementX * SENSITIVITY;
        previousViewport.transformY =
          previousViewport.transformY + event.movementY * SENSITIVITY;
      });
    }

    function handleMouseUp() {
      document.body.style.cursor = 'default';
      document.removeEventListener('mousemove', handleMouseMove);
    }

    function handleMouseDown(event: MouseEvent) {
      event.stopPropagation();

      if (event.button === 1) {
        document.body.style.cursor = 'grab';
        document.addEventListener('mousemove', handleMouseMove);
      }
    }

    editor.addEventListener('wheel', handleScroll, {
      passive: false,
    });

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      editor.removeEventListener('wheel', handleScroll);

      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
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
    height: `calculate(100vh / ${scale})`,
    width: `calculate(100vw / ${scale})`,
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
  console.log('frame 2', query.getNodes());

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
