import {describe, expect, it, vi} from 'vitest'
import type {Table} from '../src/components/table'
import {TableStateCacher} from '../src/components/table-helpers/table-state'


/** Exercise state transfers across table instances without requiring browser layout. */
function makeTable(index: number = -1) {
	let table = {
		store: {},
		orderName: null as string | null,
		orderDirection: null as string | null,
		getStartVisibleIndex: vi.fn(() => index),
		setStartVisibleIndex: vi.fn(),
	}

	let cache = new TableStateCacher(table as unknown as Table)
	return {table, cache}
}


describe('table state during early disconnect', () => {
	it('saves sort state without inventing a scroll position', () => {
		let {table, cache} = makeTable()
		let next = makeTable()
		table.orderName = 'name'
		table.orderDirection = 'asc'
		cache.save('sort-only', {visibleIndex: true, order: true})
		next.cache.restore('sort-only')
		expect(next.table.orderName).toBe('name')
		expect(next.table.orderDirection).toBe('asc')
		expect(next.table.setStartVisibleIndex).not.toHaveBeenCalled()
	})

	it('keeps a measured position across both an early save and an interrupted restore', () => {
		let first = makeTable(17)
		let early = makeTable()
		let next = makeTable()
		first.cache.save('pieces', {visibleIndex: true})
		early.cache.save('pieces', {visibleIndex: true})
		early.cache.restore('pieces')
		expect(early.table.setStartVisibleIndex).toHaveBeenCalledWith(17)
		expect(early.cache.has('pieces')).toBe(false)
		early.cache.save('pieces', {visibleIndex: true})
		next.cache.restore('pieces')
		expect(next.table.setStartVisibleIndex).toHaveBeenCalledWith(17)
	})

	it('uses a measured first row instead of the previous scroll position', () => {
		let first = makeTable(12)
		let next = makeTable(0)
		first.cache.save('first-row', {visibleIndex: true})
		next.cache.restore('first-row')
		next.cache.save('first-row', {visibleIndex: true})
		first.cache.restore('first-row')
		expect(first.table.setStartVisibleIndex).toHaveBeenCalledWith(0)
	})
})
