import {css, html, fade} from 'lupos.html'
import {Popup} from './popup'
import {Triangle} from './triangle'



/** `<Menu>` displays a menu with a `<List>` or `<DropList>` inside. */
export class Menu<E = {}> extends Popup<E> {

	static override style = css`
		.menu{
			max-width: 30em;
			padding: 0.4em 1.2em;
			
			.list{
				border-bottom: none;
				max-height: 100%;
				overflow-y: auto;
			}

			.list-item{
				&:hover, &.selected{
					background: none;
					color: var(--primary-color);
				}
			}

			.list-content{
				padding-inline: 0;
			}

			.list-item-container{
				&:not(:last-child){
					border-bottom: 1px solid color-mix(in srgb, var(--border-color) 20%, transparent);
				}
			}
		}

		.menu-triangle{
			left: 1em;
		}

		.menu-header{
			display: flex;
			font-size: calc(1em - 1px);
			padding-bottom: 0.4em;
			border-bottom: 1px solid var(--border-color);
		}

		.menu-title{
			flex: 1;
			min-width: 0;
			padding: 0 1em 0 0;
			font-weight: bold;
			overflow: hidden;
			white-space: nowrap;
			text-overflow: ellipsis;
		}
	`


	/** Menu title. */
	title: string = ''

	protected override render() {
		return html`
			<template class="popup menu"
				:transition.immediate=${fade()}
			>
				<lu:if ${this.triangle}>
					<Triangle class="menu-triangle"
						.direction=${this.triangleDirection}
						.width=${this.triangleWidth}
						.height=${this.triangleHeight}
					/>
				</lu:if>
				${this.renderHead()}
				<slot />
			</template>
		`
	}

	protected renderHead() {
		if (!this.title) {
			return null
		}

		return html`
			<div class="menu-header">
				<div class="menu-title">${this.title}</div>
			</div>
		`
	}
}
