// The scene kit: drawn VS Code pieces for the changes a demo can't record (signed out, outside the window, a build
// without the change). `prs digest scenes` lists them; a digest can also bring its own (videos/<slug>/scenes/<name>.js).
import buttonSwap from './button-swap.js';
import appBadge from './app-badge.js';
import listActions from './list-actions.js';
import slashMenu from './slash-menu.js';
import dialog from './dialog.js';
import setting from './setting.js';
import commandPalette from './command-palette.js';
import notification from './notification.js';

export const SCENES = Object.fromEntries([buttonSwap, appBadge, listActions, slashMenu, dialog, setting, commandPalette, notification].map(s => [s.name, s]));
