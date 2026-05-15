import {css, Component, html, RenderResult, RenderResultRenderer, fold, PerFrameTransitionEasingName, TransitionResult, FoldTransitionOptions} from 'lupos.html'
import {DOMEvents, EventKeys, Observed, UpdateQueue, effect} from 'lupos'
import {ListDataNavigator} from './list-helpers/list-data-navigator'
import {Icon} from './icon'
import {tooltip, TooltipOptions} from '../bindings/tooltip'
import {contextmenu} from '../bindings/contextmenu'
import {PopupOptions} from '../bindings/popup'
import {IconChecked, IconTriangleRight} from '../icons'
import {DOMScroll} from '../tools'
import {PartialRepeat} from './partial-repeat'
import {CSSUtils} from 'ff-kit'


/** List item and index. */
export interface ItemPath<T> {
	item: ListItem<T>
	index: number
}


/** 
 * Base type of list item.
 * If data struct you have is absolutely different with this,
 * you may declare a class to implement this.
 */
export interface ListItem<T = any> extends Observed {

	/** 
	 * Unique value to identify current item.
	 * If is `undefined`, will render it as splitter.
	 */
	value?: T

	/** 
	 * List item text.
	 * If list should support searching, you should specify this text.
	 */
	text?: string

	/** 
	 * Render result to show as list content.
	 * Note it doesn't support searching.
	 */
	content?: RenderResult

	/** 
	 * List item icon type.
	 * Can be empty string to make it not show icon, but have a icon placeholder.
	 */
	icon?: string

	/** Tooltip content to show as tooltip when mouse hover. */
	tooltip?: RenderResultRenderer

	/** 
	 * Child items to render subsection list.
	 * Can insert an empty object `{}` to represent a splitter.
	 * If any element have child, all siblings should provide an empty list as children.
	 */
	children?: ListItem<T>[]
}

export interface ListEvents<T> {

	/** 
	 * Fires after selected items changed.
	 * Only user interaction can cause `select` event get triggered.
	 */
	select: (selected: ReadonlyArray<T>) => void

	/** Fires after clicked a list item. */
	click: (clicked: T) => void
}


/** 
 * `<List>` renders data items as a list,
 * and supports sub list.
 * Otherwise it provides single or multiple selection,
 * and direction key navigation.
 * 
 * Use it like:
 * `<List .data=${[{text, icon?, tip?}]}>` or
 * `<List .data=${[...]} .itemRenderer=${(item) => html`...`}>`
 */
export class List<T = any, E = {}> extends Component<E & ListEvents<T>> {

	/** Walk item and all descendant items recursively. */
	static *walkItems<T>(item: ListItem<T>): Iterable<ListItem<T>> {
		yield item

		if (item.children) {
			for (let child of item.children) {
				if (child.hasOwnProperty('value')) {
					yield* List.walkItems(child as ListItem<T>)
				}
			}
		}
	}

	static override style = css`
		.list{
			display: block;
		}

		.list-splitter{
			height: 1px;
			background: color-mix(in srgb, var(--border-color) 50%, var(--background));
			margin: 2px 0;
		}

		/* Contains list item and subsection. */
		.list-item-container{}
		
		.list-item{
			position: relative;
			display: flex;
			align-items: stretch;
			cursor: pointer;

			&:hover{
				background: light-dark(
					color-mix(in srgb, var(--text-color) 4%, var(--background)),
					color-mix(in srgb, var(--text-color) 7%, var(--background))
				);
			}

			&.selected{
				background: light-dark(
					color-mix(in srgb, var(--primary-color) 7%, var(--background)),
					color-mix(in srgb, var(--primary-color) 12%, var(--background))
				);
			}

			&.list-menu-active{
				background: light-dark(
					color-mix(in srgb, var(--text-color) 4%, var(--background)),
					color-mix(in srgb, var(--text-color) 7%, var(--background))
				);
			}

			&.arrow-selected{
				background: light-dark(
					color-mix(in srgb, var(--text-color) 4%, var(--background)),
					color-mix(in srgb, var(--text-color) 7%, var(--background))
				);
			}
		}

		.list-indents{
			visibility: hidden;
		}

		.list-toggle-placeholder{
			display: flex;
			width: 2em;
			margin-right: -0.5em;
			opacity: 0.7;
			justify-content: center;
			align-items: center;
		}

		.list-toggle-icon{
			transition: transform 0.2s ease-out;
		}

		.list-icon{
			margin-right: 0.2em;
			display: flex;
			justify-content: center;
			align-items: center;
		}

		.list-content{
			flex: 1;
			min-width: 0;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
			padding: 0.4em 0.6em;
		}

		.list-selected-icon{
			display: flex;
			margin: auto 0.2em auto 0.4em;
		}

		.list-partial-repeat{}

		.list-subsection{
			overflow: hidden;
		}
	`


	/** 
	 * Whether each item is selectable, only available for `selection` mode.
	 * Default value is `false`.
	 */
	selectable: boolean = false

	/** 
	 * Whether can select multiple items, only available for `selection` mode.
	 * Default value is `false`.
	 */
	multipleSelect: boolean = false

	/** 
	 * Whether can select directory.
	 * If specifies as `false`, items have children will not be selected.
	 * Default value is `true`.
	 */
	dirSelectable: boolean = true

	/** Each indent padding, can be pixel number, or string em value.*/
	indentSize: number | string = '1.5em'

	/** Start indent size, can be pixel number, or string em value. */
	startIndentSize: number | string = 0

	/** Input data list. */
	data: ListItem<T>[] = []

	/** Renderer to render list item to content. */
	contentRenderer: ((item: ListItem<T>) => RenderResult) | null = null

	/** Indicates currently selected values. */
	selected: T[] = []

	/** Currently expanded items. */
	expanded: T[] = []

	/** If provided, will start partial rendering for large list. */
	partialRenderingScrollerSelector: string | null = null

	/** 
	 * If specified, when this element get focus,
	 * you can use keyboard arrow keys to navigate across current list.
	 */
	keyComeFrom: HTMLInputElement | HTMLTextAreaElement | null | (() => HTMLInputElement | HTMLTextAreaElement | null) = null

	/** Tooltip options for list item tooltip. */
	tooltipOptions: Partial<TooltipOptions> = {}

	/** 
	 * Selected and all parental indices by keyboard navigation.
	 * Only the last index is the truly selected.
	 */
	protected readonly keyNavigator: ListDataNavigator<T> = new ListDataNavigator()

	/** For only latest expanded or collapsed can play transition. */
	protected latestExpandedOrCollapsed: T | null = null

	/** Whether watching keyboard navigation events. */
	protected inKeyNavigating: boolean = false

	@effect
	protected applyKeyNavigatorProperties() {
		this.keyNavigator.update(this.data, this.expanded)
	}

	protected override render() {
		return html`
			<template class="list">
				${this.renderItems(this.data, 0)}
			</template>
		`
	}

	protected renderItems(items: ListItem<T>[], depth: number): RenderResult {
		if (this.shouldRenderPartialRepeat(items)) {
			return html`
				<PartialRepeat class="list-partial-repeat"
					.data=${items}
					.renderFn=${(item: ListItem<T>) => this.renderItemOrSplitter(item, depth)}
					.overflowDirection="vertical"
					.guessedItemSize=${25}
					.scrollerSelector=${this.partialRenderingScrollerSelector}
				/>
			`
		}
		else {
			return html`
				<lu:for ${items}>${(item: ListItem<T>) => {
					return this.renderItemOrSplitter(item, depth)
				}}</lu:for>
			`
		}
	}

	protected shouldRenderPartialRepeat(items: ListItem<T>[]) {
		return this.partialRenderingScrollerSelector && items.length > 50
	}

	protected renderItemOrSplitter(item: ListItem<T>, depth: number): RenderResult {
		if (item.value === undefined) {
			return html`<div class="list-splitter"></div>`
		}
		else {
			return this.renderItem(item as ListItem<T>, depth)
		}
	}

	protected renderItem(item: ListItem<T>, depth: number): RenderResult {
		let expanded = this.hasExpanded(item.value!)
		let itemTooltip = this.renderTooltip(item)
		let itemContextmenu = this.renderContextmenu(item)

		return html`
			<div class="list-item-container">
				<div
					class="list-item"
					:class.selected=${this.hasSelected(item.value!)}
					:class.arrow-selected=${item === this.keyNavigator.current}
					?:tooltip=${itemTooltip, itemTooltip!, this.tooltipOptions}
					?:contextmenu=${itemContextmenu, itemContextmenu!, {matchSelector: '.list-item', activeClassName: 'list-menu-active'} as PopupOptions}
					@click.prevent=${() => this.onClickItem(item)}
				>
					${this.renderIndents(depth)}
					${this.renderItemPlaceholder(item, expanded)}
					${this.renderItemIcon(item)}
					${this.renderListContent(item)}
					${this.renderSelectedIcon(item)}
				</div>

				${this.renderSubsection(item, expanded, depth)}
			</div>
		`
	}

	protected renderIndents(depth: number) {
		let indentWidth = CSSUtils.add(CSSUtils.multiply(this.indentSize, depth)!, this.startIndentSize)

		return html`
			<div class="list-indents"
				:style.width=${indentWidth}
			></div>
		`
	}

	protected renderItemPlaceholder(item: ListItem<T>, expanded: boolean) {
		let children = item.children
		if (!children) {
			return null
		}

		if (children.length > 0) {
			return html`
				<div class="list-toggle-placeholder"
					@click.stop=${() => this.toggleExpanded(item.value!)}
				>
					${this.renderExpandIcon(expanded)}
				</div>
			`
		}
		else {
			return html`<div class="list-toggle-placeholder" />`
		}
	}

	protected renderExpandIcon(expanded: boolean) {
		return html`
			<Icon class="list-toggle-icon"
				:style.transform=${expanded ? 'rotate(90deg)': 'none'}
				.code=${IconTriangleRight}
			/>`
	}

	protected renderItemIcon(item: ListItem<T>) {
		if (item.icon === undefined) {
			return null
		}

		return html`
			<div class="list-icon">
				<lu:if ${item.icon}>
					<Icon .code=${item.icon!} />
				</>
			</div>
		`
	}

	/** Decide how to render list item tooltip, can be overwritten. */
	protected renderTooltip(item: ListItem<T>): RenderResultRenderer | undefined {
		return item.tooltip
	}

	/** Decide how to render list item tooltip, can be overwritten. */
	protected renderContextmenu(_item: ListItem<T>): RenderResultRenderer {
		return null
	}

	/** 
	 * Render list content, can be overwritten for sub classes
	 * who know about more details about data items.
	 */
	protected renderListContent(item: ListItem<T>): RenderResult {
		return html`
			<div class="list-content">
				${this.renderItemContent(item)}
			</div>
		`
	}

	/** Render content or text for select display. */
	protected renderItemContent(item: ListItem<T>): RenderResult | undefined {
		return this.contentRenderer ? this.contentRenderer(item) : item.content ?? item.text
	}

	protected renderSelectedIcon(item: ListItem<T>) {
		if (!this.hasSelected(item.value!)) {
			return null
		}

		return html`
			<Icon class="list-selected-icon" .code=${IconChecked} />
		`
	}

	protected renderSubsection(item: ListItem<T>, expanded: boolean, depth: number) {
		let children = item.children
		if (!children || children.length === 0 || !expanded) {
			return null
		}

		return html`
			<div class="list-subsection"
				:transition.immediate=${
					() => item.value === this.latestExpandedOrCollapsed
						? fold() as TransitionResult<Element, FoldTransitionOptions>
						: null
				}
			>
				${this.renderItems(children!, depth + 1)}
			</div>
		`
	}

	/** Whether an item has been selected.  */
	protected hasSelected(value: T): boolean {
		return this.selected.includes(value)
	}

	/** Whether an item has been expanded.  */
	protected hasExpanded(value: T): boolean {
		return this.expanded.includes(value)
	}

	/** Toggle expanded state. */
	protected toggleExpanded(value: T) {
		if (this.hasExpanded(value)) {
			this.expanded.splice(this.expanded.indexOf(value), 1)
		}
		else {
			this.expanded.push(value)
		}

		this.latestExpandedOrCollapsed = value
	}

	/** Do selection or navigation. */
	protected onClickItem(this: List, item: ListItem<T>) {
		if (this.selectable && (this.dirSelectable || !item.children)) {
			if (this.multipleSelect) {
				if (this.selected.includes(item.value)) {
					this.selected.splice(this.selected.indexOf(item.value), 1)
				}
				else {
					this.selected.push(item.value)
				}
			}
			else {
				this.selected = [item.value]
			}

			this.fire('select', this.selected)
		}

		this.fire('click', item.value)
	}

	/** 
	 * If get contained in a scroller, scroll first selected item to topmost or leftmost of scroll viewport.
	 * Returns a promise which will be resolved after scrolling end,
	 * and resolve by whether scrolled.
	 */
	async scrollSelectedToStart(gap?: number, duration?: number, easing?: PerFrameTransitionEasingName): Promise<boolean> {
		if (this.selected.length !== 1) {
			return false
		}

		let el = this.el.querySelector('.list-item.selected') as HTMLElement | null
		if (!el) {
			let selected = this.selected[0]
			let itemPath = this.findItemPathsTo(selected)
			if (!itemPath) {
				return false
			}
			
			if (!await this.ensureItemPathsRendered(itemPath)) {
				return false
			}

			el = this.el.querySelector('.list-item.selected') as HTMLElement | null
		}
		
		if (el) {
			return DOMScroll.scrollToStart(el, null, gap, duration, easing)
		}
		else {
			return false
		}
	}

	/** 
	 * If get contained in a scroller, scroll to view first selected item.
	 * Returns a promise which will be resolved after scrolling end,
	 * and resolve by whether scrolled.
	 */
	async scrollSelectedToView(gap?: number, duration?: number, easing?: PerFrameTransitionEasingName): Promise<boolean> {
		let el = this.el.querySelector('.list-item.selected') as HTMLElement | null
		if (!el) {
			let selected = this.selected[0]
			let itemPath = this.findItemPathsTo(selected)
			if (!itemPath) {
				return false
			}
			
			if (!await this.ensureItemPathsRendered(itemPath)) {
				return false
			}

			el = this.el.querySelector('.list-item.selected') as HTMLElement | null
		}

		if (el) {
			return DOMScroll.scrollToView(el, null, gap, duration, easing)
		}
		else {
			return false
		}
	}

	/** Ensure an item, and all of it's ancestors rendered. */
	async ensureItemRendered(value: T): Promise<boolean> {
		let itemPath = this.findItemPathsTo(value)
		if (!itemPath) {
			return false
		}
		
		return await this.ensureItemPathsRendered(itemPath)
	}

	/** Looking for the all the ancestral list items for specified value. */
	findItemPathsTo(value: T): ItemPath<T>[] | undefined {
		for (let {path, dir} of this.walkForItemPath()) {
			if (path.item.value === value) {
				return [...dir, path]
			}
		}

		return undefined
	}

	private async ensureItemPathsRendered(itemPaths: ItemPath<T>[]): Promise<boolean> {

		// Expand all but not last, and wait for rendered.
		if (this.expandByItemPaths(itemPaths)) {
			await UpdateQueue.untilAllComplete()
		}

		return this.ensureEachItemPathRendered(this.el, 0, itemPaths)
	}

	private async ensureEachItemPathRendered(el: HTMLElement, depth: number, itemPaths: ItemPath<T>[]): Promise<boolean> {
		let {index} = itemPaths[depth]
		let childItemContainer: HTMLElement | null = null

		let partialRepeatEl = el.querySelector(`:scope > .list-partial-repeat`)
		if (partialRepeatEl) {
			let partialRepeat = PartialRepeat.from(partialRepeatEl)
			if (partialRepeat) {
				await partialRepeat.toRenderItemAtIndex(index, 'start')
				childItemContainer = partialRepeat.getElementAtIndex(index) ?? null
			}
		}
		else {
			childItemContainer = el.children[index] as HTMLElement | null
		}

		if (depth === itemPaths.length - 1) {
			return true
		}

		let childSubsection = childItemContainer?.querySelector(':scope > .list-subsection') as HTMLElement | null | undefined
		if (!childSubsection) {
			return false
		}

		return this.ensureEachItemPathRendered(childSubsection, depth + 1, itemPaths)
	}

	/** Walk for item and path. */
	protected *walkForItemPath(): Iterable<{path: ItemPath<T>, dir: ItemPath<T>[]}> {
		return yield* this.walkItemsForItemPath(this.data, [])
	}

	/** Walk for item and path. */
	protected *walkItemsForItemPath(items: ListItem<T>[], paths: ItemPath<T>[]): Iterable<{path: ItemPath<T>, dir: ItemPath<T>[]}> {
		for (let index = 0; index < items.length; index++) {
			let item = items[index]

			let path: ItemPath<T> = {
				item,
				index,
			}

			yield {path, dir: paths}

			if (item.children) {
				let childPaths = [...paths, path]
				yield* this.walkItemsForItemPath(item.children, childPaths)
			}
		}
	}

	/** 
	 * Expand item, and all of it's ancestors recursively.
	 * This method will not visit dom properties, so no need update complete.
	 * Note this method will walk all data items recursively.
	 * Returns whether expanded state changed.
	 */
	expandDeeply(value: T): boolean {
		let itemPaths = this.findItemPathsTo(value)
		if (!itemPaths) {
			return false
		}

		return this.expandByItemPaths(itemPaths)
	}

	/** Returns whether expanded state changed. */
	protected expandByItemPaths(itemPaths: ItemPath<T>[]): boolean {
		let expandedChanged = false

		for (let index = 0; index < itemPaths.length - 1; index++) {
			let item = itemPaths[index].item
			if (!this.hasExpanded(item.value!)) {
				this.expanded.push(item.value!)
				expandedChanged = true
			}
		}

		return expandedChanged
	}

	protected lastKeyComeFrom: HTMLElement | null = null

	/** On `keyComeFrom` property change. */
	@effect
	protected onKeyComeFromChange() {
		let comeFrom = typeof this.keyComeFrom === 'function'
			? this.keyComeFrom()
			: this.keyComeFrom

		if (!comeFrom) {
			return
		}

		if (this.lastKeyComeFrom) {
			DOMEvents.off(this.lastKeyComeFrom, 'keydown', this.keyNavigateByEvent, this)
			DOMEvents.off(this.lastKeyComeFrom, 'blur', this.onKeyComeFromBlur, this)
		}

		if (comeFrom) {
			DOMEvents.on(comeFrom, 'keydown', this.keyNavigateByEvent, this)
			DOMEvents.on(comeFrom, 'blur', this.onKeyComeFromBlur, this)
		}

		this.lastKeyComeFrom = comeFrom
	}

	/** Moves arrow selected by a keyboard event. */
	protected keyNavigateByEvent(e: KeyboardEvent) {

		// Prevent being captured by outer component.
		e.stopPropagation()

		let key = EventKeys.getShortcutKey(e)

		// Active key navigation if not yet.
		if (key === 'ArrowUp' || key === 'ArrowDown') {
			this.inKeyNavigating = true
		}
		
		if (key === 'ArrowUp') {
			this.keyNavigator.moveUp()
		}
		else if (key === 'ArrowDown') {
			this.keyNavigator.moveDown()
		}
		else if (key === 'ArrowLeft') {
			if (this.inKeyNavigating) {
				this.keyNavigator.moveLeft()
			}
		}
		else if (key === 'ArrowRight') {
			if (this.inKeyNavigating) {
				let item = this.keyNavigator.current
				if (item && !this.hasExpanded(item.value!) && item.children) {
					this.toggleExpanded(item.value!)
					this.keyNavigator.moveRight()
				}
			}
		}
		else if (key === 'Enter') {
			if (this.inKeyNavigating) {
				let item = this.keyNavigator.current
				if (item) {
					this.onClickItem(item)
				}
			}
		}
		else if (key === 'Escape') {
			this.inKeyNavigating = false
			this.keyNavigator.clear()
		}
	}

	protected onKeyComeFromBlur() {
		this.inKeyNavigating = false
		this.keyNavigator.clear()
	}
}