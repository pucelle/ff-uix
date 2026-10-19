import {describe, expect, it, vi} from 'vitest'
import {PartialRenderer} from '../src/components/repeat-helpers/partial-renderer'
import {DirectionalOverflowAccessor} from '../src/components/repeat-helpers/directional-overflow-accessor'
import type {Component} from 'lupos.html'


vi.mock('lupos', async importOriginal => ({
	...await importOriginal<typeof import('lupos')>(),
	barrierDOMReading: async () => {},
	barrierDOMWriting: async () => {},
}))
vi.mock('lupos.html', () => ({IN_SSR: false}))


/** Create a renderer with real placeholder measurement and deterministic layout offsets. */
function createRenderer() {
	let front = {style: {height: ''}} as HTMLDivElement
	let back = {style: {height: ''}} as HTMLDivElement
	let child = {} as HTMLElement
	let repeat = {children: [child]} as unknown as HTMLElement
	let doa = new DirectionalOverflowAccessor('vertical')
	vi.spyOn(doa, 'getOffset').mockReturnValue(120)
	let measured = vi.fn()
	let renderer = new PartialRenderer(
		{} as HTMLElement,
		repeat,
		repeat,
		{} as Component,
		doa,
		() => {},
		measured,
		front,
		back,
	)

	renderer['connected'] = true
	renderer.dataCount = 100
	renderer.setGuessedItemSize(25)
	return {renderer, front, back, measured}
}


describe('PartialRenderer placeholders', () => {
	it.each([
		{endIndex: 100, measuredEndIndex: 70, expected: 0},
		{endIndex: 26, measuredEndIndex: 100, expected: 1850},
		{endIndex: 60, measuredEndIndex: 20, expected: 1000},
	])('uses the current end index $endIndex, not measured index $measuredEndIndex', async config => {
		let {renderer, back} = createRenderer()
		renderer.endIndex = config.endIndex
		renderer.measurement.indices.endIndex = config.measuredEndIndex

		await renderer['updateRestSize']()

		expect(back.style.height).toBe(`${config.expected}px`)
		expect(renderer.measurement.backPlaceholderSize).toBe(config.expected)
	})

	it.each([
		{startIndex: 20, frontSize: 500, expected: 480},
		{startIndex: 0, frontSize: 30, expected: 0},
		{startIndex: 10, frontSize: 1000, expected: 250},
	])('aligns the front placeholder at start index $startIndex', async config => {
		let {renderer, front, measured} = createRenderer()
		renderer.startIndex = config.startIndex
		renderer.measurement.sliderPositions.startPosition = config.frontSize
		renderer.measurement.sliderPositions.endPosition = config.frontSize + 650
		renderer['needToAlign'] = {index: config.startIndex, scrolled: 0, offset: 100}
		measured.mockImplementation(() => {
			expect(front.style.height).toBe(`${config.expected}px`)
		})

		await renderer['afterMeasured']()

		expect(renderer.measurement.frontPlaceholderSize).toBe(config.expected)
		expect(renderer.measurement.sliderPositions.endPosition).toBe(config.expected + 650)
		expect(renderer['needToAlign']).toBeNull()
		expect(measured).toHaveBeenCalledOnce()
	})
})
