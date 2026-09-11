import React from 'react';
import { ModuleDrawer } from './ModuleDrawer';

export type TabType = 
  | 'hero'
  | 'command' 
  | 'intelligence'
  | 'graph'
  | 'cases' 
  | 'evidence' 
  | 'integrity' 
  | 'temporal' 
  | 'leads' 
  | 'explain' 
  | 'models'
  | 'analytics' 
  | 'profile'
  | 'ai';

interface Props {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  collapsed?: boolean;
  setCollapsed?: (collapsed: boolean) => void;
}

export const Sidebar: React.FC<Props> = ({ activeTab, setActiveTab }) => {
  // Retained for backward compatibility if ever directly rendered
  return null;
};
