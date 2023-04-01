import { NodeId } from '@noahbaron91/core';
import { EventHandlerConnectors } from '@noahbaron91/utils';
import React from 'react';

import { LayerHandlers } from '../events/LayerHandlers';

export type LayerContextType = {
  id: NodeId;
  depth: number;
  connectors: EventHandlerConnectors<LayerHandlers, React.ReactElement>;
};

export const LayerContext = React.createContext<LayerContextType>(
  {} as LayerContextType
);
