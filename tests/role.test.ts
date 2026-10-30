import {describe, expect, it, vi} from 'vitest'
import {parseHTML} from 'linkedom'
import {role} from '../src/bindings/role'


describe('role binding', () => {
	it('manages role and only its own tab stop', () => {
		let {document} = parseHTML('<div></div>')
		let element = document.querySelector('div') as unknown as HTMLElement
		let binding = new role(element)
		binding.update('button')
		expect(element.getAttribute('role')).toBe('button')
		expect(element.getAttribute('tabindex')).toBe('0')
		binding.update(null)
		expect(element.hasAttribute('role')).toBe(false)
		expect(element.hasAttribute('tabindex')).toBe(false)
		element.setAttribute('tabindex', '-1')
		binding.update('link')
		binding.update(null)
		expect(element.getAttribute('tabindex')).toBe('-1')
	})

	it('activates custom buttons and links without intercepting nested targets', () => {
		let {document} = parseHTML('<div role="button"><span></span></div>')
		let element = document.querySelector('div') as unknown as HTMLElement
		let click = vi.spyOn(element, 'click')
		let binding = new role(element)
		binding.update('button')
		let event = {
			currentTarget: element,
			target: element,
			key: ' ',
			repeat: false,
			defaultPrevented: false,
			preventDefault: vi.fn(),
		} as unknown as KeyboardEvent
		binding['activateAccessibleAction'](event)
		expect(click).toHaveBeenCalledOnce()
		Object.assign(event, {target: element.firstElementChild})
		binding['activateAccessibleAction'](event)
		expect(click).toHaveBeenCalledOnce()
		element.setAttribute('aria-disabled', 'true')
		Object.assign(event, {target: element, key: 'Enter'})
		binding['activateAccessibleAction'](event)
		expect(click).toHaveBeenCalledOnce()
	})
})
