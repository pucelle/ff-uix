import {css, html} from 'lupos.html'
import {Icon} from './icon'
import {IconClose, IconSearch} from '../icons'
import {Input} from './input'


interface SearchEvents {

	/** Triggers after search value changed. */
	change: (value: string) => void
}


/** 
 * `<Search>` allows text input to perform searches.
 * It contains only an input, can be extend to list suggested data.
 */
export class Search<E = {}> extends Input<SearchEvents & E> {

	static override style = css`
		.search{
			background: var(--input-background);
			border: 1px solid var(--border-color);
			border-radius: var(--border-radius);
			padding: 0 0.2em;
			box-shadow: none;
			
			&:focus{
				border-color: var(--primary-color);
				box-shadow: 0 0 var(--focus-shadow-blur-radius) var(--primary-color);
			}

			.input-icon{
				color: var(--border-color);
				height: 100%;
			}

			.input-field{
				background: transparent;
				height: 100%;
				padding: 0.2em 0.2em;
			}
		}

		.search-icon{
			color: var(--border-color);
			height: 100%;
		}

		.search-clear-icon{
			color: var(--border-color);
			cursor: pointer;
			height: 100%;

			&:hover{
				color: var(--primary-color);
			}

			&:active{
				transform: translateY(1px);
			}
		}
	`

	override icon: string = IconSearch

	protected override render() {
		return html`
			<template class="input search size-${this.size}">
				${this.renderIcon()}
				${this.renderField()}

				<lu:if ${this.value}>
					${this.renderClearIcon()}
				</lu:if>
			</template>
		`
	}

	protected renderClearIcon() {
		return html`
			<Icon class="search-clear-icon"
				.icon=${IconClose}
				@click.stop=${this.clear}
			/>
		`
	}

	protected clear(this: Search) {
		this.value = ''
		this.fire('change', '')
	}
}