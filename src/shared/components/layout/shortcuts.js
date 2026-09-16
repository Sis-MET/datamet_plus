export const IS_APPLE_PLATFORM = typeof navigator !== 'undefined'
  && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgentData?.platform || navigator.platform || '');

export const SIDEBAR_SHORTCUT_LABEL = IS_APPLE_PLATFORM ? '⌘B' : 'Ctrl+B';
