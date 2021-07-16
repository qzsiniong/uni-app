import {
  createScrollListener,
  CreateScrollListenerOptions,
  disableScrollListener,
  updateCssVar,
} from '@dcloudio/uni-core'
import { formatLog, PageCreateData, UniNodeJSON } from '@dcloudio/uni-shared'

import { UniElement } from './elements/UniElement'
import { UniNode } from './elements/UniNode'
import { BuiltInComponents } from './components'

const elements = new Map<number, UniNode>()

export function $(id: number) {
  return elements.get(id) as UniElement<any>
}

export function removeElement(id: number) {
  if (__DEV__) {
    console.log(formatLog('Remove', id, elements.size - 1))
  }
  return elements.delete(id)
}

export function createElement(
  id: number,
  tag: string,
  parentNodeId: number,
  nodeJson: Partial<UniNodeJSON> = {}
) {
  let element: UniNode
  if (id === 0) {
    // initPageElement
    element = new UniNode(
      id,
      tag as string,
      parentNodeId,
      document.createElement(tag as string)
    )
  } else {
    const Component = BuiltInComponents[tag as keyof typeof BuiltInComponents]
    if (Component) {
      element = new Component(id, parentNodeId, nodeJson)
    } else {
      element = new UniElement(
        id,
        document.createElement(tag),
        parentNodeId,
        nodeJson
      )
    }
  }
  elements.set(id, element)
  return element
}

export function onPageCreated() {}

export function onPageCreate({
  css,
  route,
  platform,
  pixelRatio,
  windowWidth,
  disableScroll,
  onPageScroll,
  onPageReachBottom,
  onReachBottomDistance,
  statusbarHeight,
  windowTop,
  windowBottom,
}: PageCreateData) {
  initPageInfo(route)
  initSystemInfo(platform, pixelRatio, windowWidth)
  // 初始化页面容器元素
  initPageElement()

  if (css) {
    initPageCss(route)
  }

  const pageId = plus.webview.currentWebview().id!
  ;(window as any).__id__ = pageId
  document.title = `${route}[${pageId}]`

  initCssVar(statusbarHeight, windowTop, windowBottom)

  if (disableScroll) {
    document.addEventListener('touchmove', disableScrollListener)
  } else if (onPageScroll || onPageReachBottom) {
    initPageScroll(onPageScroll, onPageReachBottom, onReachBottomDistance)
  }
}

function initPageInfo(route: string) {
  ;(window as any).__PAGE_INFO__ = {
    route,
  }
}

function initSystemInfo(
  platform: string,
  pixelRatio: number,
  windowWidth: number
) {
  ;(window as any).__SYSTEM_INFO__ = {
    platform,
    pixelRatio,
    windowWidth,
  }
}

function initPageElement() {
  createElement(0, 'div', -1).$ = document.getElementById('app')!
}

function initPageCss(route: string) {
  const element = document.createElement('link')
  element.type = 'text/css'
  element.rel = 'stylesheet'
  element.href = route + '.css'
  document.head.appendChild(element)
}

function initCssVar(
  statusbarHeight: number,
  windowTop: number,
  windowBottom: number
) {
  const cssVars = {
    '--window-left': '0px',
    '--window-right': '0px',
    '--window-top': windowTop + 'px',
    '--window-bottom': windowBottom + 'px',
    '--status-bar-height': statusbarHeight + 'px',
  }
  if (__DEV__) {
    console.log(formatLog('initCssVar', cssVars))
  }
  updateCssVar(cssVars)
}

function initPageScroll(
  onPageScroll: boolean,
  onPageReachBottom: boolean,
  onReachBottomDistance: number
) {
  const opts: CreateScrollListenerOptions = {}
  if (onPageScroll) {
    opts.onPageScroll = (scrollTop) => {
      UniViewJSBridge.publishHandler('onPageScroll', { scrollTop })
    }
  }
  if (onPageReachBottom) {
    opts.onReachBottomDistance = onReachBottomDistance
    opts.onReachBottom = () => UniViewJSBridge.publishHandler('onReachBottom')
  }
  // 避免监听太早，直接触发了 scroll
  requestAnimationFrame(() =>
    document.addEventListener('scroll', createScrollListener(opts))
  )
}