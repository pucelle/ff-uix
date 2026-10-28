import {beforeEach, describe, expect, it, vi} from 'vitest'


let environment = vi.hoisted(() => ({ssr: false}))

vi.mock('lupos.html', () => ({
	get IN_SSR() { return environment.ssr },
	html: (strings: TemplateStringsArray, ...values: unknown[]) => ({strings, values}),
}))

vi.mock('../src/components/tooltip', () => ({
	Tooltip: class {
		static triangleWidth = 12
		static triangleHeight = 6
	},
}))

vi.mock('../src/bindings/popup', () => ({
	popup: class {
		static Default = {}
		context: unknown
		renderer: unknown = null
		options: any = {}

		constructor(_el: Element, context: unknown) {
			this.context = context
		}

		update(renderer: unknown, options: unknown) {
			this.renderer = renderer
			this.options = options
		}
	},
}))

import {tooltip} from '../src/bindings/tooltip'


/** Create a binding with a context for renderer callbacks. */
function createTooltip(context: unknown = {}) {
	return new tooltip({} as Element, context)
}


describe('tooltip binding', () => {
	beforeEach(() => {
		environment.ssr = false
	})

	it('merges tooltip defaults with caller options', () => {
		let binding = createTooltip()
		binding.update('Help', {position: 't', hideDelay: 50, className: 'help'})

		expect(binding['options']).toMatchObject({
			key: 'tooltip',
			position: 't',
			gaps: 1,
			stickToEdges: true,
			showDelay: 0,
			hideDelay: 50,
			type: 'default',
			triangleWidth: 12,
			triangleHeight: 6,
			className: 'help',
		})
	})

	it('passes text and presentation options to the rendered tooltip', () => {
		let binding = createTooltip()
		binding.update('Help', {type: 'error', className: 'notice', triangleWidth: 9})
		let result = binding['renderer']() as unknown as {values: unknown[]}

		expect(result.values).toEqual(['notice', 'error', 9, 6, 'Help'])
	})

	it('calls a renderer with the binding context on each render', () => {
		let context = {message: 'First'}
		let renderer = vi.fn(function(this: typeof context) { return this.message })
		let binding = createTooltip(context)
		binding.update(renderer)

		expect((binding['renderer']() as any).values.at(-1)).toBe('First')
		context.message = 'Second'
		expect((binding['renderer']() as any).values.at(-1)).toBe('Second')
		expect(renderer).toHaveBeenCalledTimes(2)
	})

	it.each([null, ''])('clears the popup renderer for empty content %s', content => {
		let binding = createTooltip()
		binding.update(content)
		expect(binding['renderer']).toBeNull()
		expect(binding['shouldShowImmediately']()).toBe(false)
		expect(binding['shouldKeepVisible']()).toBe(false)
	})

	it.each(['prompt', 'error'] as const)('%s tooltips show immediately and stay visible', type => {
		let binding = createTooltip()
		binding.update('Message', {type})
		expect(binding['shouldShowImmediately']()).toBe(true)
		expect(binding['shouldKeepVisible']()).toBe(true)
	})

	it('respects explicit visibility options for default tooltips', () => {
		let binding = createTooltip()
		binding.update('Message')
		expect(binding['shouldShowImmediately']()).toBeFalsy()
		expect(binding['shouldKeepVisible']()).toBeFalsy()
		binding.update('Message', {showImmediately: true, keepVisible: true})
		expect(binding['shouldShowImmediately']()).toBe(true)
		expect(binding['shouldKeepVisible']()).toBe(true)
	})

	it('does not automatically show or keep a tooltip visible during SSR', () => {
		environment.ssr = true
		let binding = createTooltip()
		binding.update('Message', {type: 'error', showImmediately: true, keepVisible: true})
		expect(binding['shouldShowImmediately']()).toBe(false)
		expect(binding['shouldKeepVisible']()).toBe(false)
	})
})
