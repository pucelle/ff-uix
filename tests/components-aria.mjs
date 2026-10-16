import {afterEach, test} from 'node:test'
import assert from 'node:assert/strict'
import {SSR} from 'lupos.html/ssr'
import {UpdateQueue, trackSet} from 'lupos'
import {Checkbox} from '../out/components/checkbox.js'
import {Radio} from '../out/components/radio.js'
import {Switch} from '../out/components/switch.js'
import {Slider} from '../out/components/slider.js'
import {Progress} from '../out/components/progress.js'
import {Input} from '../out/components/input.js'
import {Textarea} from '../out/components/textarea.js'
import {Search} from '../out/components/search.js'
import {Select} from '../out/components/select.js'
import {List} from '../out/components/list.js'
import {DropList} from '../out/components/drop-list.js'
import {Modal} from '../out/components/modal.js'
import {Dialog} from '../out/components/dialog.js'
import {Loader} from '../out/components/loader.js'
import {Dropdown} from '../out/components/dropdown.js'
import {Table} from '../out/components/table.js'


let components = []


/** Connect compiled templates in the framework's existing SSR DOM. */
async function mount(Com, properties = {}) {
	new SSR('/')
	let component = new Com(document.createElement('div'))
	Object.assign(component, properties)
	components.push(component)
	await component.connectManually()
	await UpdateQueue.untilComplete()
	return component
}


/** Notify the observer after writes from an untransformed JavaScript test. */
async function change(component, properties) {
	Object.assign(component, properties)
	trackSet(component, ...Object.keys(properties))
	await UpdateQueue.untilComplete()
}


afterEach(async () => {
	for (let component of components) {
		await component.remove()
	}

	components = []
})

test('checkbox exposes false, checked, and mixed states after updates', async () => {
	let checkbox = await mount(Checkbox)
	assert.equal(checkbox.el.getAttribute('aria-checked'), 'false')
	await change(checkbox, {checked: true})
	assert.equal(checkbox.el.getAttribute('aria-checked'), 'true')
	await change(checkbox, {indeterminate: true})
	assert.equal(checkbox.el.getAttribute('aria-checked'), 'mixed')
})

test('radio and switch expose false states as attribute values', async () => {
	let radio = await mount(Radio)
	assert.equal(radio.el.getAttribute('aria-checked'), 'false')
	let toggle = await mount(Switch, {value: true})
	assert.equal(toggle.el.getAttribute('aria-checked'), 'true')
})

test('slider exposes bounds, value, and updated orientation', async () => {
	let slider = await mount(Slider, {min: 10, max: 30, value: 20})
	assert.equal(slider.el.getAttribute('aria-valuemin'), '10')
	assert.equal(slider.el.getAttribute('aria-valuemax'), '30')
	assert.equal(slider.el.getAttribute('aria-valuenow'), '20')
	assert.equal(slider.el.hasAttribute('aria-orientation'), false)
	await change(slider, {vertical: true, value: 30})
	assert.equal(slider.el.getAttribute('aria-orientation'), 'vertical')
	assert.equal(slider.el.getAttribute('aria-valuenow'), '30')
})

test('progress exposes percentage and clamps its accessible value', async () => {
	let progress = await mount(Progress, {value: 0.25})
	assert.equal(progress.el.getAttribute('role'), 'progressbar')
	assert.equal(progress.el.hasAttribute('aria-valuemin'), false)
	assert.equal(progress.el.hasAttribute('aria-valuemax'), false)
	assert.equal(progress.el.getAttribute('aria-valuenow'), '25')
	await change(progress, {value: 2})
	assert.equal(progress.el.getAttribute('aria-valuenow'), '100')
})

test('native inputs and textareas link validation messages and clear them after reset', async () => {
	for (let Com of [Input, Textarea, Search]) {
		let input = await mount(Com, {
			ariaLabel: 'Name',
			touched: true,
			valid: false,
			errorMessage: 'Required',
		})

		let field = input.el.querySelector('.input-field')
		assert.equal(input.el.hasAttribute('role'), false)
		assert.equal(field.getAttribute('aria-label'), 'Name')
		assert.equal(field.getAttribute('aria-invalid'), 'true')
		assert.equal(field.hasAttribute('aria-errormessage'), false)
		let errorId = field.getAttribute('aria-describedby')
		assert.equal(input.el.querySelector('#' + errorId).textContent, 'Required')
		await change(input, {touched: false})
		assert.equal(field.hasAttribute('aria-invalid'), false)
		assert.equal(field.hasAttribute('aria-describedby'), false)
	}
})

test('tooltip validation keeps a message available for the native field', async () => {
	let input = await mount(Input, {
		touched: true,
		valid: false,
		errorMessage: 'Required',
		errorOnTooltip: true,
	})
	let field = input.el.querySelector('input')
	let error = input.el.querySelector('#' + field.getAttribute('aria-describedby'))
	assert.equal(field.hasAttribute('aria-errormessage'), false)
	assert.equal(error.textContent, 'Required')
	assert.equal(error.hasAttribute('hidden'), true)
})

test('search semantics belong to the native field', async () => {
	let search = await mount(Search, {ariaLabel: 'Search products'})
	assert.equal(search.el.hasAttribute('role'), false)
	assert.equal(search.el.querySelector('input').getAttribute('role'), 'searchbox')
	assert.equal(search.el.querySelector('input').getAttribute('aria-label'), 'Search products')
})

test('select exposes the expansion state on its active combobox', async () => {
	let select = await mount(Select, {ariaLabel: 'Country'})
	assert.equal(select.el.getAttribute('role'), 'combobox')
	assert.equal(select.el.getAttribute('aria-expanded'), 'false')
	assert.equal(select.el.hasAttribute('aria-haspopup'), false)
	assert.equal(select.el.hasAttribute('aria-controls'), false)
	await change(select, {editing: true})
	let field = select.el.querySelector('input')
	assert.equal(field.getAttribute('role'), 'combobox')
	assert.equal(field.hasAttribute('aria-haspopup'), false)
	assert.equal(field.getAttribute('aria-autocomplete'), 'list')
	assert.equal(select.el.hasAttribute('aria-expanded'), false)
})

test('selectable lists expose options and selection updates', async () => {
	let list = await mount(List, {
		selectable: true,
		multipleSelect: true,
		data: [{value: 'a', text: 'A'}, {value: 'b', text: 'B'}],
		selected: ['a'],
	})

	assert.equal(list.el.getAttribute('role'), 'listbox')
	assert.equal(list.el.getAttribute('aria-multiselectable'), 'true')
	let options = list.el.querySelectorAll('[role="option"]')
	assert.equal(options.length, 2)
	assert.equal(options[0].getAttribute('aria-selected'), 'true')
	assert.equal(options[1].getAttribute('aria-selected'), 'false')
	await change(list, {selected: ['b']})
	assert.equal(options[0].getAttribute('aria-selected'), 'false')
	assert.equal(options[1].getAttribute('aria-selected'), 'true')
})

test('single-selection lists omit the default multiselectable state', async () => {
	let list = await mount(List, {selectable: true})
	assert.equal(list.el.getAttribute('role'), 'listbox')
	assert.equal(list.el.hasAttribute('aria-multiselectable'), false)
})

test('trees expose levels and expansion on items owning child groups', async () => {
	let tree = await mount(List, {
		data: [{value: 'parent', text: 'Parent', children: [{value: 'child', text: 'Child'}]}],
		expanded: ['parent'],
	})

	assert.equal(tree.el.getAttribute('role'), 'tree')
	let parent = tree.el.querySelector('[role="treeitem"]')
	assert.equal(parent.getAttribute('aria-expanded'), 'true')
	assert.equal(parent.getAttribute('aria-level'), '1')
	let child = parent.querySelector('[role="group"] [role="treeitem"]')
	assert.equal(child.getAttribute('aria-level'), '2')
	assert.equal(child.hasAttribute('aria-expanded'), false)
})

test('drop lists expose submenu availability and closed state', async () => {
	let menu = await mount(DropList, {
		data: [{value: 'parent', text: 'Parent', children: [{value: 'child', text: 'Child'}]}],
	})

	assert.equal(menu.el.getAttribute('role'), 'menu')
	let item = menu.el.querySelector('[role="menuitem"]')
	assert.equal(item.getAttribute('aria-haspopup'), 'menu')
	assert.equal(item.getAttribute('aria-expanded'), 'false')
})

test('modal and dialog labels reference their rendered titles', async () => {
	let modal = await mount(Modal, {title: 'Preferences', toCenter() {}})
	let modalPanel = modal.el.querySelector('[role="dialog"]')
	assert.equal(modalPanel.getAttribute('aria-modal'), 'true')
	let modalTitle = modalPanel.getAttribute('aria-labelledby')
	assert.equal(modal.el.querySelector('#' + modalTitle).textContent, 'Preferences')
	let dialog = await mount(Dialog, {
		options: {title: 'Confirm', message: 'Continue?'},
		toCenter() {},
	})
	let panel = dialog.el.querySelector('[role="dialog"]')
	assert.equal(panel.getAttribute('aria-modal'), 'true')
	let title = panel.getAttribute('aria-labelledby')
	assert.equal(dialog.el.querySelector('#' + title).textContent.trim(), 'Confirm')
	let message = panel.getAttribute('aria-describedby')
	assert.equal(dialog.el.querySelector('#' + message).textContent.trim(), 'Continue?')
})

test('dialogs with structured content omit the flattened description', async () => {
	let dialog = await mount(Dialog, {
		options: {title: 'Details', message: 'Review these items', list: ['First', 'Second']},
		toCenter() {},
	})
	let panel = dialog.el.querySelector('[role="dialog"]')
	assert.equal(panel.hasAttribute('aria-describedby'), false)
	assert.equal(panel.hasAttribute('aria-labelledby'), true)
})

test('indeterminate loading has a label and hides decorative SVGs', async () => {
	let loader = await mount(Loader, {ariaLabel: 'Loading records'})
	assert.equal(loader.el.getAttribute('role'), 'progressbar')
	assert.equal(loader.el.getAttribute('aria-label'), 'Loading records')
	assert.equal(loader.el.hasAttribute('aria-valuenow'), false)
	assert.equal(loader.el.querySelector('svg').getAttribute('aria-hidden'), 'true')
})

test('dropdown exposes false and true expansion states', async () => {
	let dropdown = await mount(Dropdown, {popupRole: 'menu'})
	assert.equal(dropdown.el.getAttribute('role'), 'button')
	assert.equal(dropdown.el.getAttribute('aria-haspopup'), 'menu')
	assert.equal(dropdown.el.getAttribute('aria-expanded'), 'false')
	await change(dropdown, {_opened: true})
	assert.equal(dropdown.el.getAttribute('aria-expanded'), 'true')
})

test('table headers expose sortable and active ordering states', async () => {
	let ssr = new SSR('/')
	let table = new Table(document.createElement('div'))
	let column = {name: 'name', title: 'Name', orderBy: 'name'}
	let container = document.createElement('div')
	container.innerHTML = await ssr.render(table.renderColumn(column, 0))
	let header = container.querySelector('[role="columnheader"]')
	assert.equal(header.getAttribute('aria-sort'), 'none')
	assert.equal(header.hasAttribute('aria-colindex'), false)
	table.orderName = 'name'
	table.orderDirection = 'desc'
	container.innerHTML = await ssr.render(table.renderColumn(column, 0))
	assert.equal(container.querySelector('[role="columnheader"]').getAttribute('aria-sort'), 'descending')
})

test('table row indices are only supplied for virtual rows', async () => {
	let ssr = new SSR('/')
	let table = new Table(document.createElement('div'))
	let container = document.createElement('div')
	container.innerHTML = await ssr.render(table.renderHead())
	assert.equal(container.querySelector('[role="row"]').hasAttribute('aria-rowindex'), false)
	container.innerHTML = await ssr.render(table.renderRow({}, 0))
	assert.equal(container.querySelector('[role="row"]').hasAttribute('aria-rowindex'), false)
	table.live = true
	table.repeatRef = {startIndex: 10}
	container.innerHTML = await ssr.render(table.renderHead())
	assert.equal(container.querySelector('[role="row"]').getAttribute('aria-rowindex'), '1')
	container.innerHTML = await ssr.render(table.renderRow({}, 0))
	assert.equal(container.querySelector('[role="row"]').getAttribute('aria-rowindex'), '12')
})
