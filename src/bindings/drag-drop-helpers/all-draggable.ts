import {DraggableBase} from '../draggable'
import {droppable} from '../droppable'


const AllDraggableMap: WeakMap<HTMLElement, DraggableBase> = /*#__PURE__*/new WeakMap()
const AllDroppableMap: WeakMap<HTMLElement, droppable> = /*#__PURE__*/new WeakMap()


export function registerDraggable(draggable: DraggableBase) {
	AllDraggableMap.set(draggable.el, draggable)
}

export function unregisterDraggable(draggable: DraggableBase) {
	AllDraggableMap.delete(draggable.el)
}

export function getDraggableByElement(el: HTMLElement) {
	return AllDraggableMap.get(el)
}


export function registerDroppable(droppable: droppable) {
	AllDroppableMap.set(droppable.el, droppable)
}

export function unregisterDroppable(droppable: droppable) {
	AllDroppableMap.delete(droppable.el)
}

export function getDroppableByElement(el: HTMLElement) {
	return AllDroppableMap.get(el)
}