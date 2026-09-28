import {describe, expect, it} from 'vitest'
import {ColumnWidthResizer} from '../src/components/table-helpers/column-width-resizer'


/** Width inputs used by the resizer calculation. */
type ColumnWidthConfig = {
	baseWidth: number
	extendFlex: number
	shrinkFlex: number
	minWidth: number
	maxWidth: number
}


describe('ColumnWidthResizer', () => {
	/** Calculate widths without needing a rendered table. */
	function calculate(configs: ColumnWidthConfig[], available: number) {
		let resizer = Object.create(ColumnWidthResizer.prototype) as ColumnWidthResizer
		return resizer['calcColumnWidths'](configs, available)
	}

	it('redistributes growth when a column reaches its maximum', () => {
		expect(calculate([
			{baseWidth: 100, extendFlex: 1, shrinkFlex: 1, minWidth: 50, maxWidth: 120},
			{baseWidth: 100, extendFlex: 1, shrinkFlex: 1, minWidth: 50, maxWidth: Infinity},
			{baseWidth: 100, extendFlex: 1, shrinkFlex: 1, minWidth: 50, maxWidth: Infinity},
		], 420)).toEqual([120, 150, 150])
	})

	it('redistributes shrinkage when columns reach their minimums', () => {
		expect(calculate([
			{baseWidth: 100, extendFlex: 1, shrinkFlex: 1, minWidth: 80, maxWidth: Infinity},
			{baseWidth: 100, extendFlex: 1, shrinkFlex: 1, minWidth: 50, maxWidth: Infinity},
			{baseWidth: 100, extendFlex: 1, shrinkFlex: 1, minWidth: 80, maxWidth: Infinity},
		], 230)).toEqual([80, 70, 80])
	})

	it('keeps bounds when available width cannot be filled', () => {
		expect(calculate([
			{baseWidth: 100, extendFlex: 0, shrinkFlex: 0, minWidth: 80, maxWidth: 120},
			{baseWidth: 100, extendFlex: 0, shrinkFlex: 0, minWidth: 80, maxWidth: 120},
		], 300)).toEqual([120, 120])

		expect(calculate([
			{baseWidth: 100, extendFlex: 0, shrinkFlex: 0, minWidth: 80, maxWidth: 120},
			{baseWidth: 100, extendFlex: 0, shrinkFlex: 0, minWidth: 80, maxWidth: 120},
		], 100)).toEqual([80, 80])
	})

	it('limits drag movement by the expanding maximum and shrinking minimum', () => {
		let resizer = Object.create(ColumnWidthResizer.prototype) as ColumnWidthResizer
		let widths: string[] = []
		let headWidths: string[] = []
		let table = {style: {width: ''}}
		let colgroup = {
			parentElement: table,
			children: [{style: {width: ''}}, {style: {width: ''}}],
		}
		let columnContainer = {
			children: [{style: {width: '', flex: '', boxSizing: ''}}, {style: {width: '', flex: '', boxSizing: ''}}],
		}

		Object.assign(resizer, {
			columns: [{minWidth: 60, maxWidth: 120}, {minWidth: 80, maxWidth: 130}],
			minColumnWidth: 48,
			columnWidths: [100, 100],
			colgroup,
			columnContainer,
		})

		resizer['resizeColumnByMovementX'](100, 0)
		widths = colgroup.children.map(column => column.style.width)
		headWidths = columnContainer.children.map(column => column.style.width)
		expect(widths).toEqual(['120px', '80px'])
		expect(headWidths).toEqual(widths)
		expect(table.style.width).toBe('200px')

		resizer['resizeColumnByMovementX'](-100, 0)
		expect(colgroup.children.map(column => column.style.width)).toEqual(['70px', '130px'])
	})
})
