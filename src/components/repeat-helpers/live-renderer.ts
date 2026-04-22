import {ResizeWatcher} from 'ff-kit'
import {DirectionalOverflowAccessor} from './directional-overflow-accessor'
import {LiveMeasurement} from './live-measurement'
import {barrierDOMReading, barrierDOMWriting} from 'lupos'
import {Component} from 'lupos.html'
import {RendererBase} from './base-renderer'


/**
 * What a live renderer do:
 *
 * When initialize or update from applying start index:
 * - Update indices.
 * - Update placeholder height and scroll position.
 * - Cause scroll event dispatched
 * - Validate scroll viewport coverage and re-render if required.
 * 
 * When scrolling up or down / left or right:
 * - Validate scroll viewport coverage and adjust `startIndex`
 *   or `endIndex` a little if not fully covered.
 */
export class LiveRenderer extends RendererBase {

	declare measurement: LiveMeasurement
	declare readonly frontPlaceholder: null
	declare readonly backPlaceholder: null

	/** 
	 * Whether partial rendering content as follower,
	 * so the partial renderer only renders by current scroll position,
	 * and will never cause scroll position change.
	 */
	readonly asFollower: boolean

	/** If provided and not 0, will use it forever and never read scroller size. */
	private directScrollerSize: number = 0

	/** The only placeholder. */
	private placeholder: HTMLDivElement | null

	constructor(
		scroller: HTMLElement,
		slider: HTMLElement,
		repeat: HTMLElement,
		context: Component,
		doa: DirectionalOverflowAccessor,
		updateCallback: () => void,
		onAfterMeasured: () => void,
		placeholder: HTMLDivElement | null,
		asFollower: boolean
	) {
		super(scroller, slider, repeat, context, doa, updateCallback, onAfterMeasured)
		this.placeholder = placeholder
		this.asFollower = asFollower
	}

	protected override initMeasurement() {
		return new LiveMeasurement(this.scroller, this.slider, this.repeat, this.context, this.doa)
	}

	protected override initScrollerSize() {
		if (!this.directScrollerSize) {
			super.initScrollerSize()
		}
	}

	protected override disposeScrollerSize() {
		if (!this.directScrollerSize) {
			super.disposeScrollerSize()
		}

		// For restoring scroll position later.
		// Here can't `barrierDOMReading`, or it delays node removing,
		// can cause element existing with it's toggling content at same time.
		if (!this.asFollower) {
			this.setRenderIndices('start', this.locateVisibleIndex('start'))
		}
	}

	/** Set `preEndPositions` before updating. */
	setPreEndPositions(positions: number[] | null) {
		this.measurement.setPreEndPositions(positions)
	}

	/** If provided and not 0, will use it and not read scroller size. */
	setDirectScrollSize(size: number) {
		this.directScrollerSize = size
		this.measurement.setScrollerSize(size)
		ResizeWatcher.unwatch(this.scroller, this.readScrollerSize, this)
	}

	protected override async resetPositions(
		resetScroll: boolean,
		alignToStartIndex: number = this.startIndex,
		alignToEndIndex: number = this.endIndex
	) {
		// top or bottom position.
		let newSliderPosition = this.measurement.calcSliderPosition(this.alignDirection === 'start' ? this.startIndex : this.endIndex, this.alignDirection)
		
		await this.setPosition(newSliderPosition)

		// Break continuous render range.
		this.measurement.breakContinuousRenderRange()

		if (resetScroll && !this.asFollower) {
			alignToStartIndex = Math.min(Math.max(alignToStartIndex, this.startIndex), this.endIndex - 1)
			alignToEndIndex = Math.max(Math.min(alignToEndIndex, this.endIndex), this.startIndex)

			// Align scroller start with slider start.
			let scrollPosition = this.measurement.calcScrollPosition(
				this.alignDirection === 'start' ? alignToStartIndex : alignToEndIndex,
				this.alignDirection
			)

			// Align scroller end with slider end.
			if (this.alignDirection === 'end') {
				scrollPosition -= this.measurement.scrollerSize
			}

			await barrierDOMWriting()
			this.doa.setScrolled(this.scroller, scrollPosition)
			this.justSetScrolled()
						
			// if trying to align with index 1, and because have not much data and finally renders 0~?,
			// And if element at index 0 is only a title have very little height
			if (this.alignDirection === 'start' && alignToStartIndex > this.startIndex) {
				this.needToAlign = {
					index: alignToStartIndex,
					scrolled: scrollPosition,
					offset: scrollPosition,
				}
			}
			else if (this.alignDirection === 'end' && alignToEndIndex < this.endIndex) {
				this.needToAlign = {
					index: alignToEndIndex,
					scrolled: scrollPosition,
					offset: scrollPosition + this.measurement.scrollerSize,
				}
			}
		}
	}

	protected override async setPosition(position: number) {
		await barrierDOMWriting()

		if (this.alignDirection === 'start') {
			this.doa.setStartPosition(this.slider, position + 'px')
			this.doa.setEndPosition(this.slider, 'auto')
		}
		else {
			this.doa.setStartPosition(this.slider, 'auto')
			this.doa.setEndPosition(this.slider, this.measurement.scrollerSize - position + 'px')
		}
	}

	protected override async setRestSize() {
		if (!this.placeholder) {
			return
		}

		// Not update when scrolling up.
		if (this.alignDirection === 'end') {
			return
		}
		
		// Calc back size by last time rendering result.
		let oldBackSize = this.measurement.placeholderSize - this.measurement.sliderPositions.endPosition
		let fixedBackSize = this.measurement.fixBackPlaceholderSize(oldBackSize, this.measurement.indices.endIndex, this.dataCount)

		// Update back size only when have much rate of difference.
		if (fixedBackSize !== oldBackSize) {
			await this.setPlaceholderSize(this.measurement.sliderPositions.endPosition + fixedBackSize)
		}
	}

	/** Set size for the only placeholder. */
	protected async setPlaceholderSize(size: number) {
		if (!this.placeholder) {
			return
		}
		
		await barrierDOMWriting()
		this.doa.setSize(this.placeholder, size)
		this.measurement.setPlaceholderSize(size)
	}

	protected override async afterMeasured() {

		// When reach start index but may not reach scroll start.
		if (this.startIndex === 0 && this.endIndex > 0 && this.alignDirection === 'end') {
			this.alignDirection = 'start'
			await this.setNeedToAlign(0)

			// Will not measure again, so need to reset positions.
			await this.setPosition(0)
			this.measurement.resetPositions(0)

			await this.alignByResettingScroll()
		}

		// Front placeholder have too much difference when scrolling up.
		// Assume we have a title have 50px, and other contents are all 200px.
		// else if (this.alignDirection === 'end') {
		// 	let frontSize = this.measurement.sliderPositions.startPosition
		// 	let fixedFrontSize = this.measurement.fixFrontPlaceholderSize(frontSize, this.startIndex)

		// 	if (fixedFrontSize !== frontSize) {
		// 		let diff = fixedFrontSize - frontSize
		// 		let newStartPosition = this.measurement.sliderPositions.startPosition + diff
		// 		let newEndPosition = this.measurement.sliderPositions.endPosition + diff

		// 		await this.setNeedToAlign(0)

		// 		// Will not measure again, so need to reset positions.
		// 		await this.setPosition(newEndPosition)
		// 		this.measurement.resetPositions(newStartPosition)

		// 		await this.alignByResettingScroll()
		// 	}
		// }

		// When reach end index but not scroll end.
		if (this.endIndex === this.dataCount) {

			// Placeholder size should be keep consistent with end position.
			await this.setPlaceholderSize(this.measurement.sliderPositions.endPosition)
		}

		// When scrolling down, and reach scroll end but not end index.
		// This is very rare because we have updated placeholder size using previously measured.
		else if (this.alignDirection === 'start') {
			let oldBackSize = this.measurement.placeholderSize - this.measurement.sliderPositions.endPosition
			if (oldBackSize < 0) {
				await this.setRestSize()
			}
		}

		super.afterMeasured()
	}

	/** Do element alignment by adjusting scroll offset. */
	protected async alignByResettingScroll() {
		let needToAlign = this.needToAlign
		if (!needToAlign) {
			return
		}

		this.needToAlign = null
		await barrierDOMReading()

		let child = this.getRepeatChild(needToAlign.index - this.startIndex)
		let newAlignOffset = this.doa.getOffset(child, this.scroller)
		let offsetDiff = newAlignOffset - needToAlign.offset

		if (Math.abs(offsetDiff) > 5) {
			await barrierDOMWriting()
			let scrolled = this.doa.getScrolled(this.scroller)
			this.doa.setScrolled(this.scroller, scrolled + offsetDiff)
			this.justSetScrolled()
		}
	}

	/** Get new position for continuously update. */
	protected override async getContinuousPosition(oldStartIndex: number, alignDirection: 'start' | 'end') {
		await barrierDOMReading()
		let position: number

		if (alignDirection === 'start') {
			let elIndex = this.startIndex - oldStartIndex
			let el = this.getRepeatChild(elIndex)

			// If el located at start, it will move by slider padding top,
			// to keep it's position, should remove slider padding.
			position = this.measurement.sliderPositions.startPosition
				+ this.doa.getOuterOffset(el, this.slider)
				- this.doa.getStartPadding(this.slider)
		}

		// Scrolling up, render more at end.
		else {
			let elIndex = this.endIndex - oldStartIndex - 1
			let el = this.getRepeatChild(elIndex)

			await barrierDOMReading()

			// If el located at end, it will move up by slider padding bottom,
			// to keep it's position, should add slider bottom padding.
			position = this.measurement.sliderPositions.startPosition
				+ this.doa.getEndOuterOffset(el, this.slider)
				+ this.doa.getEndPadding(this.slider)
		}

		return position
	}
}