import {DOMUtils, ValueListUtils} from 'ff-kit'
import type {TableColumn} from '../table'
import {html, IN_SSR, render} from 'lupos.html'
import {DOMEvents, barrierDOMReading, barrierDOMWriting} from 'lupos'


/** Basis, grow, shrink, minimum, and maximum for one column. */
type ColumnWidthConfig = {
	baseWidth: number
	extendFlex: number
	shrinkFlex: number
	minWidth: number
	maxWidth: number
}


/** For `<f-table>` to resize column widths. */
export class ColumnWidthResizer {

	/** Head container. */
	readonly head: HTMLTableSectionElement

	/** Column container inside head. */
	readonly columnContainer: HTMLElement

	/** Colgroup inside table. */
	readonly colgroup: HTMLTableColElement

	/** Call it on resizing end. */
	readonly onResizeEnd: () => void
	
	/** Table column configuration. */
	columns!: TableColumn[]

	/** Minimum column width in pixels. */
	minColumnWidth!: number


	/** Whether column resized. */
	private columnResized: boolean = false

	/** Column widths array. */
	private columnWidths: number[] | null = null

	/** Column widths array when resizing. */
	private resizingColumnWidths: number[] | null = null

	/** Class name of resizing mask element. */
	private resizingMaskClassName: string

	constructor(
		head: HTMLTableSectionElement,
		columnContainer: HTMLElement,
		colgroup: HTMLTableColElement,
		resizingMaskClassName: string,
		onEnd: () => void
	) {
		this.head = head
		this.columnContainer = columnContainer
		this.colgroup = colgroup
		this.resizingMaskClassName = resizingMaskClassName
		this.onResizeEnd = onEnd
	}

	/** Update properties from <Table>. */
	async update(columns: TableColumn[], minColumnWidth: number) {
		this.columns = columns
		this.minColumnWidth = minColumnWidth
		await this.updateColumnWidths()
	}

	/** 
	 * Update column widths from column configuration.
	 * Will check available column width and will cause page re-layout.
	 */
	async updateColumnWidths() {
		await barrierDOMReading()

		let headAvailableWidth = IN_SSR ? 1200 : this.head.clientWidth
			- DOMUtils.getNumericStyleValue(this.head, 'paddingLeft')
			- DOMUtils.getNumericStyleValue(this.head, 'paddingRight')

		await this.updateColumnWidthsByAvailable(headAvailableWidth)
	}

	/** Update column widths after knows available head width. */
	private async updateColumnWidthsByAvailable(availableWidth: number) {
		await barrierDOMWriting()

		let configs = this.columns.map((column: TableColumn, index) => {
			let {flex, width} = column
			let minWidth = this.getMinWidth(column)
			let maxWidth = this.getMaxWidth(column)
			let baseWidthInColumnConfig = Math.min(Math.max(width ?? 0, minWidth), maxWidth)

			// If column resized, we use the column width percentage to calculate new column width.
			let baseWidth = this.columnResized
				? Math.min(Math.max(this.columnWidths![index], minWidth), maxWidth)
				: baseWidthInColumnConfig

			let extendFlex = 0
			let shrinkFlex = 0

			if (Array.isArray(flex)) {
				extendFlex = flex[0] ?? 0
				shrinkFlex = flex[1] ?? extendFlex
			}
			else {
				extendFlex = shrinkFlex = flex ?? 0
			}

			return {baseWidth, extendFlex, shrinkFlex, minWidth, maxWidth}
		})
		
		let widths = this.calcColumnWidths(configs, availableWidth)
		this.columnWidths = widths
		this.setColumnWidths(widths)
	}

	/** Get the effective minimum width of a column. */
	private getMinWidth(column: TableColumn): number {
		return column.minWidth ?? this.minColumnWidth
	}

	/** Get the effective maximum width of a column. */
	private getMaxWidth(column: TableColumn): number {
		return Math.max(column.maxWidth ?? Infinity, this.getMinWidth(column))
	}

	/**
	 * Distribute available width according to flex values while respecting each column's bounds.
	 * When the bounds make the available width impossible to fill, keep the bounded widths.
	 */
	private calcColumnWidths(configs: ColumnWidthConfig[], clientWidth: number): number[] {
		let widths = configs.map(config => config.baseWidth)
		let remaining = clientWidth - ValueListUtils.sum(widths)
		let growing = remaining > 0
		let flexKey: 'extendFlex' | 'shrinkFlex' = growing ? 'extendFlex' : 'shrinkFlex'
		let fallbackFlex = configs.every(config => config[flexKey] === 0)

		// It allocates remaining pixels by rest flexes each time.
		while (Math.abs(remaining) > 0.001) {
			let candidates = configs
				.map((_, index) => index)
				.filter(index => {
					let config = configs[index]
					let flex = fallbackFlex ? 1 : config[flexKey]
					return flex > 0
						&& (growing ? widths[index] < config.maxWidth : widths[index] > config.minWidth)
				})

			if (candidates.length === 0) {
				break
			}

			let totalFlex = candidates.reduce((sum, index) => {
				return sum + (fallbackFlex ? 1 : configs[index][flexKey])
			}, 0)

			let distributed = 0

			for (let index of candidates) {
				let flex = fallbackFlex ? 1 : configs[index][flexKey]
				let share = remaining * flex / totalFlex
				let bound = growing ? configs[index].maxWidth : configs[index].minWidth

				let width = growing
					? Math.min(widths[index] + share, bound)
					: Math.max(widths[index] + share, bound)

				distributed += width - widths[index]
				widths[index] = width
			}

			if (Math.abs(distributed) < 0.001) {
				break
			}

			remaining -= distributed
		}

		return widths
	}

	/** Apply calculated widths to the header and body columns. */
	private setColumnWidths(widths: number[]) {
		let totalWidth = ValueListUtils.sum(widths)
		let table = this.colgroup.parentElement as HTMLTableElement
		table.style.width = totalWidth + 'px'

		for (let i = 0; i < widths.length; i++) {
			let width = widths[i]
			let col = this.colgroup.children[i] as HTMLElement
			let headCol = this.columnContainer.children[i] as HTMLElement

			headCol.style.flex = 'none'
			headCol.style.boxSizing = 'border-box'
			headCol.style.width = col.style.width = width + 'px'
		}
	}

	/** Called after mouse down at column resizer. */
	onStartResize(e: MouseEvent, index: number) {
		let startX = e.clientX

		let onMouseMove = (e: MouseEvent) => {
			e.preventDefault()
			this.resizeColumnByMovementX(e.clientX - startX, index)
		}

		let onMouseUp = () => {
			if (this.resizingColumnWidths) {
				this.columnWidths = this.resizingColumnWidths
				this.resizingColumnWidths = null
			}

			DOMEvents.off(document, 'mousemove', onMouseMove)
			cursorMask.remove()
			this.columnResized = true
			this.onResizeEnd()
		}

		let cursorMask = render(html`<div class="${this.resizingMaskClassName}" />`)
		cursorMask.appendTo(document.body)

		DOMEvents.on(document, 'mousemove', onMouseMove)
		DOMEvents.once(document, 'mouseup', onMouseUp)
	}

	private resizeColumnByMovementX(movementX: number, index: number) {
		let widths = [...this.columnWidths!]
		let moveLeft = movementX < 0
		let expandIndex = moveLeft ? index + 1 : index
		let firstShrinkIndex = moveLeft ? index : index + 1
		let maxExpandWidth = this.getMaxWidth(this.columns[expandIndex])

		let needShrink = Math.min(
			Math.abs(movementX),
			Math.max(0, maxExpandWidth - widths[expandIndex])
		)

		// When move to left, we reduce the width of current and previous columns until the `minWidth`,
		// then we add the reduced width to next column.

		// When move to right, we reduce the width of next columns until the `minWidth`,
		// then we add the reduced width to current column.
		for (let i = firstShrinkIndex; (moveLeft ? i >= 0 : i < this.columns.length) && needShrink > 0; moveLeft ? i-- : i++) {
			let width = widths[i]
			let minWidth = this.getMinWidth(this.columns[i])
			let shrink = Math.min(needShrink, Math.max(0, width - minWidth))

			widths[i] -= shrink
			widths[expandIndex] += shrink
			needShrink -= shrink
		}

		this.resizingColumnWidths = widths
		this.setColumnWidths(widths)
	}
}

