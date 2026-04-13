import {Component, html, css} from 'lupos.html'

import {Icon} from './icon'
import {IconClose} from '../icons'


interface TagEvents {

	/** Triggers after closed tag. */
	close: (value: string | number | null) => void
}


/** `<Tag>` is typically used to categorize content with a text label. */
export class Tag<E = {}> extends Component<E & TagEvents> {

	static override style = css`
		.tag{
			display: inline-flex;
			border: 1px solid var(--border-color);
			border-radius: var(--border-radius);
			padding: 0 0.4em;
			cursor: pointer;

			&:hover{
				color: var(--primary-color);
				border-color: var(--primary-color);
			}

			&:active{
				color: var(--primary-color);
				border-color: var(--primary-color);
			}
		}

		.tag-label{
			font-size: calc(1em - 1px);
			flex: 1;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
			padding-right: 0.2em;
		}
	
		.tag-close-icon{
			display: inline-flex;
			margin-right: -0.2em;

			&:hover{
				color: var(--error-color);
			}

			&:active{
				color: var(--error-color);
				transform: translateY(1px);
			}
		}
	`


	/** Unique value to identify current tag. */
	value: string | number | null = null

	/** 
	 * Whether current tag closeable.
	 * Not tag element were not removed automatically,
	 * you must capture close event and update rendered result.
	 */
	closable: boolean = false

	protected override render() {
		return html`
			<template class="tag">
				<span class="tag-label"><slot /></span>
				<lu:if ${this.closable}>
					<Icon class="tag-close-icon"
						.code=${IconClose}
						.height=${19}
						@click=${this.close}
					/>
				</lu:if>
			</template>
		`
	}

	protected close(this: Tag) {
		this.fire('close', this.value)
	}
}
