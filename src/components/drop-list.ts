import {css, html, fade} from 'lupos.html'
import {List, ListItem} from './list'
import {popup, PopupOptions} from '../bindings/popup'
import {Popup} from './popup'
import {Icon} from './icon'
import {IconRight} from '../icons'
import {tooltip} from '../bindings/tooltip'
import {contextmenu} from '../bindings/contextmenu'


/** `<DropList>` renders sub list as popup content. */
export class DropList<T> extends List<T> {

	static override style = css`
		.drop-list{
			border-bottom: none;
			padding: 0.5em 0;
			overflow-y: auto;

			.list-item{
				padding-inline: 0.8em;
			}
		}

		.drop-list-subsection{
			padding: 0.5em 0;
			border-radius: var(--border-radius);

			.list-item{
				padding-inline: 0.8em;
			}
		}
		
		.drop-list-selected-icon{
			display: flex;
			margin: auto 0 auto 0.4em;
		}
	`


	/** Additional class name which will apply to popup subsection. */
	subsectionClassName: string = ''

	/** Tooltip options for list item popped-up drop. */
	popupOptions: Partial<PopupOptions> = {}

	protected override render() {
		return html`
			<template class="list drop-list">
				${this.renderItems(this.data, 0)}
			</template>
		`
	}

	protected override renderItem(item: ListItem<T>, depth: number) {
		let children = item.children
		let itemTooltip = this.renderTooltip(item)
		let itemContextmenu = this.renderContextmenu(item)

		return html`
			<div
				class="list-item"
				:class.selected=${this.hasSelected(item.value!)}
				:class.arrow-selected=${item === this.keyNavigator.current}
				?:tooltip=${itemTooltip, itemTooltip!}
				?:contextmenu=${itemContextmenu, itemContextmenu!}
				?:popup=${children && children.length > 0,
					() => this.renderItemPopupContent(item, depth),
					{
						key: 'drop-list',
						position: 'r',
						reTarget: '.list-item',
						activeClassName: 'popped',
						gaps: -1,
						onOpenedChange: (opened: boolean) => {
							this.onPopupOpenedChange(item, opened)
						},
						...this.popupOptions,
					} as Partial<PopupOptions>
				}
				@click.prevent=${() => this.onClickItem(item)}
			>
				${this.renderItemIcon(item)}
				${this.renderListRow(item)}
				${this.renderSelectedIcon(item)}
				${this.renderDropListSelectedIcon(item)}
			</div>
		`
	}

	protected renderItemPopupContent(item: ListItem<T>, depth: number) {
		let children = item.children
		if (!children || children.length === 0) {
			return null
		}

		return html`
			<Popup class="drop-list-subsection ${this.subsectionClassName}"
				:transition=${fade()}
				.triangle=${false}
			>
				${this.renderItems(children!, depth)}
			</Popup>
		`
	}

	protected renderDropListSelectedIcon(item: ListItem<T>) {
		let children = item.children
		if (!children || children.length === 0) {
			return null
		}

		return html`
			<Icon class="drop-list-selected-icon"
				.code=${IconRight}
				.width=${17}
				.height=${21}
			/>
		`
	}

	protected onPopupOpenedChange(item: ListItem<T>, opened: boolean) {
		if (opened) {
			this.expanded.push(item.value!)
		}
		else {
			let index = this.expanded.indexOf(item.value!)
			if (index > -1) {
				this.expanded.splice(index, 1)
			}
		}
	}
}