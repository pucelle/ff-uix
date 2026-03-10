import {getChangeRate, PartialSizeStat} from './partial-size-stat'
import {DirectionalOverflowAccessor} from './directional-overflow-accessor'
import {barrierDOMReading} from 'lupos'
import {Component} from 'lupos.html'


export type UnCoveredDirection =
	'partial-start'		// Not fully covered at start
	| 'partial-end'		// Not fully covered at end
	| 'no-intersection'	// Have no intersection, ust re-render totally by current scroll position.
	| 'out-view-start'	// Out-of-view at start.
	| 'out-view-end'	// Out-of-view at end.


interface LatestIndices {
	
	/** Latest start index when last time measuring. */
	startIndex: number

	/** Latest end index when last time measuring. */
	endIndex: number

}

interface LatestSliderProperties {

	/** 
	 * Latest start position of visible part relative to slider start position.
	 * update it after every time rendered.
	 * Readonly outside.
	 */
	startPosition: number

	/** 
	 * Latest end position of visible part relative to slider start position,
	 * update it after every time rendered.
	 * Readonly outside.
	 */
	endPosition: number
}


/** 
 * Indicates a continuous render range, which can help
 * to calc item size more preciously.
 */
interface ContinuousRenderRange {
	startIndex: number
	endIndex: number
	startPosition: number
	endPosition: number
}


/**
 * It help to do measurement for PartialRenderer,
 * and cache latest render result for it.
 * And help to assist next time rendering.
 */
export abstract class MeasurementBase {

	protected readonly scroller: HTMLElement
	protected readonly slider: HTMLElement
	protected readonly repeat: HTMLElement
	protected readonly context: Component

	/** Do rendered item size statistic, guess item size. */
	protected readonly stat: PartialSizeStat = new PartialSizeStat()

	/** Help to get and set based on overflow direction. */
	protected readonly doa: DirectionalOverflowAccessor

	/** Indicates a continuous render range to make it more precisely to compute item size. */
	protected continuousRenderRange: ContinuousRenderRange | null = null

	/** Initial item size, now valid after measured. */
	protected guessedItemSize: number = 0

	/** 
	 * Latest scroller size.
	 * Readonly outside.
	 */
	scrollerSize: number = 0

	/** Latest start and end indices when last time measuring. */
	indices: LatestIndices = {
		startIndex: 0,
		endIndex: 0,
	}

	/** 
	 * Latest slider position properties use when last time measuring,
	 * thus, can reuse it to do continuous layout measurement.
	 */
	sliderPositions: LatestSliderProperties = {
		startPosition: 0,
		endPosition: 0,
	}

	constructor(
		scroller: HTMLElement,
		slider: HTMLElement,
		repeat: HTMLElement,
		context: Component,
		doa: DirectionalOverflowAccessor
	) {
		this.scroller = scroller
		this.slider = slider
		this.repeat = repeat
		this.context = context
		this.doa = doa
	}

	/** Directly set but not read scroller size. */
	setScrollerSize(size: number) {
		this.scrollerSize = size
	}

	/** Read new scroller size. */
	async readScrollerSize() {
		await barrierDOMReading()
		this.scrollerSize = this.doa.getClientSize(this.scroller)
	}

	/** 
	 * Guess an item size for first-time paint,
	 * and avoid it checking for item-size and render twice when initialization.
	 */
	setGuessedItemSize(size: number) {
		let medianSize = this.stat.getMedianSize()
		if (getChangeRate(size, medianSize) > 0.33) {
			this.stat.reset()
		}
		this.guessedItemSize = size
	}

	/* Whether has measured or specified guessed item size. */
	hasMeasured(): boolean {
		return this.getMedianItemSize() > 0
	}

	/** Get item size. */
	getAverageItemSize(): number {
		return this.stat.getAverageSize() || this.guessedItemSize
	}

	/** 
	 * Get median item size.
	 * Prefer median size because sometimes there are few like expanded item existing.
	 */
	getMedianItemSize(): number {
		return this.stat.getMedianSize() || this.guessedItemSize
	}

	/** 
	 * Get safe render count of items to render.
	 * If `proposed` specified, and finally render count close to it, will use it.
	 */
	getSafeRenderCount(reservedPixels: number, proposed: number): number {
		if (this.scrollerSize === 0) {
			return 1
		}

		let itemSize = this.getMedianItemSize()
		if (itemSize === 0) {
			return 1
		}

		// Because normally can scroll twice per frame.
		let totalSize = this.scrollerSize + reservedPixels
		let minimumCount = this.scrollerSize / itemSize
		let count = totalSize / itemSize

		if (Math.abs(count - proposed) < 0.5 && proposed > minimumCount) {
			return proposed
		}

		return Math.ceil(totalSize / itemSize)
	}

	/** If re-render from a new index, call this. */
	breakContinuousRenderRange() {
		this.continuousRenderRange = null
	}

	/** Calc slider position by aligning specified index of item with start or end edge of slider. */
	calcSliderPosition(index: number, _alignAt: 'start' | 'end'): number {
		return this.getMedianItemSize() * index
	}

	/** 
	 * Calc scroll position by aligning specified index of item with start or end edge of slider.
	 * Normally it equals `start slider position`, or `end position - scroller size`.
	 */
	calcScrollPosition(index: number, alignAt: 'start' | 'end'): number {
		if (alignAt === 'start') {
			return this.calcSliderPosition(index, alignAt)
		}
		else {
			return this.calcSliderPosition(index, alignAt) - this.scrollerSize
		}
	}

	/** Calc new start index by current scrolled position. */
	async calcStartIndexByScrolled(): Promise<number> {
		await barrierDOMReading()
		
		let scrolled = this.doa.getScrolled(this.scroller)
		let sliderInitialOffset = this.doa.getOffset(this.slider.previousElementSibling as HTMLElement, this.scroller)
		let itemSize = this.getMedianItemSize()
		let startIndex = itemSize > 0 ? Math.floor((scrolled - sliderInitialOffset) / itemSize) : 0

		return startIndex
	}

	/** Every time after update complete, do measurement. */
	async measureAfterRendered(startIndex: number, endIndex: number) {

		// Very important, ensure all child complete, but not all complete.
		await this.context.untilChildComplete()

		await barrierDOMReading()

		let sliderInnerSize = this.doa.getInnerSize(this.slider)
		let sliderClientSize = this.doa.getClientSize(this.slider)
		let paddingSize = sliderClientSize - sliderInnerSize
		let oldStartIndex = this.indices.startIndex
		let oldEndIndex = this.indices.endIndex
		
		this.indices.startIndex = startIndex
		this.indices.endIndex = endIndex

		this.updateSliderPositions(sliderClientSize)

		if (this.continuousRenderRange) {
			if (startIndex <= this.continuousRenderRange.startIndex) {
				this.continuousRenderRange.startIndex = startIndex
				this.continuousRenderRange.startPosition = this.sliderPositions.startPosition
			}

			if (endIndex >= this.continuousRenderRange.endIndex) {
				this.continuousRenderRange.endIndex = endIndex
				this.continuousRenderRange.endPosition = this.sliderPositions.endPosition
			}
		}
		else {
			this.continuousRenderRange = {
				startIndex,
				endIndex,
				startPosition: this.sliderPositions.startPosition,
				endPosition: this.sliderPositions.endPosition
			}
		}

		let renderCount = this.continuousRenderRange.endIndex - this.continuousRenderRange.startIndex
		let renderSize = this.continuousRenderRange.endPosition - this.continuousRenderRange.startPosition - paddingSize

		// Avoid update when hidden.
		if (renderCount > 0 && renderSize > 0) {
			this.stat.updateRange(renderCount, renderSize)
		}

		let newRenderedStartIndex = startIndex
		let newRenderedEndIndex = endIndex

		if (startIndex < oldStartIndex) {
			newRenderedStartIndex = startIndex
			newRenderedEndIndex = Math.min(oldStartIndex, endIndex)
		}
		else if (endIndex > oldEndIndex) {
			newRenderedStartIndex = Math.max(oldEndIndex, startIndex)
			newRenderedEndIndex = endIndex
		}

		let newRendered: HTMLElement[] = []
		for (let i = newRenderedStartIndex - startIndex; i < newRenderedEndIndex - startIndex; i++) {
			newRendered.push(this.repeat.children[i] as HTMLElement)
		}

		if (newRendered.length > 0 && newRendered[0].tagName === 'slot') {
			for (let i = 0; i < newRendered.length; i++) {
				newRendered[i] = newRendered[i].firstElementChild as HTMLElement
			}
		}

		let newRenderedSizes = newRendered.map(el => this.doa.getClientSize(el))
		this.stat.updateEach(newRenderedSizes)
	}

	/** Update current slider positions. */
	protected abstract updateSliderPositions(sliderClientSize: number): void

	/** 
	 * Set start position, and persist slider size.
	 * Use it only when you will not measure later.
	 */
	resetPositions(startPosition: number) {
		let diff = startPosition - this.sliderPositions.startPosition
		this.sliderPositions.startPosition = startPosition
		this.sliderPositions.endPosition += diff
	}

	/** Calculate a rough front placeholder sizes. */
	getNormalFrontPlaceholderSize(startIndex: number): number {
		let itemSize = this.getMedianItemSize()
		return itemSize * startIndex
	}

	/** Calculate a rough back placeholder sizes. */
	getNormalBackPlaceholderSize(endIndex: number, dataCount: number): number {
		let itemSize = this.getMedianItemSize()
		return itemSize * (dataCount - endIndex)
	}

	/** Fix front placeholder size to limit it in range. */
	fixFrontPlaceholderSize(frontSize: number, startIndex: number): number {
		let normalSize = this.getNormalFrontPlaceholderSize(startIndex)

		// Limit by normal size if not change much.
		if (getChangeRate(frontSize, normalSize) > 0.33) {
			frontSize = normalSize
		}

		if (startIndex === 0) {
			frontSize = 0
		}

		return frontSize
	}

	/** Fix back placeholder size to limit it in range. */
	fixBackPlaceholderSize(backSize: number, endIndex: number, dataCount: number): number {
		let normalSize = this.getNormalBackPlaceholderSize(endIndex, dataCount)

		// Limit by normal size if changed much.
		if (getChangeRate(backSize, normalSize) > 0.33) {
			backSize = normalSize
		}

		return backSize
	}

	/** Check cover situation and decide where to render more contents. */
	abstract checkUnCoveredDirection(reservedPixels: number, alignDirection: 'start' | 'end'): Promise<UnCoveredDirection | null>
}