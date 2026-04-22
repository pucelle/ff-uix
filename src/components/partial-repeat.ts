import {effect, trackGet, untilBarriersComplete, UpdateQueue} from 'lupos'
import {Repeat, RepeatRenderFn} from './repeat'
import {html, inSSR, PartCallbackParameterMask, PerFrameTransitionEasingName} from 'lupos.html'
import {PartialRenderer} from './repeat-helpers/partial-renderer'
import {LowerIndexWithin} from '../tools'
import {locateVisibleIndexAtOffset} from './repeat-helpers/index-locator'
import {RendererBase} from './repeat-helpers/base-renderer'


export interface PartialRepeatEvents {

	/** 
	 * 'updated' event only ensure dom tree update,
	 * either scroll position or further adjustment still in progress.
	 * `after-measured` to be fired after partial or live rendering complete and measured.
	 * Can safely read it's properties, like scroll positions and live indices right now.
	 */
	'measured': () => void
}


/** 
 * This component will render partial repeat contents only within viewport.
 * But not like `<LiveRepeat>`, it doesn't manage the whole content of scroller,
 * and can be used to render part of the scrolling contents.
 * 
 * This makes it more flexible, but it's not as efficient as `<LiveRepeat>`,
 * and may cause additional re-layout to adjust scroll position when scrolling up,
 * especially when item sizes are different from each other.
 */
export class PartialRepeat<T = any, E = {}> extends Repeat<T, E & PartialRepeatEvents> {

	/** 
	 * Render function to generate render result by each item.
	 * The second `index` will accept live index.
	 */
	declare renderFn: RepeatRenderFn<T>

	/**
	* How many pixels to reserve to reduce update frequency when scrolling.
	* On Windows, scroll for 100px each time.
	* So `200px` is a reasonable value.
	* For larger area of contents, you may reset this value to `400~800`.
	*/
	reservedPixels: number = 200

	/** 
	 * Guess an item size for first-time paint,
	 * and avoid it checking for item-size and render twice.
	 * If `guessedItemSize` changed more than 33%, will cause restart item size stat.
	 */
	guessedItemSize: number = 0

	/** Placeholders at front or end. */
	protected placeholders: HTMLDivElement[] | null = null

	/** Partial content renderer. */
	protected renderer: RendererBase | null = null as any

	/** The start index of the live data. */
	startIndex: number = 0

	/** The end index of the live data. */
	endIndex: number = 0

	/** Latest align direction. */
	alignDirection: 'start' | 'end' = 'start'

	/** Live data, rendering part of all the data. */
	liveData: T[] = []

	/** Apply `guessedItemSize` property to renderer. */
	@effect
	protected applyGuessedItemSize() {
		this.renderer?.setGuessedItemSize(this.guessedItemSize)
	}

	/** Apply `reservedPixels` property to renderer. */
	@effect
	protected applyReservedPixels() {
		if (this.renderer) {
			this.renderer.reservedPixels = this.reservedPixels
		}
	}

	/** Apply `data` count to renderer. */
	@effect
	protected applyDataCount() {
		if (this.renderer) {
			this.renderer.dataCount = this.data.length
			this.willUpdate()
		}
	}

	/** Update after data change, and also wait for renderer render complete. */
	override async update(this: PartialRepeat<{}>) {

		// `this.$needsUpdate` here is required.
		// component map disconnect and connect soon, so will be enqueued for multiple times.
		if (!this.connected) {
			return
		}

		if (inSSR) {
			super.update()
			return
		}

		await this.renderer?.update()
	}

	/** 
	 * Update live data by new indices.
	 * May be called for several times for each time updating.
	 */
	protected updateLiveData(this: PartialRepeat) {
		if (this.renderer) {
			this.startIndex = this.renderer.startIndex
			this.endIndex = this.renderer.endIndex
			this.alignDirection = this.renderer.alignDirection
		}
		else {
			this.endIndex = this.data.length
			this.alignDirection = 'start'
		}

		this.liveData = this.data.slice(this.startIndex, this.endIndex)

		UpdateQueue.onSyncUpdateStart(this)
		this.updateRendering()
		UpdateQueue.onSyncUpdateEnd()
		
		this.onUpdated()
		this.fire('updated')
	}

	protected override render() {

		// Do custom tracking.
		// Here we want the `liveData` and other properties to be observed by outside,
		// but later doing update immediately to persist sync update process,
		// so we should track the `data` property manually and skip `liveData`.
		trackGet(this, 'data')

		return html`<lu:for ${this.liveData}>${this.renderLiveFn.bind(this)}</lu:for>`
	}

	/** Replace local index to live index. */
	protected renderLiveFn(item: T, index: number) {
		trackGet(this, 'renderFn')

		return this.renderFn(item, this.startIndex + index)
	}

	protected onAfterMeasured(this: PartialRepeat) {
		this.fire('measured')
	}

	protected override onConnected(this: PartialRepeat<any, {}>) {
		super.onConnected()

		if (!inSSR) {
			this.initPlaceholders()
			this.initRenderer()
			this.renderer?.connect()
		}
	}

	override beforeDisconnectCallback(param: PartCallbackParameterMask) {
		if (!this.connected) {
			return
		}

		super.beforeDisconnectCallback(param)
		
		if (this.renderer) {
			this.renderer?.disconnect()
		}

		// If remove current component from parent, remove placeholder also.
		if ((param & PartCallbackParameterMask.AsDirectNode) > 0) {
			if (this.placeholders) {
				this.placeholders[0].remove()
				this.placeholders[1].remove()
				this.placeholders = null
			}
		}
	}

	protected initPlaceholders() {
		if (this.placeholders) {
			return
		}

		this.placeholders = new Array(2)
		this.placeholders[0] = document.createElement('div')
		this.placeholders[0].style.cssText = 'width: 100%; visibility: hidden;'

		this.placeholders[1] = document.createElement('div')
		this.placeholders[1].style.cssText = 'width: 100%; visibility: hidden;'

		this.el.before(this.placeholders[0])
		this.el.after(this.placeholders[1])
	}

	/** Init renderer when connected. */
	protected initRenderer() {
		if (this.renderer) {
			return
		}

		this.renderer = new PartialRenderer(
			this.scroller!,
			this.el,
			this.el,
			this,
			this.doa,
			this.updateLiveData.bind(this),
			this.onAfterMeasured.bind(this),
			this.placeholders![0],
			this.placeholders![1]
		)

		this.renderer
	}

	/** Check whether item at specified index is rendered. */
	isIndexRendered(index: number): boolean {
		return index >= this.startIndex && index < this.endIndex
	}

	/** Get element at specified index. */
	override getElementAtIndex(index: number): HTMLElement | undefined {
		return this.el.children[index - this.startIndex] as HTMLElement | undefined
	}

	/** 
	 * Get the element index at specified offset.
	 * The offset value is the offset position relative to scroller.
	 * it's not affected by scroll position.
	 * 
	 * Returned index in range `0~data.length`.
	 * 
	 * Note if content in target offset has not been rendered,
	 * e.g. it out of partial rendering range because of away from viewport much.
	 * Would can't get right index result.
	 */
	override getIndexAtOffset(offset: number): LowerIndexWithin {
		let indexAndWithin = locateVisibleIndexAtOffset(
			this.el.children as ArrayLike<Element> as ArrayLike<HTMLElement>,
			this.scroller,
			this.doa,
			offset
		)

		indexAndWithin.index += this.startIndex
		
		return indexAndWithin
	}

	override getStartVisibleIndex(minimumRatio: number = 0): number {
		return this.renderer?.locateVisibleIndex('start', minimumRatio) ?? super.getStartVisibleIndex(minimumRatio)
	}

	override getEndVisibleIndex(minimumRatio: number = 0): number {
		return this.renderer?.locateVisibleIndex('end', minimumRatio) ?? super.getEndVisibleIndex(minimumRatio)
	}

	/** 
	 * Set start visible index of rendered items.
	 * The data item of this index will be renderer at the topmost or leftmost of the viewport.
	 * You can safely call this before update complete, no additional rendering will cost.
	 */
	setStartVisibleIndex(startIndex: number) {
		this.renderer?.setRenderIndices('start', startIndex)
		this.willUpdate()
	}

	override async scrollIndexToStart(index: number, gap?: number, duration?: number, easing?: PerFrameTransitionEasingName): Promise<boolean> {
		await this.toRenderItemAtIndex(index, 'start')
		return super.scrollIndexToStart(index - this.startIndex, gap, duration, easing)
	}

	/** To ensure item at index get rendered. */
	async toRenderItemAtIndex(this: PartialRepeat, index: number, alignDirection: 'start' | 'end') {
		if (this.isIndexRendered(index)) {
			return
		}

		let startIndex: number | undefined
		let endIndex: number | undefined

		if (alignDirection === 'start') {
			startIndex = index
		}
		else {
			endIndex = index + 1
		}

		this.renderer?.setRenderIndices(alignDirection, startIndex, endIndex, true)
		this.willUpdate()

		// Wait child to render complete.
		await this.untilChildComplete()

		// Must also wait for barrier complete, then the partial rendering process is complete.
		await untilBarriersComplete()
	}

	override async scrollIndexToView(index: number, gap?: number, duration?: number, easing?: PerFrameTransitionEasingName): Promise<boolean> {
		let alignDirection: 'start' | 'end' = index >= this.startIndex ? 'start' : 'end'
		await this.toRenderItemAtIndex(index, alignDirection)

		return super.scrollIndexToView(index - this.startIndex, gap, duration, easing)
	}
}