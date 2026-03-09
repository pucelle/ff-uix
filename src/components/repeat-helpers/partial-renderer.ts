import {DirectionalOverflowAccessor} from './directional-overflow-accessor'
import {PartialMeasurement} from './partial-measurement'
import {barrierDOMReading, barrierDOMWriting} from 'lupos'
import {Component} from 'lupos.html'
import {RendererBase} from './base-renderer'


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
export class PartialRenderer extends RendererBase {

	declare measurement: PartialMeasurement

	readonly frontPlaceholder: HTMLDivElement | null
	readonly backPlaceholder: HTMLDivElement | null
	
	constructor(
		scroller: HTMLElement,
		slider: HTMLElement,
		repeat: HTMLElement,
		context: Component,
		doa: DirectionalOverflowAccessor,
		updateCallback: () => void,
		frontPlaceholder: HTMLDivElement | null,
		backPlaceholder: HTMLDivElement | null
	) {
		super(scroller, slider, repeat, context, doa, updateCallback)
		this.frontPlaceholder = frontPlaceholder
		this.backPlaceholder = backPlaceholder
	}

	protected initMeasurement() {
		return new PartialMeasurement(this.scroller, this.slider, this.repeat, this.context, this.doa)
	}

	protected async resetPositions(
		resetScroll: boolean,
		alignToStartIndex: number = this.startIndex,
		alignToEndIndex: number = this.endIndex
	) {
		let frontSize = this.measurement.getNormalFrontPlaceholderSize(this.startIndex)
		await this.setPosition(frontSize)

		// Break continuous render range.
		this.measurement.breakContinuousRenderRange()

		// Scroll to align to specified index.
		if (resetScroll) {
			alignToStartIndex = Math.min(Math.max(alignToStartIndex, this.startIndex), this.endIndex - 1)
			alignToEndIndex = Math.max(Math.min(alignToEndIndex, this.endIndex), this.startIndex)

			let scrollPosition = this.measurement.calcScrollPosition(alignToStartIndex, this.alignDirection)
			await barrierDOMWriting()

			if (!this.connected) {
				return
			}

			this.doa.setScrolled(this.scroller, scrollPosition)
		}
	}

	protected async setPosition(position: number) {
		this.measurement.setFrontPlaceholderSize(position)

		if (this.frontPlaceholder) {
			await barrierDOMWriting()

			if (!this.connected) {
				return
			}

			this.doa.setSize(this.frontPlaceholder, position)
		}
	}

	protected async setRestSize() {
		if (!this.backPlaceholder) {
			return
		}

		let backSize = this.measurement.getNormalBackPlaceholderSize(this.endIndex, this.dataCount)

		// Update back size only when have at least 50% difference.
		await barrierDOMWriting()

		if (!this.connected) {
			return
		}

		this.doa.setSize(this.backPlaceholder, backSize)
		this.measurement.setBackPlaceholderSize(backSize)
	}

	protected async afterMeasured() {
		await this.alignByResettingFrontSize()
	}

	/** Do element alignment by adjusting scroll offset. */
	protected async alignByResettingFrontSize() {
		if (!this.needToAlign) {
			return
		}

		// Why we can't adjust scroll position to align?
		// When mouse are dragging scrollbar thumb, if adjust scroll position,
		// the adjusted difference will soon apply again to the scroll position
		// when next time triggers scroll events.
		// E.g.,
		// Normally 100px per item, and one 1000px item existing at index 1.
		// When new startIndex becomes 0, will firstly render 100px of each item,
		// and cause -900px collapse, to restore it, you need to move scroll position
		// by +900px, but when next time scroll, will add another +900px scroll.

		await barrierDOMReading()
		let newOffset = this.doa.getOffset(this.needToAlign.el, this.scroller)
		let offsetDiff = newOffset - this.needToAlign.offset

		await barrierDOMWriting()
		let frontSize = this.measurement.frontPlaceholderSize
		let newFrontSize = frontSize - offsetDiff

		let fixedFrontSize = this.measurement.fixFrontPlaceholderSize(newFrontSize, this.startIndex)
		if (fixedFrontSize !== newFrontSize) {
			this.setPosition(newFrontSize)
			this.measurement.resetPositions(newFrontSize)
		}

		this.needToAlign = null
	}

	protected async getContinuousPosition(oldStartIndex: number, _alignDirection: 'start' | 'end') {
		let position: number

		// Render more at end, can directly know the new position.
		if (this.startIndex >= oldStartIndex) {
			let elIndex = this.startIndex - oldStartIndex
			let el = this.repeat.children[elIndex] as HTMLElement

			if (el.localName === 'slot') {
				el = el.firstElementChild as HTMLElement
			}

			await barrierDOMReading()

			// If el located at start, it will move by slider padding top,
			// to keep it's position, should remove slider padding.
			position = this.measurement.frontPlaceholderSize
				+ this.doa.getOuterOffset(el, this.slider)
				- this.doa.getStartPadding(this.slider)
		}

		// Render more at start, can't know the new position, just guess it.
		else {
			position = this.measurement.frontPlaceholderSize
				+ (this.startIndex - oldStartIndex) * this.measurement.getMedianItemSize()
			
			// Fix position to make sure it doesn't have more that 10x difference than normal.
			//position = this.measurement.fixFrontPlaceholderSize(position, this.startIndex, 10)

			await this.setNeedToAlign(this.repeat.children[0] as HTMLElement)
		}
	
		return position
	}
}