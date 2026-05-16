export class PartialSizeStat {

	/** Latest rendered item size. */
	private averageSize: number = 0

	/** Clear all stat data. */
	reset() {
		this.averageSize = 0
	}

	/** After every time rendered, update indices and sizes. */
	updateRange(count: number, renderedSize: number) {
		if (count === 0 || renderedSize === 0) {
			return
		}

		let size = renderedSize / count

		// Mix with old size, to make sure it doesn't change too much.
		if (this.averageSize > 0) {
			size = size * 0.5 + this.averageSize * 0.5
		}

		this.averageSize = size
	}

	/** Get latest item size. */
	getAverageSize(): number {
		return this.averageSize
	}
}


/** Get change rate. */
export function getChangeRate(from: number, to: number): number {
	if (from === 0 && to === 0) {
		return 0
	}

	return Math.abs(from - to) / Math.max(from, to)
}