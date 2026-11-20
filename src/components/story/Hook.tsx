interface HookProps {
  /** The WordPress name, which is also its hover card's name. */
  readonly name: string;
}

/**
 * A WordPress name in the copy, as a focusable code word. A plain (server-renderable) component:
 * HookCard opens its card from delegated hover, focus and tap listeners on `[data-card]`.
 */
export function Hook({ name }: HookProps) {
  return (
    <code data-card={name} tabIndex={0}>
      {name}
    </code>
  );
}
