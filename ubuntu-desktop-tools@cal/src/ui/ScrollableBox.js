import St from 'gi://St';
import {boxLayout} from '../compat/UiCompat.js';

export function clearActor(actor) {
    if (!actor) return;
    try {
        for (const child of actor.get_children())
            child.destroy();
    } catch (_error) {}
}

function addChild(parent, child) {
    if (!parent || !child) return;
    try { parent.add_child(child); return; } catch (_error) {}
    try { parent.add_actor(child); return; } catch (_error) {}
    try { parent.set_child(child); } catch (_error) {}
}

export function createVerticalScrollBox({scrollStyleClass, viewportStyleClass = 'udt-scroll-viewport', contentStyleClass, width, height}) {
    const scroll = new St.ScrollView({
        style_class: scrollStyleClass,
        overlay_scrollbars: true,
        x_expand: false,
        y_expand: false,
        reactive: true,
    });
    scroll.set_size(width, height);
    try { scroll.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC); } catch (_error) {}

    const viewport = new St.Viewport({
        style_class: viewportStyleClass,
        x_expand: false,
        y_expand: false,
    });
    viewport.set_size(width, height);

    const content = boxLayout({
        vertical: true,
        style_class: contentStyleClass,
        x_expand: false,
        y_expand: false,
    });
    content.set_width(width);

    addChild(viewport, content);
    try { scroll.add_actor(viewport); } catch (_error) { addChild(scroll, viewport); }

    return {scroll, viewport, content};
}
