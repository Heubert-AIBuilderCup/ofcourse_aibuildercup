// opentype.js 2.0.0 ships no types: the part of its API the layout engine uses.

declare module 'opentype.js' {
  export interface Font {
    /** Advance width of `text` in px at `fontSize`, kerning applied. */
    getAdvanceWidth(text: string, fontSize: number, options?: { kerning?: boolean }): number
    /** Whether the font's cmap maps `char` (one code point) to a glyph other than .notdef. */
    hasChar(char: string): boolean
    /** The options every measure starts from; `features` lists the OpenType tags applied per script. */
    defaultRenderOptions: { features: { script: string; tags: string[] }[] }
  }
  export function parse(buffer: ArrayBuffer): Font
}
