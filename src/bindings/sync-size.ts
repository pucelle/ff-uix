import {Binding, Part} from 'lupos.html'
import {barrierDOMWriting, UpdateQueue} from 'lupos'
import {ResizeWatcher, SizeLike} from 'ff-kit'


export interface SyncSizeOptions {

	/** Which size to sync, default value is `width`. */
	at?: 'width' | 'height' | 'both'
}

/** Maximum size of by key. */
const SyncSizeCache: Map<string, SyncSizeCacheItem> = /*#__PURE__*/new Map()

interface SyncSizeCacheItem {
	size: SizeLike
	syncs: Set<syncSize>
}


/**
 * `:syncSize` helps to sync same keyed width or height or both.
 * Not like grid layout, it can persist the size even element disconnected.
 */
export class syncSize implements Binding, Part {

	protected readonly el: HTMLElement
	protected key: string = ''
	protected options: SyncSizeOptions | null = null

	constructor(el: Element) {
		this.el = el as HTMLElement
	}

	update(key: string, options: SyncSizeOptions | null = null) {
		this.key = key
		this.options = options
	}

	async afterConnectCallback() {
		let cache = this.getCache()
		ResizeWatcher.watch(this.el, this.readSize, this)
		cache.syncs.add(this)
	}

	protected getCache(): SyncSizeCacheItem {
		let cache = SyncSizeCache.get(this.key)

		if (!cache) {
			cache = {
				size: {width: 0, height: 0},
				syncs: new Set(),
			}

			SyncSizeCache.set(this.key, cache)
		}

		return cache
	}

	protected async readSize() {
		await UpdateQueue.untilComplete()

		let cache = this.getCache()
		let at = this.options?.at ?? 'width'
	
		if (at === 'width' || at === 'both') {
			let width = this.el.offsetWidth

			if (width > cache.size.width) {
				cache.size.width = width
				await this.syncCacheAt(cache, 'width', width)
			}
			else if (width < cache.size.width) {
				await barrierDOMWriting()
				this.el.style.minWidth = cache.size.width + 'px'
			}
		}

		if (at === 'height' || at === 'both') {
			let height = this.el.offsetHeight

			if (height > cache.size.height) {
				cache.size.height = height
				await this.syncCacheAt(cache, 'height', height)
			}
			else if (height < cache.size.height) {
				await barrierDOMWriting()
				this.el.style.minHeight = cache.size.height + 'px'
			}
		}
	}

	protected async syncCacheAt(cache: SyncSizeCacheItem, at: 'width' | 'height', size: number) {
		if (cache.syncs.size === 0) {
			return
		}

		// Being overwritten.
		if (cache.size[at] !== size) {
			return
		}

		await barrierDOMWriting()

		for (let s of cache.syncs) {
			s.sync(at, size)
		}
	}

	/** Sync with latest size. */
	sync(at: 'width' | 'height', size: number) {
		if (at === 'width') {
			this.el.style.minWidth = size + 'px'
		}
		else {
			this.el.style.minHeight = size + 'px'
		}
	}

	beforeDisconnectCallback(): Promise<void> | void {
		ResizeWatcher.unwatch(this.el, this.readSize, this)

		let cache = SyncSizeCache.get(this.key)
		if (cache) {
			cache.syncs.delete(this)
		}
	}
}
