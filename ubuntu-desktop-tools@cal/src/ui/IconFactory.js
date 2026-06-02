import St from 'gi://St';
import Clutter from 'gi://Clutter';

export function symbolicIcon(iconName, styleClass = 'udt-symbolic-icon', size = 16) {
    if (!iconName)
        return new St.Label({text: '•', style_class: styleClass, x_align: Clutter.ActorAlign.CENTER, y_align: Clutter.ActorAlign.CENTER});

    return new St.Icon({
        icon_name: iconName,
        icon_size: size,
        style_class: styleClass,
        x_align: Clutter.ActorAlign.CENTER,
        y_align: Clutter.ActorAlign.CENTER,
    });
}

export function iconBin(iconName, styleClass = 'udt-icon-bin', iconStyleClass = 'udt-symbolic-icon', size = 16, width = 28, height = 28) {
    const icon = symbolicIcon(iconName, iconStyleClass, size);
    const bin = new St.Bin({
        style_class: styleClass,
        x_align: Clutter.ActorAlign.CENTER,
        y_align: Clutter.ActorAlign.CENTER,
        child: icon,
        x_expand: false,
        y_expand: false,
    });
    bin.set_size(width, height);
    return bin;
}
