export type NavigationDirection = 'up' | 'down' | 'left' | 'right';

export interface KeyboardShortcutsConfig {
  onApprove?:       () => void;
  onReject?:        () => void;
  onNavigate?:      (direction: NavigationDirection) => void;
  onTogglePreview?: () => void;
  onClearFocus?:    () => void;
}

export interface ShortcutDefinition {
  key:         string;
  description: string;
}
