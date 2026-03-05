import {MedianHeap} from 'lupos'


export class PartialSizeStat {

	/** Latest rendered item size. */
	private averageSize: number = 0

	/** Cache item sizes, sort from lower to upper. */
	private heap: MedianHeap<number> = new MedianHeap((a, b) => a - b)

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

	/** Update for each newly rendered item sizes. */
	updateEach(itemSizes: number[]) {
		let heapSize = this.heap.size

		for (let size of itemSizes) {
			this.heap.add(size)
			heapSize++
			
			if (heapSize > 100) {

				// Remove larger index, then smaller.
				this.heap.popTails()
	
				heapSize -= 2
			}
		}
	}

	/** Get latest item size. */
	getAverageSize(): number {
		return this.averageSize
	}

	/** Get median item size. */
	getMedianSize(): number {
		return this.heap.median ?? 0
	}
}


/** Get change rate. */
export function getChangeRate(from: number, to: number): number {
	if (from === 0 && to === 0) {
		return 0
	}

	return Math.abs(from - to) / Math.max(from, to)
}