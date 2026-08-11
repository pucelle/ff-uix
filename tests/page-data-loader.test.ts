import {describe, expect, it, vi} from 'vitest'
import {PageDataLoader} from '../src/data/page-data-loader'


describe('PageDataLoader', () => {
	it('loads each page once and returns cached ranges', async () => {
		let source = ['A', 'B', 'C', 'D', 'E']
		let dataGetter = vi.fn((startIndex: number, endIndex: number) => {
			return source.slice(startIndex, endIndex)
		})
		let loader = new PageDataLoader(2, () => source.length, dataGetter)

		expect(loader.getImmediateData(1, 4)).toEqual([null, null, null])
		expect(await loader.getFreshData(1, 4)).toEqual(['B', 'C', 'D'])
		expect(dataGetter).toHaveBeenCalledTimes(2)
		expect(dataGetter).toHaveBeenNthCalledWith(1, 0, 2)
		expect(dataGetter).toHaveBeenNthCalledWith(2, 2, 4)

		expect(await loader.getFreshData(0, 4)).toEqual(['A', 'B', 'C', 'D'])
		expect(dataGetter).toHaveBeenCalledTimes(2)
	})

	it('deduplicates concurrent requests for the same page', async () => {
		let resolvePage!: (items: string[]) => void
		let pagePromise = new Promise<string[]>(resolve => resolvePage = resolve)
		let dataGetter = vi.fn(() => pagePromise)
		let loader = new PageDataLoader(2, () => 2, dataGetter)

		await loader.getDataCount()
		let first = loader.getFreshData(0, 2)
		let second = loader.getFreshData(0, 2)
		resolvePage(['A', 'B'])

		expect(await first).toEqual(['A', 'B'])
		expect(await second).toEqual(['A', 'B'])
		expect(dataGetter).toHaveBeenCalledTimes(1)
	})

	it('allows a rejected page request to be retried', async () => {
		let dataGetter = vi.fn()
			.mockRejectedValueOnce(new Error('temporary failure'))
			.mockResolvedValueOnce(['A'])
		let loader = new PageDataLoader<string>(1, () => 1, dataGetter)

		await loader.getDataCount()
		await expect(loader.getFreshData(0, 1)).rejects.toThrow('temporary failure')
		await expect(loader.getFreshData(0, 1)).resolves.toEqual(['A'])
		expect(dataGetter).toHaveBeenCalledTimes(2)
	})

	it('splices removals and insertions without corrupting adjacent items', async () => {
		let source = ['A', 'B', 'C', 'D']
		let loader = new PageDataLoader(2, () => source.length, (startIndex, endIndex) => {
			return source.slice(startIndex, endIndex)
		})

		await loader.getDataCount()
		await loader.getFreshData(0, source.length)

		loader.splice(1, 2, 'X')
		expect(loader.getImmediateData(0, 3)).toEqual(['A', 'X', 'D'])
		expect(await loader.getDataCount()).toBe(3)

		loader.splice(1, 0, 'Y', 'Z')
		expect(loader.getImmediateData(0, 5)).toEqual(['A', 'Y', 'Z', 'X', 'D'])
		expect(await loader.getDataCount()).toBe(5)
	})

	it('clears cached data and count', async () => {
		let countGetter = vi.fn(() => 2)
		let dataGetter = vi.fn(() => ['A', 'B'])
		let loader = new PageDataLoader(2, countGetter, dataGetter)

		await loader.getDataCount()
		await loader.getFreshData(0, 2)
		loader.clear()

		expect(loader.getImmediateData(0, 2)).toEqual([null, null])
		expect(await loader.getDataCount()).toBe(2)
		expect(await loader.getFreshData(0, 2)).toEqual(['A', 'B'])
		expect(countGetter).toHaveBeenCalledTimes(2)
		expect(dataGetter).toHaveBeenCalledTimes(2)
	})
})
