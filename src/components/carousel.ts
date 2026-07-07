import {Component, css, html, on} from 'lupos.html'
import {Icon} from './icon'
import {IconLeft, IconRight} from '../icons'
import {BoxOffsetKey, Coord, NumberUtils} from 'ff-kit'
import {watchWidth} from '../bindings/watch-size'


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
			z-index: 5;

			.icon{
				opacity: 0.5;

				svg{
					width: 63px;
					height: 63px;
				}
			}

			&:hover{
				.icon{
					opacity: 1;
				}
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

	/** Translate from sliding. */
	protected slidingTranslate: number = 0

	protected override render() {
		let arrowWidth: number = 0
		let translateX: number = 0

		let slidable = this.slidable
			?? ((this.currentContentWidth ?? 0) * (this.count ?? 0) > (this.containerWidth ?? 0) + 0.1)

		if (slidable && this.containerWidth && this.currentContentWidth) {
			arrowWidth = (this.containerWidth - this.currentContentWidth) / 2
			translateX = arrowWidth - this.currentContentWidth * this.index
		}

		translateX += this.slidingTranslate

		return html`
			<template class="carousel"
				:watchWidth=${(width: number) => this.containerWidth = width}
				?:on=${slidable, 'slide:translate', this.handleSlideTranslate}
				?:on=${slidable, 'slide', this.handleSlide}
			>
				<div class="carousel-inner"
					:style.transform="translateX(${translateX}px)"
					:watchWidth=${(width: number, inner: HTMLElement) => {
						this.count = inner.firstElementChild!.children.length
						this.currentContentWidth = this.count > 0 ? width / this.count : 0
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

	protected handleSlideTranslate(_e: TouchEvent, moves: Coord) {
		this.slidingTranslate = moves.x
	}

	protected handleSlide(direction: BoxOffsetKey) {
		if (direction === 'left') {
			this.navigateBy(1)
		}
		else if (direction === 'right') {
			this.navigateBy(-1)
		}
	}

	protected navigateBy(by: number) {
		this.index = NumberUtils.euclideanModulo(this.index + by, this.count!)
	}
}