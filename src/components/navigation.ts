import {css, html, RenderResult} from 'lupos.html'
import {List, ListItem} from './list'
import {tooltip} from '../bindings/tooltip'
import {contextmenu} from '../bindings/contextmenu'
import {PopupOptions} from '../bindings/popup'
import {CSSUtils} from 'ff-kit'


/** 
 * `<Navigation>` can navigate through various sections or pages.
 * Supports only single item selection.
 */
export class Navigation<T> extends List<T> {

	static override style = css`
		.navigation{
			border-bottom: none;
			overflow-y: auto;
			overflow-anchor: none;

			.list-item.selected{
				color: var(--primary-color);
			}
		}

		.navigation-title{
			font-size: 1.285em;
			font-weight: 300;
			margin-top: 0.3em;
			margin-bottom: 0.6em;
		}
	`

	override partialRenderingScrollerSelector: string | null = '.navigation'

	/** 
	 * Whether allow parental list item sticky to top.
	 * - start: Start top value, can be numeric pixel or css value.
	 * - each: Top value for each depth, can be numeric pixel or css value.
	 */
	sticky: {start: number | string, each: number | string} | null = null

	/** Navigation title. */
	title: string = ''

	protected override render() {
		return html`
			<template class="list navigation">
				<lu:if ${this.title}>
					<div class="navigation-title">
						${this.title}
					</div>
				</lu:if>

				${this.renderItems(this.data, 0)}
			</template>
		`
	}

	protected override renderSelectedIcon(_item: ListItem<T>) {
		return null
	}

	protected override renderItem(item: ListItem<T>, depth: number): RenderResult {
		let expanded = this.hasExpanded(item.value!)
		let itemTooltip = this.renderTooltip(item)
		let itemContextmenu = this.renderContextmenu(item)
		let stickyStyle = this.renderStickyStyle(item, depth)

		return html`
			<div class="list-item-container">
				<div
					class="list-item"
					:class.selected=${this.hasSelected(item.value!)}
					:class.arrow-selected=${item === this.keyNavigator.current}
					:style=${stickyStyle ?? {}}
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

	protected renderStickyStyle(item: ListItem<T>, depth: number): Record<string, string> | null {
		if (!this.sticky || !item.children?.length) {
			return null
		}

		let top = CSSUtils.add(this.sticky.start, CSSUtils.multiply(this.sticky.each, depth)!)

		return {
			top,
			'background-color': 'var(--background)',
			'position': 'sticky',
			'z-index': '10',
		}
	}
}