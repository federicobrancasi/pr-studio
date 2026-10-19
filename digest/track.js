// Where a recorded mark is in a frame of its recording: shared by `prs digest` (Node) and the player (the page).

/**
 * The mark's tracked box ([x, y, w, h], window pixels) at t (seconds of the recording), or null when it isn't on
 * screen then: outside its visible windows, or no sample within 0.3 s.
 */
export function trackBoxAt(mark, t) {
	if (!mark?.visible?.some(([a, b]) => t >= a - 0.05 && t <= b + 0.05)) {
		return null;
	}
	let best = null;
	for (const s of mark.track ?? []) {
		if (!best || Math.abs(s[0] - t) < Math.abs(best[0] - t)) {
			best = s;
		}
	}
	return best && Math.abs(best[0] - t) <= 0.3 ? best.slice(1) : null;
}
