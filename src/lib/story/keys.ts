/**
 * Keyboard stepping through the story's beats: which keys step, and when the page must leave a key
 * alone because the focused element uses it (Space or Enter activates a summary, button or link).
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

const INTERACTIVE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT", "BUTTON", "SUMMARY", "A"]);

/** True when the element, or one of its ancestors, is a form control, summary, button, link or editable. */
export function isInteractive(el: ElementLike | null): boolean {
  for (let node = el; node; node = node.parentElement) {
    if (node.isContentEditable === true || INTERACTIVE_TAGS.has(node.tagName.toUpperCase())) return true;
  }
  return false;
}
