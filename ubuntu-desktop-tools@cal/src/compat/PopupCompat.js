import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

export function createNonReactiveMenuItem() {
    return new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
}
