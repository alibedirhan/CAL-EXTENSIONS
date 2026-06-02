// Lightweight markup model for notes. The editor stores plain text with simple
// markers; the detail/preview render turns those markers into Pango markup.
//
//   **bold**            → bold text
//   {renk}metin{/}      → coloured text  (renk: named colour below)
//   * / - line prefix   → bullet list line (handled in the panel)
//   `cmd` or < cmd >    → command block    (handled in the panel)

// Named colours, Turkish + English aliases → hex. Used by the toolbar palette
// and the {name}…{/} marker parser.
export const NOTE_COLORS = [
    {name: 'kırmızı', aliases: ['kirmizi', 'red'],    hex: '#ff6b5e', label: 'Kırmızı'},
    {name: 'turuncu', aliases: ['orange'],            hex: '#e95420', label: 'Turuncu'},
    {name: 'sarı',    aliases: ['sari', 'yellow'],    hex: '#f5c451', label: 'Sarı'},
    {name: 'yeşil',   aliases: ['yesil', 'green'],    hex: '#7bd88f', label: 'Yeşil'},
    {name: 'mavi',    aliases: ['blue'],              hex: '#6db3f2', label: 'Mavi'},
    {name: 'mor',     aliases: ['purple', 'mor'],     hex: '#c08cf0', label: 'Mor'},
];

function colorHex(name) {
    const key = String(name ?? '').trim().toLocaleLowerCase('tr-TR');
    for (const color of NOTE_COLORS) {
        if (color.name === key || color.aliases.includes(key))
            return color.hex;
    }
    return null;
}

// Escape the characters Pango markup treats specially. Done first, before our
// ASCII markers are turned into tags, so user text can never inject markup.
export function escapeMarkup(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// Turn one already-escaped line of text into Pango markup, applying bold and
// colour markers. Markers that don't resolve are left as plain (escaped) text.
export function inlineMarkup(line) {
    let out = escapeMarkup(line);
    // Bold: **text** (non-greedy, must contain at least one char)
    out = out.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    // Colour: {name}text{/}
    out = out.replace(/\{([^{}]+)\}([\s\S]*?)\{\/\}/g, (match, name, inner) => {
        const hex = colorHex(name);
        return hex ? `<span foreground="${hex}">${inner}</span>` : match;
    });
    return out;
}
