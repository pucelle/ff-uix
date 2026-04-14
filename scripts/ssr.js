import {SSR} from 'lupos.html/ssr'
import * as fs from 'node:fs'
import {Preview} from '../docs/out/index.js'


async function renderIndex() {
	let ssr = new SSR('/')
		
	let code = await ssr.renderComponent(Preview, 'ff-uix-preview')
	let style = await ssr.renderStyles()

	// Read page template, only for debugging.
	let template = fs.readFileSync('./docs/index-template.html', 'utf-8')
	
	let html = template
		.replace(/<script/, (m0) => style + m0)
		.replace(/<ff-uix-preview><\/ff-uix-preview>/, code)

	fs.writeFileSync('./docs/index.html', html)
}

renderIndex()