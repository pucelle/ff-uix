import {Component, css, html} from 'lupos.html'
import {Icon} from './icon'
import {IconLeft, IconRight} from '../icons'
import {NumberUtils, SizeLike} from 'ff-kit'
import {readSize} from '../bindings/read-size'


/** Normally for previewing wide contents on pad or phone. */
export class Carousel extends Component {

	static override style = css`
		.carousel{
			position: relative;
			overflow: hidden;
		}

		.carousel-inner{
			display: flex;
			flex-direction: row;
			justify-content: center;
			width: max-content;
			transition: transform 0.15s ease-out;
		}

		.carousel-left, .carousel-right{
			position: absolute;
			top: 0;
			bottom: 0;
			width: 25%;
			display: flex;
			justify-content: center;
			align-items: center;

			.icon{
				opacity: 0.5;
			}

			&:hover .icon{
				opacity: 1;
			}

			svg{
				width: 63px;
				height: 63px;
			}
		}

		.carousel-left{
			left: 0;
			background: linear-gradient(to left, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.8));
		}

		.carousel-right{
			right: 0;
			background: linear-gradient(to right, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.8));
		}
	`

	/** 
	 * Carousel item count.
	 * If not specify it, will read carousel item count, only for once.
	 */
	count: number | null = null

	/** 
	 * Whether allow slidable.
	 * 
	 * When `null`, will detect it automatically by comparing
	 * container and inner size.
	 * 
	 * If don't want sliding, reset this property to `false`.
	 */
	slidable: boolean | null = null

	/** Current active element index. */
	index: number = 0

	/** Container width. */
	protected containerWidth: number | null = null

	/** Current active item width. */
	protected currentContentWidth: number | null = null

	protected override render() {
		let arrowWidth: number = 0
		let translateX: number = 0

		let slidable = this.slidable
			?? ((this.currentContentWidth ?? 0) * (this.count ?? 0) > (this.containerWidth ?? 0) + 0.1)

		if (slidable && this.containerWidth && this.currentContentWidth) {
			arrowWidth = (this.containerWidth - this.currentContentWidth) / 2
			translateX = arrowWidth - this.currentContentWidth * this.index
		}

		return html`
			<template class="carousel"
				:readSize=${(size: SizeLike) => this.containerWidth = size.width}
			>
				<div class="carousel-inner"
					:style.transform="translateX(${translateX}px)"
					:readSize=${(size: SizeLike, inner: HTMLElement) => {
						this.count = inner.firstElementChild!.children.length
						this.currentContentWidth = this.count > 0 ? size.width / this.count : 0
					}}
				>
					<slot />
				</div>

				<lu:if ${slidable}>
					<div class="carousel-left"
						:style.width.px=${arrowWidth}
						@click=${() => this.navigateBy(-1)}
					>
						<Icon .code=${IconLeft} />
					</div>
	
					<div class="carousel-right"
						:style.width.px=${arrowWidth}
						@click=${() => this.navigateBy(1)}
					>
						<Icon .code=${IconRight} />
					</div>
				</lu:if>
			</template>
		`
	}

	protected navigateBy(by: number) {
		this.index = NumberUtils.euclideanModulo(this.index + by, this.count!)
	}
}