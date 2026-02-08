import {css, html, RenderResult, fade} from 'lupos.html'
import {Popup} from './popup'


/** `<Contextmenu>` to render a simple context menu with a `<List>` or `<DropList>` inside. */
export class ContextMenu<E = {}> extends Popup<E> {

	static override style = css`
		.contextmenu{
			position: fixed;

			.list{
				border-bottom: none;
			}
		}
	`

	
	override readonly triangle: boolean = false

	protected override render(): RenderResult {
		return html`
			<template class="popup contextmenu" tabindex="0"
				:transition.immediate=${fade()}
			>
				<slot />
			</template>
		`
	}
}
