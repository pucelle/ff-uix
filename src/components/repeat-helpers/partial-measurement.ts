import {barrierDOMReading} from 'lupos'
import {MeasurementBase, UnCoveredDirection} from './base-measurement'


/**
 * It help to do measurement for PartialRenderer,
 * and cache latest render result for it.
 * And help to assist next time rendering.
 */
export class PartialMeasurement extends MeasurementBase {

	/** 
	 * The initial slider position relative to whole scroll content,
	 * Only affected by contents before slider.
	 */
	initialPosition: number = 0

	/** Size of latest back placeholder that after slider. */
	backPlaceholderSize: number = 0

	/** Get size of latest front placeholder that before slider. */
	get frontPlaceholderSize() {
		return this.sliderPositions.startPosition
	}

	calcScrollPosition(index: number, alignAt: 'start' | 'end'): number {
		if (alignAt === 'start') {
			return this.getMedianItemSize() * index + this.initialPosition
		}
		else {
			return this.getMedianItemSize() * index + this.scrollerSize + this.initialPosition
		}
	}

	protected updateSliderPositions(sliderClientSize: number) {

		// front placeholder size will be set by `setFrontPlaceholderSize`.
		this.initialPosition = this.doa.getOffset(this.slider.previousElementSibling as HTMLElement, this.scroller)
		this.sliderPositions.endPosition = this.sliderPositions.startPosition + sliderClientSize
	}

	/** Set front placeholder size. */
	setFrontPlaceholderSize(frontSize: number) {
		this.sliderPositions.startPosition = frontSize
	}

	/** Set back placeholder size. */
	setBackPlaceholderSize(backSize: number) {
		this.backPlaceholderSize = backSize
	}

	/** Check cover situation and decide where to render more contents. */
	async checkUnCoveredDirection(reservedPixels: number, alignDirection: 'start' | 'end'): Promise<UnCoveredDirection | null> {
		await barrierDOMReading()

		let scrollerSize = this.doa.getClientSize(this.scroller)
		let sliderSize = this.doa.getClientSize(this.slider)
		let scrolled = this.doa.getScrolled(this.scroller)
		let initialPosition = this.doa.getOffset(this.slider.previousElementSibling as HTMLElement, this.scroller)
		let scrollerStart = initialPosition - scrolled
		let sliderStart = this.frontPlaceholderSize + scrollerStart
		let sliderEnd = sliderStart + sliderSize
		let scrollerEnd = sliderEnd + this.backPlaceholderSize

		// Out-of-view at start.
		if (scrollerEnd < 0) {
			return 'out-view-start'
		}

		// Out-of-view at end.
		if (scrollerStart > scrollerSize) {
			return 'out-view-end'
		}
	
		// No intersection, reset indices by current scroll position.
		let hasNoIntersection = sliderEnd < 0 || sliderStart > scrollerSize
		if (hasNoIntersection) {
			return 'no-intersection'
		}

		// Can't cover and need to render more items at top/left.
		// The `1px` is because sometimes close to edge but have 0.000px diff.
		if (sliderStart - 1 > 0) {
			return 'partial-start'
		}

		// Can't cover and need to render more items at bottom/right.
		if (sliderEnd + 1 < scrollerSize) {
			return 'partial-end'
		}

		// Can't cover and need to render more items at top/left.
		if (alignDirection === 'end' && sliderStart + reservedPixels > 0) {
			return 'partial-start'
		}

		// Can't cover and need to render more items at bottom/right.
		if (alignDirection === 'start' && sliderEnd - reservedPixels < scrollerSize) {
			return 'partial-end'
		}

		// No need to render more.
		return null
	}
}