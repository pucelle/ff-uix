import {css, html} from 'lupos.html'
import {List, ListItem} from './list'


/** 
 * `<Navigation>` can navigate through various sections or pages.
 * Supports only single item selection.
 */
export class Navigation<T> extends List<T> {

	static override style = css`
		.navigation{
			padding: 0.6em 1.2em;
			border-bottom: none;
			overflow-y: auto;
			overflow-anchor: none;
		}

		.navigation-title{
			font-size: 1.285em;
			font-weight: 300;
			margin-top: 0.3em;
			margin-bottom: 0.6em;
		}
	`

	override partialRenderingScrollerSelector: string | null = '.navigation'

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
}