/**
 * Keyboard stepping through the story's beats: which keys step, and when the page must leave a key
 * alone because the focused element uses it (Space or Enter activates a summary, button or link;
 * text entry uses every key).
 */

export interface KeyLike {
  readonly key: string;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
}

/** The part of a DOM element the focus check reads, so it runs without a DOM. */
export interface ElementLike {
  readonly tagName: string;
  /** True anywhere inside editable content (the DOM inherits it down the tree). */
  readonly isContentEditable?: boolean;
  readonly parentElement: ElementLike | null;
}

const FORWARD = new Set(["ArrowDown", "PageDown"]);
const BACKWARD = new Set(["ArrowUp", "PageUp"]);
const SPACE = " ";

/**
 * ↓, PageDown and Space step forward; ↑, PageUp and Shift+Space step back. Ctrl, Alt and Meta
 * combinations belong to the browser, and Shift with an arrow or page key extends a selection.
 */
export function stepDirection(e: KeyLike): 1 | -1 | null {
  if (e.altKey || e.ctrlKey || e.metaKey) return null;
  if (e.key === SPACE) return e.shiftKey ? -1 : 1;
  if (e.shiftKey) return null;
  if (FORWARD.has(e.key)) return 1;
  if (BACKWARD.has(e.key)) return -1;
  return null;
}

/** Controls that use every key: typing, moving the caret, picking an option. */
const TEXT_ENTRY_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);
/** Controls that Space and Enter activate; the arrow and page keys still step past them. */
const ACTIVATOR_TAGS = new Set(["BUTTON", "SUMMARY", "A"]);
const ACTIVATING_KEYS = new Set([SPACE, "Enter"]);

/**
 * True when the focused element (or an ancestor) uses `key` itself, so the page must not step:
 * text entry and editable content keep every key; a summary, button or link keeps Space and Enter.
 */
export function focusOwnsKey(el: ElementLike | null, key: string): boolean {
  const activating = ACTIVATING_KEYS.has(key);
  for (let node = el; node; node = node.parentElement) {
    const tag = node.tagName.toUpperCase();
    if (node.isContentEditable === true || TEXT_ENTRY_TAGS.has(tag)) return true;
    if (activating && ACTIVATOR_TAGS.has(tag)) return true;
  }
  return false;
}
