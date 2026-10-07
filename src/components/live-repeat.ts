import {LiveRenderer} from './repeat-helpers/live-renderer'
import {effect} from 'lupos'
import {PartialRepeat} from './partial-repeat'
import {URLUtils} from 'ff-kit'
import {IN_SSR, setSSRPaging} from 'lupos.html'


/** 
 * `<LiveRepeat>` dynamically renders visible portions of data in list format.
 * 
 * Compared to `<Repeat>`, `<LiveRepeat>` renders only visible data items and
 * dynamically updates them during user scrolling.
 * 
 * Compared to `<PartialRepeat>`, `<LiveRepeat>` is more efficient but
 * requires it's the only content of whole scroller, and supports `paging`.
 * So it is more fits for rendering
 * huge complex contents.
 * 
 * Some restrictions you need to know:
 * - `<LiveRepeat>` must be contained in a scroller element with `overflow: auto / scroll`.
 * - `<LiveRepeat>` must be the only child of the scroller element.
 * - `<LiveRepeat>` must in `absolute` position.
 * - `<LiveRepeat>` must have no margin, but can have padding set.
 * - The scroller element must not in `static` position.
 */
export class LiveRepeat<T = any, E = {}> extends PartialRepeat<T, E> {

	/** Partial content renderer. */
	declare protected renderer: LiveRenderer

	override reservedPixels: number = 400

	/** 
	 * Whether partial rendering content as follower,
	 * so the partial renderer only renders by current scroll position,
	 * and will never cause scroll position change.
	 * Normally can use it at secondary columns of waterfall layout.
	 */
	readonly asFollower: boolean = false

	/** 
	 * If provided, it specifies the suggested end position,
	 * to indicate the size of each item.
	 * The size has no need to represent real size,
	 * only represents the mutable part would be enough.
	 * Which means: can ignores shared paddings or margins.
	 */
	preEndPositions: number[] | null = null

	/** 
	 * When paging becomes true, url part `?page=3` will cause
	 * scroll to start index as `reservedCount * 2`.
	 * Note only one paging Component is allowed in each page.
	 * Note you'd better set `reservedCount` to at least 1.5x item count for each page.
	 */
	paging: boolean = false

	/** Apply `preEndPositions` to renderer. */
	@effect
	protected applyPreEndPositions() {
		this.renderer.setPreEndPositions(this.preEndPositions)
	}

	protected override initPlaceholders() {
		if (this.asFollower) {
			return
		}

		if (this.placeholders) {
			return
		}

		this.placeholders = new Array(1)
		this.placeholders[0] = document.createElement('div')
		this.placeholders[0].style.cssText = 'position: absolute; left: 0; top: 0; width: 1px; visibility: hidden;'
		this.scroller.prepend(this.placeholders[0])
	}

	/** Init renderer when connected. */
	protected override initRenderer() {
		if (this.renderer) {
			return
		}

		let scroller = this.scroller
		let slider = this.el

		while (slider.parentElement !== scroller) {
			slider = slider.parentElement!
		}

		this.renderer = new LiveRenderer(
			this.scroller!,
			slider,
			this.el,
			this,
			this.doa,
			this.updateLiveData.bind(this),
			this.onAfterMeasured.bind(this),
			this.placeholders?.[0] ?? null,
			this.asFollower
		)

		if (this.paging) {
			this.applyPagingIndex()
		}
	}
	
	/** Apply ?paging=2 to start visible index. */
	protected applyPagingIndex() {
		let page = URLUtils.parseQuery(location.search).page
		if (page && Number(page) > 1) {
			let startIndex = this.reservedCount * (Number(page) - 1)
			this.setStartVisibleIndex(startIndex)

			// The page query will be replaced by router,
			// so no need to replace page query here.
		}
	}

	/** Apply SSR paging state. */
	protected override onUpdated() {
		super.onUpdated()

		if (IN_SSR && this.paging && this.data) {
			let startIndex = this.startIndex
			let totalPage = Math.ceil(this.data.length / this.reservedCount)

			if (totalPage > 1) {
				setSSRPaging({
					current: Math.floor(startIndex / this.reservedCount) + 1,
					total: totalPage,
				})
			}
		}
	}
}
