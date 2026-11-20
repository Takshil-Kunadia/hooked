/**
 * Map sub-labels are set in capitals, like round 5, except code: WordPress names are
 * case-sensitive ('INIT' is not the 'init' hook), so anything that looks like code keeps its case.
 * Code means call syntax, quotes, variables, underscores, `->`/`::`, PHP files or `wp-` file names.
 */
const CODE = /[()'"`$_]|->|::|\.php\b|\bwp-/;

/** The text a sub-label is printed with. */
export function subLabelText(sub: string): string {
  return CODE.test(sub) ? sub : sub.toUpperCase();
}
