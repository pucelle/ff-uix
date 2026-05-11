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
		
			&:hover, &:focus{
				background: color-mix(in srgb, var(--background) 94%, var(--text-color));
			}

			&:focus{
				box-shadow: 0 0 var(--focus-shadow-blur-radius) var(--primary-color);
			}

			&:active{
				background: color-mix(in srgb, var(--background) 88%, var(--text-color));
			}

			.icon{
				&:first-child{
					margin-right: 0.15em;
					margin-left: -0.25em;
				}

				&:last-child{
					margin-left: 0.15em;
					margin-right: -0.25em;
				}

				&:only-child{
					margin-left: -0.25em;
					margin-right: -0.25em;
				}
			}

			&.primary{
				background: var(--primary-color);
				border-color: var(--primary-color);
				color: #fff;
			}

			&.flat{
				border-color: transparent;
				padding-left: 0;
				padding-right: 0;
				color: color-mix(in srgb, var(--border-color) 66%, var(--text-color));

				&:hover, &:focus{
					background: none;
					color: var(--text-color);
				}

				&:active{
					background: none;
				}

				&:focus{
					box-shadow: none;
				}
			}
		}
	`


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


