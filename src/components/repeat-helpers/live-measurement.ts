import {ValueListUtils} from 'ff-kit'
import {barrierDOMReading} from 'lupos'
import {MeasurementBase, UnCoveredDirection} from './base-measurement'


/**
 * It help to do measurement for LiveRenderer,
 * and cache latest render results for them.
 * And help to assist next time rendering.
 */
export class LiveMeasurement extends MeasurementBase {

	/** 
	 * If provided, it specifies the suggested end position of each item,
	 * to indicate the base size of each item.
	 * The size has no need to represent real size,
	 * only represents the mutable part would be enough.
	 * Which means: can ignores shared paddings or margins.
	 */
	private preEndPositions: number[] | null = null

	/** 
	 * The last time placeholder size.
	 * Readonly outside.
	 */
	placeholderSize: number = 0

	/** Set `preEndPositions` before updating. */
	setPreEndPositions(positions: number[] | null) {
		this.preEndPositions = positions
	}

	calcScrollPosition(index: number, alignAt: 'start' | 'end'): number {
		if (this.preEndPositions) {
			if (alignAt === 'start') {
				let start = index > 0 ? this.preEndPositions[index - 1] : 0
				return start
			}
			else {
				let end = index > 0 ? this.preEndPositions[index - 1] : 0
				return end
			}
		}
		else {
			if (alignAt === 'start') {
				return this.getMedianItemSize() * index
			}
			else {
				return this.getMedianItemSize() * index + this.scrollerSize
			}
		}
	}

	override async calcStartIndexByScrolled(): Promise<number> {
		await barrierDOMReading()

		let scrolled = this.doa.getScrolled(this.scroller)

		if (this.preEndPositions) {
			let startIndex = ValueListUtils.binaryFindInsertIndex(this.preEndPositions, scrolled)
			return startIndex
		}
		else {
			let itemSize = this.getMedianItemSize()
			let startIndex = itemSize > 0 ? Math.floor(scrolled / itemSize) : 0

			return startIndex
		}
	}

	protected override updateSliderPositions(sliderClientSize: number) {

		// offsetTop = top + marginTop, here ignores margin top.
		this.sliderPositions.startPosition = this.doa.getOffset(this.slider, this.scroller)
		this.sliderPositions.endPosition = this.sliderPositions.startPosition + sliderClientSize
	}

	/** Calculate the back placeholder size as the only placeholder. */
	getOnlyPlaceholderSize(dataCount: number): number {
		if (this.preEndPositions) {
			let end = this.preEndPositions.length > 0 ? this.preEndPositions[this.preEndPositions.length - 1] : 0
			return end
		}

		let itemSize = this.getMedianItemSize()

		// Can reuse previous measured end slider position properties.
		if (this.indices.endIndex <= dataCount
			&& this.indices.endIndex > 0
			&& this.sliderPositions.endPosition > 0
		) {
			return this.sliderPositions.endPosition + itemSize * (dataCount - this.indices.endIndex)
		}

		// Can reuse previous measured start slider position properties.
		if (this.indices.startIndex <= dataCount
			&& this.indices.startIndex > 0
			&& this.sliderPositions.startPosition > 0
		) {
			return this.sliderPositions.startPosition + itemSize * (dataCount - this.indices.startIndex)
		}

		return itemSize * dataCount
	}

	/** Use the size of the only placeholder. */
	setPlaceholderSize(size: number) {
		this.placeholderSize = size
	}

	override async checkUnCoveredDirection(reservedPixels: number): Promise<UnCoveredDirection | null> {
		await barrierDOMReading()

		let scrollerSize = this.doa.getClientSize(this.scroller)
		let sliderSize = this.doa.getClientSize(this.slider)
		let scrolled = this.doa.getScrolled(this.scroller)
		let sliderStart = this.sliderPositions.startPosition - scrolled
		let sliderEnd = sliderStart + sliderSize
	
		// No intersection, reset indices by current scroll position.
		let hasNoIntersection = sliderEnd < 0 || sliderStart > scrollerSize
		if (hasNoIntersection) {
			return 'no-intersection'
		}

		// Can't cover and need to render more items at top/left.
		else if (sliderStart - 1 + reservedPixels > 0) {
			return 'partial-start'
		}

		// Can't cover and need to render more items at bottom/right.
		else if (sliderEnd + 1 - reservedPixels < scrollerSize) {
			return 'partial-end'
		}

		// No need to render more.
		return null
	}
}