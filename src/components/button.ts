import {Component, css, html, TemplateResult} from 'lupos.html'


/** `<Button>` is nearly equals `<button>` element. */
export class Button<E = {}> extends Component<E> {

	static override style = css`	
		.button{
			display: inline-flex;
			justify-content: center;
			align-items: center;
			border: 1px solid var(--border-color);
			border-radius: var(--border-radius);
			padding: calc(0.2em - 1px) 0.8em;
			text-align: center;
			cursor: pointer;
			vertical-align: top;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
			background: var(--background);
		
			&:hover, &:focus{
				/* Dynamic --hover-background */
				background: color-mix(in srgb, var(--text-color) 5%, var(--background));
			}

			&:active{
				/* Dynamic --hover-background-bold */
				background: color-mix(in srgb, var(--text-color) 10%, var(--background));
			}

			&.primary{
				background: var(--primary-color);
				border-color: var(--primary-color);
				color: #fff;

				&:hover, &:focus{
					background: var(--primary-hover);
				}

				&:active{
					background: var(--primary-selected);
				}
			}

			&.flat{
				border-color: transparent;
				padding-left: 0;
				padding-right: 0;
				color: var(--text-color-faint);

				&:hover, &:focus{
					background: none;
					color: var(--text-color);
				}

				&:active{
					background: none;
				}
			}
		}
	`

	declare static tagName: 'button'


	/** Whether be primary button. */
	primary: boolean = false

	/** Whether be flat style, has no border. */
	flat: boolean = false

	protected override render(): TemplateResult {
		return html`
			<template
				class="button"
				tabindex="0"
				:class.primary=${this.primary}
				:class.flat=${this.flat}
			/>
		`
	}
}


