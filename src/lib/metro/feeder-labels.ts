/** Where the feeder-line labels sit, shared by the scene and the camera's framing of them. */

/** Round 5's feeder labels sit this far past the line's outer end. */
export const FEEDER_LABEL_END_OFFSET = 1.2;
/** Labels that would collide move one row further out (neighbours in the row). */
export const FEEDER_LABEL_ROW_STEP = 1.15;
/** The most rows four feeder labels can stack into: the worst case a framing has to hold. */
export const FEEDER_LABEL_MAX_ROW = 1;
/** Widest half-width of a feeder label's text, in world units ("mu-plugins line"). */
export const FEEDER_LABEL_HALF_WIDTH = 1.3;
