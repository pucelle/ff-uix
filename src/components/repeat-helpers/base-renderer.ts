import {ResizeWatcher, sleep} from 'ff-kit'
import {locateVisibleIndex} from './index-locator'
import {DirectionalOverflowAccessor} from './directional-overflow-accessor'
import {DOMEvents, barrierDOMReading, barrierDOMWriting} from 'lupos'
import {Component} from 'lupos.html'
import {MeasurementBase} from './base-measurement'


export interface NeedToApply {

	/** 
	 * Latest `startIndex` property has changed and need to be applied.
	 * Soon need to re-render according to the new start index.
	 * Note it was initialized as `0`.
	 * When `alignDirection=start`, it must exist.
	 */
	startIndex: number | undefined

	/** Latest `alignDirection` property has changed and need to be applied. */
	alignDirection: 'start' | 'end'

	/** 
	 * Latest `endIndex` property has changed and need to be applied.
	 * When `alignDirection=end`, it must exist.
	 */
	endIndex: number | undefined

	/** 
	 * If is `true`, will try to persist current scroll position,
	 * by adjusting `startIndex` or `endIndex`.
	 */
	tryPersistContinuous: boolean
}


/** Need to validate it's offset position after measured. */
export interface NeedToAlign {
	el: HTMLElement

	/** Scroll position may change because of rendering and reading size of previous content. */
	scrolled: number

	/** Offset relative to scroller. */
	offset: number
}


enum ScrollState {
	None,
	SetManually,
	FromInteraction,
}


/**
 * What a visible renderer do:
 *
 * When initialize or update from applying start index:
 * - Update indices.
 * - Update placeholder height and scroll position.
 * - Cause scroll event dispatched
 * 
 * When scrolling up or down / left or right:
 * - Validate placeholder intersection ratio and adjust `startIndex`
 *   or `endIndex` a little if not fully covered.
 */
export abstract class RendererBase {

	readonly scroller: HTMLElement
	readonly slider: HTMLElement
	readonly repeat: HTMLElement
	readonly context: Component
	readonly updateCallback: () => void

	/** Do rendered items measurement. */
	readonly measurement: MeasurementBase

	/** Help to get and set based on overflow direction. */
	readonly doa: DirectionalOverflowAccessor

	/** 
	 * How many pixels to reserve to reduce update frequency when scrolling.
	 * Normally it should be at least 200.
	 */
	reservedPixels: number = 200

	/** Total data count. */
	dataCount: number = 0

	/** 
	 * Latest align direction.
	 * If `start`, `sliderStartPosition` is prepared immediately, and `sliderEndPosition` is prepared after rendered.
	 * Otherwise `sliderEndPosition` is prepared immediately, and `sliderStartPosition` is prepared after rendered.
	 * Readonly outside.
	 */
	alignDirection: 'start' | 'end' = 'start'

	/** 
	 * The start index of the first item in the whole data.
	 * Readonly outside.
	 */
	startIndex: number = 0

	/**
	 * The end slicing index of the live data.
	 * Readonly outside.
	 */
	endIndex: number = 0

	/** Whether connected. */
	protected connected: boolean = false

	/** If slider size updating come from own updating, prevent it. */
	protected throttlingSliderSizeUpdate: boolean = true

	/** Indices and align direction that need to apply. */
	protected needToApply: NeedToApply | null = null

	/** Need to check coverage and do update. */
	protected needToCheckCoverage: boolean = false

	/** If need to align element in same position. */
	protected needToAlign: NeedToAlign | null = null

	/** Resolved after scroller size read. */
	protected readScrollerSizePromise: Promise<void> | null = null

	/** Scroll state to identify whether scrolling come from user interaction. */
	private scrollState: ScrollState = ScrollState.None

	constructor(
		scroller: HTMLElement,
		slider: HTMLElement,
		repeat: HTMLElement,
		context: Component,
		doa: DirectionalOverflowAccessor,
		updateCallback: () => void
	) {
		this.scroller = scroller
		this.slider = slider
		this.repeat = repeat
		this.context = context
		this.doa = doa
		this.updateCallback = updateCallback
		this.measurement = this.initMeasurement()
	}

	/** Initialize measurement object. */
	protected abstract initMeasurement(): MeasurementBase

	/** 
	 * Guess an item size for first-time paint,
	 * and avoid it checking for item-size and render twice.
	 */
	setGuessedItemSize(size: number) {
		this.measurement.setGuessedItemSize(size)
	}

	/** 
	 * Call it to notify has just set scrolled.
	 * So we can know whether scroll event come from setting scroll value.
	 */
	async justSetScrolled() {
		this.scrollState = ScrollState.SetManually

		// Larger than one frame time always.
		await sleep(50)

		if (this.scrollState === ScrollState.SetManually) {
			this.scrollState = ScrollState.None
		}
	}

	/** 
	 * Set start and end index of live data range,
	 * and align direction to indicate how render part align with scroll viewport.
	 * 
	 * `startIndex` and `endIndex` may be adjusted, but would include original index range.
	 * 
	 * If `tryPersistContinuous` is true, will try to adjust render indices a little
	 * to persist continuous rendering result, but still ensure to render required elements.
	 */
	setRenderIndices(
		alignDirection: 'start' | 'end',
		startIndex: number | undefined,
		endIndex: number | undefined = undefined,
		tryPersistContinuous: boolean = false
	) {
		this.needToApply = {
			alignDirection,
			startIndex,
			endIndex,
			tryPersistContinuous,
		}
	}

	/** 
	 * Locate start or after end index at which the item is visible in viewport.
	 * Note it's returned index can be `0~list.length`.
	 * Must after update complete.
	 */
	locateVisibleIndex(direction: 'start' | 'end', minimumRatio: number = 0): number {
		let children: ArrayLike<Element> = this.repeat.children

		let visibleIndex = locateVisibleIndex(
			children as ArrayLike<HTMLElement>,
			this.scroller,
			this.doa,
			direction,
			minimumRatio
		)

		return visibleIndex + this.startIndex
	}

	/** After component that use this renderer get connected. */
	connect() {
		if (this.connected) {
			return
		}

		this.connected = true

		DOMEvents.on(this.scroller, 'scroll', this.onScrollerScroll, this, {passive: true})
		ResizeWatcher.watch(this.slider, this.onSliderSizeUpdated, this)

		this.initScrollerSize()
	}

	/** After component that use this renderer will get disconnected. */
	disconnect() {
		if (!this.connected) {
			return
		}

		this.connected = false
		DOMEvents.off(this.scroller, 'scroll', this.onScrollerScroll, this)
		ResizeWatcher.unwatch(this.slider, this.onSliderSizeUpdated, this)

		this.disposeScrollerSize()
	}
	
	/** To initialize scroller size. */
	protected initScrollerSize() {
		this.readScrollerSizePromise = this.readScrollerSize()
		ResizeWatcher.watch(this.scroller, this.readScrollerSize, this)
	}

	/** Dispose watching scroller size. */
	protected disposeScrollerSize() {
		this.readScrollerSizePromise = null
		ResizeWatcher.unwatch(this.scroller, this.readScrollerSize, this)
	}
	
	/** On scroller scroll event. */
	protected async onScrollerScroll() {
		if (this.scrollState !== ScrollState.SetManually) {
			this.scrollState = ScrollState.FromInteraction
		}
		
		this.willCheckCoverage()
	}

	/** Read new scroller size. */
	protected async readScrollerSize() {
		await this.measurement.readScrollerSize()
		this.readScrollerSizePromise = null
	}

	/** 
	 * When slider size updated,
	 * it should either ignore if update come from inside,
	 * or check coverage and re-measure item-size if update come from outside.
	 */
	protected async onSliderSizeUpdated(entry: ResizeObserverEntry) {
		if (!this.throttlingSliderSizeUpdate && entry.contentRect.width > 0 && entry.contentRect.height > 0) {

			// Break continuous render range.
			this.measurement.breakContinuousRenderRange()

			// Re-measure item size.
			await this.measurement.measureAfterRendered(this.startIndex, this.endIndex)

			// Finally check coverage.
			this.willCheckCoverage()
		}
	}

	/** 
	 * Calls `updateCallback`.
	 * If `callImmediately`, no need to wait.
	 */
	protected async updateRendering(callImmediately: boolean) {
		if (!callImmediately) {
			await barrierDOMWriting()

			// Because we update parent and self in serialization,
			// Parent updating will cause child disconnect even child is in updating.
			// So need to check `connected` every time after `barrierDOMWriting`.
			if (!this.connected) {
				return
			}
		}

		this.updateCallback()
	}

	/** 
	 * Update from applying start index or just update data.
	 * Note currently it inside a update queue, so should call
	 * update callback as soon as possible.
	 */
	async update() {

		// Must wait for scroller size read.
		if (this.readScrollerSizePromise) {
			await this.readScrollerSizePromise
		}

		// Render one item for measurement.
		if (!this.measurement.hasMeasured()) {
			await this.doInitialUpdateForMeasurement()
		}

		// Update by applying index.
		if (this.needToApply) {
			await this.doIndexApplyingUpdate()
			this.needToApply = null

			// If item size become smaller much, may cause can't fully covered.
			if (this.connected && this.dataCount > 0) {
				await this.doCoverageUpdate()
			}
		}

		// Update by checking coverage.
		else if (this.needToCheckCoverage) {
			await this.doCoverageUpdate()
			this.needToCheckCoverage = false
		}

		// Update normally after data changed.
		// Common situation, not need to read DOM before rendering,
		// except it may cause additional re-rendering when scrolling up.
		else {
			await this.doDataChangeUpdate()

			// If item size become smaller much, may cause can't fully covered.
			if (this.connected && this.dataCount > 0) {
				await this.doCoverageUpdate()
			}
		}
	}

	/** Render only one item for measurement when not measured yet. */
	protected async doInitialUpdateForMeasurement() {
		if (this.dataCount === 0) {
			return
		}

		this.alignDirection = 'start'
		this.startIndex = 0
		this.endIndex = 1

		await this.updateRendering(true)

		if (!this.connected) {
			return
		}

		await this.measurement.measureAfterRendered(this.startIndex, this.endIndex)
	}

	/** Update after index applied. */
	protected async doIndexApplyingUpdate() {

		// Adjust scroll position by specified indices.
		await this.updateByApplying()

		if (!this.connected) {
			return
		}
		
		await this.setRestSize()
		await this.measurement.measureAfterRendered(this.startIndex, this.endIndex)
		await this.afterMeasured()
	}

	/** Update when start index specified and need to apply. */
	protected async updateByApplying() {
		let {startIndex, endIndex, alignDirection, tryPersistContinuous} = this.needToApply!
		let renderCount = this.endIndex - this.startIndex
		let canPersistContinuous = false

		// Adjust index and persist continuous.
		if (tryPersistContinuous && renderCount > 0) {
			await barrierDOMReading()
	
			let startVisibleIndex = this.locateVisibleIndex('start')
			let endVisibleIndex = this.locateVisibleIndex('end')

			if (alignDirection === 'start') {

				// Try persist visible part.
				let renderCountToPersist = Math.max(endVisibleIndex, startIndex! + 1) - Math.min(startVisibleIndex, startIndex!)
				if (renderCountToPersist <= renderCount) {
					startIndex = Math.min(startVisibleIndex, startIndex!)
					endIndex = startIndex + renderCount
					canPersistContinuous = true
				}

				// Try keep most intersection.
				else if (startIndex! > endVisibleIndex) {
					endIndex = Math.max(endVisibleIndex, startIndex! + 1)
					startIndex = endIndex - renderCount
				}
			}
			else {

				// Try persist visible part.
				let renderCountToPersist = Math.max(endVisibleIndex, endIndex!) - Math.min(startVisibleIndex, endIndex!)
				if (renderCountToPersist <= renderCount) {
					endIndex = Math.max(endVisibleIndex, endIndex!)
					startIndex = endIndex - renderCount
					canPersistContinuous = true
				}

				// Try keep most intersection.
				else if (endIndex! < startVisibleIndex) {
					startIndex = endIndex! - 1
					endIndex = startIndex + renderCount
				}
			}
		}

		// Update continuously.
		if (canPersistContinuous) {
			await this.updateContinuously(alignDirection, startIndex!, endIndex)
		}

		// Reset scroll position, but will align item with index viewport edge.
		else {
			this.alignDirection = alignDirection ?? 'start'
			this.setIndices(startIndex, endIndex)

			this.updateRendering(true)

			await this.resetPositions(
				true,
				tryPersistContinuous ? undefined : startIndex,
				tryPersistContinuous ? undefined : endIndex
			)
		}
	}

	/** Update after data changed. */
	protected async doDataChangeUpdate() {

		// Data changed, try persist start index and scroll position.
		await this.updateWithStartIndexPersist()

		if (!this.connected) {
			return
		}

		await this.setRestSize()
		await this.measurement.measureAfterRendered(this.startIndex, this.endIndex)
		await this.afterMeasured()
	}

	/** Update data normally, and try to keep indices and scroll position. */
	protected async updateWithStartIndexPersist() {
		let canPersist = true

		// Can't persist old index and position.
		if (this.endIndex > this.dataCount) {
			canPersist = false
		}
		
		// Required, may data count increase or decrease.
		this.alignDirection = 'start'
		this.setIndices(this.startIndex)

		this.updateRendering(true)

		// Reset index by scroll position.
		if (!canPersist) {
			await this.updatePersistScrollPosition()
		}
	}

	/** Update start and end indices before rendering. */
	protected setIndices(newStartIndex: number | undefined, newEndIndex: number | undefined = undefined) {
		let currentRenderCount = this.endIndex - this.startIndex
		let renderCount = this.measurement.getSafeRenderCount(this.reservedPixels, currentRenderCount)

		if (newStartIndex === undefined) {
			newStartIndex = newEndIndex! - renderCount
		}

		newStartIndex = Math.min(newStartIndex, this.dataCount - renderCount)
		newStartIndex = Math.max(0, newStartIndex)

		newEndIndex = newEndIndex ?? newStartIndex + renderCount
		newEndIndex = Math.max(newEndIndex, newStartIndex + renderCount)
		newEndIndex = Math.min(newEndIndex, this.dataCount)

		this.startIndex = newStartIndex
		this.endIndex = newEndIndex
	}

	/** 
	 * Reset slider and scroll position, make first item appear in the start edge.
	 * `alignDirection` must have been updated.
	 * 
	 * `resetScroll`: specifies as `false` if current indices is not calculated from
	 *   current scroll offset, Then will adjust scroll offset and align to `alignToStartIndex`.
	 */
	protected abstract resetPositions(
		resetScroll: boolean,
		alignToStartIndex?: number,
		alignToEndIndex?: number
	): Promise<void>

	/** Update start position of rendered result after setting new indices. */
	protected abstract setPosition(position: number): Promise<void>

	/** Update size of placeholder after dynamic content progressively. */
	protected abstract setRestSize(): Promise<void>

	/** After update complete, and after `measureAfterRendered`, do more check or do element alignment. */
	protected abstract afterMeasured(): Promise<void>

	/** 
	 * Check whether rendered result can cover scroll viewport,
	 * and update if can't, and will also persist content continuous if possible.
	 */
	protected willCheckCoverage() {

		// Reach both start and end edge.
		if (this.startIndex === 0 && this.endIndex === this.dataCount) {
			return
		}

		// Must update according to component, or `untilChildUpdateComplete` will not work.
		this.needToCheckCoverage = true
		this.context.willUpdate()
	}

	protected async doCoverageUpdate() {

		// Which direction is un-covered.
		// Only reserve pixels if come from scrolling.
		let reservedPixels = this.scrollState === ScrollState.FromInteraction ? Math.min(this.reservedPixels / 4, 100) : 0
		this.scrollState === ScrollState.None

		let unCoveredSituation = await this.measurement.checkUnCoveredDirection(reservedPixels, this.alignDirection)
		if (unCoveredSituation === null) {
			return
		}

		if (unCoveredSituation === 'out-view-start' || unCoveredSituation === 'out-view-end') {
			return
		}

		// Already reach the range edge, no need to render more.
		if (unCoveredSituation === 'partial-start' && this.startIndex === 0
			|| unCoveredSituation === 'partial-end' && this.endIndex === this.dataCount
		) {
			return
		}

		// Update and try to keep same element with same position.
		if (unCoveredSituation === 'partial-end' || unCoveredSituation === 'partial-start') {
			await barrierDOMReading()

			let alignDirection: 'start' | 'end' = unCoveredSituation === 'partial-end' ? 'start' : 'end'
			let visibleIndex = this.locateVisibleIndex(alignDirection)
			let newStartIndex: number
			let newEndIndex: number | undefined = undefined
			let currentRenderCount = this.endIndex - this.startIndex
			let renderCount = this.measurement.getSafeRenderCount(this.reservedPixels, currentRenderCount)

			// Scrolling down, render more at end.
			if (alignDirection === 'start') {
				newStartIndex = visibleIndex
				newEndIndex = newStartIndex + renderCount

				// First item may be very large and can't skip it, but we must render more at end.
				if (newEndIndex === this.endIndex) {
					newEndIndex++
				}
			}

			// Scrolling up, render more at end.
			else {
				newEndIndex = visibleIndex
				newStartIndex = newEndIndex - renderCount

				// Last item may be very large and can't skip it, but we must render more at start.
				if (newStartIndex === this.startIndex) {
					newStartIndex--
				}
			}

			await this.updateContinuously(alignDirection, newStartIndex, newEndIndex)
		}

		// No intersection, reset indices by current scroll position.
		else if (unCoveredSituation === 'no-intersection') {
			await this.updatePersistScrollPosition()
		}
		
		if (!this.connected) {
			return
		}

		await this.setRestSize()
		await this.measurement.measureAfterRendered(this.startIndex, this.endIndex)
		await this.afterMeasured()
	}

	/** Update and make render content continuous. */
	protected async updateContinuously(
		alignDirection: 'start' | 'end',
		newStartIndex: number,
		newEndIndex: number | undefined
	) {
		// If edge index has not changed, no need to reset position, then its `null`.
		let position: number | null = null

		// Failed to do continuous updating, must re-render totally by current indices.
		let needReset = false
		let oldStartIndex = this.startIndex
		let oldEndIndex = this.endIndex

		this.setIndices(newStartIndex, newEndIndex)

		// Has no intersection.
		if (Math.min(this.endIndex, oldEndIndex) - Math.max(this.startIndex, oldStartIndex) <= 0) {
			needReset = true
		}

		// Scrolling down, render more at end.
		else if (alignDirection === 'start') {
			
			// Rendered item count changed much, not rendering progressively.
			if (this.startIndex < oldStartIndex) {
				needReset = true
			}

			// Locate to the start position of the first element.
			else if (this.startIndex !== oldStartIndex) {
				position = await this.getContinuousPosition(oldStartIndex, alignDirection)
			}
		}

		// Scrolling up, render more at start.
		else {

			// Rendered item count changed much, not rendering progressively.
			if (this.endIndex < oldStartIndex + 1 || this.endIndex > oldEndIndex) {
				needReset = true
			}

			// Locate to the end position of the last element.
			else if (this.endIndex !== oldEndIndex) {
				position = await this.getContinuousPosition(oldStartIndex, alignDirection)
			}
		}

		// Reset index and persist scroll position.
		if (needReset) {
			await this.updatePersistScrollPosition()
		}
		
		// Update continuously.
		else {
			await this.updateBySliderPosition(alignDirection, position!)
		}
	}

	/** Get new position for continuously update. */
	protected abstract getContinuousPosition(oldStartIndex: number, _alignDirection: 'start' | 'end'): Promise<number>

	/** Set `needToAlign` property, to align after measured. */
	protected async setNeedToAlign(el: HTMLElement) {
		if (el.localName === 'slot') {
			el = el.firstElementChild as HTMLElement
		}

		await barrierDOMReading()

		// To re-align element after measured.
		this.needToAlign = {
			el,
			scrolled: this.doa.getScrolled(this.scroller),
			offset: this.doa.getOffset(el, this.scroller),
		}
	}

	/** Reset indices by current scroll position. */
	protected async updatePersistScrollPosition() {
		let newStartIndex = await this.measurement.calcStartIndexByScrolled()
		this.alignDirection = 'start'
		this.setIndices(newStartIndex)

		await this.updateRendering(false)

		if (!this.connected) {
			return
		}

		await this.resetPositions(false)
	}

	/** Update by specified slider position. */
	protected async updateBySliderPosition(direction: 'start' | 'end', position: number) {
		this.alignDirection = direction
		await this.updateRendering(false)

		if (!this.connected) {
			return
		}

		await this.setPosition(position)
	}
}