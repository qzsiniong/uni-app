import {
  Ref,
  ref,
  SetupContext,
  watch,
  onMounted,
  onBeforeMount,
  computed,
  reactive,
  nextTick,
} from 'vue'
import { extend } from '@vue/shared'
import { debounce } from '@dcloudio/uni-shared'
import { throttle } from './throttle'
import { useCustomEvent, CustomEventTrigger } from './useEvent'
import { useUserAction } from './useUserAction'
import {
  props as keyboardProps,
  emit as keyboardEmit,
  useKeyboard,
} from './useKeyboard'
import { useScopedAttrs } from './useScopedAttrs'
import { useFormField } from './useFormField'
import { getCurrentPageId } from '@dcloudio/uni-core'

const pageIds: number[] = []
const UniViewJSBridgeSubscribe = function () {
  const pageId = getCurrentPageId()
  if (pageIds.includes(pageId)) return
  pageIds.push(pageId)

  UniViewJSBridge.subscribe(
    pageId + '.getSelectedTextRange',
    function ({ pageId, callbackId }: { pageId: number; callbackId: number }) {
      const activeElement = document.activeElement
      if (!activeElement) return
      const tagName = activeElement.tagName.toLowerCase()
      const tagNames = ['input', 'textarea']
      const data: {
        errMsg?: string
        start?: number | null
        end?: number | null
      } = {}
      if (tagNames.includes(tagName)) {
        data.start = (activeElement as HTMLInputElement).selectionStart
        data.end = (activeElement as HTMLInputElement).selectionEnd
      }
      UniViewJSBridge.publishHandler(
        'onGetSelectedTextRange',
        {
          callbackId,
          data,
        },
        pageId
      )
    }
  )
}

// App 延迟获取焦点
const FOCUS_DELAY = 200
let startTime: number

function getValueString(value: any) {
  return value === null ? '' : String(value)
}

interface InputEventDetail {
  value: string
}

type HTMLFieldElement = HTMLInputElement | HTMLTextAreaElement

export const props = /*#__PURE__*/ extend(
  {},
  {
    name: {
      type: String,
      default: '',
    },
    modelValue: {
      type: [String, Number],
      default: '',
    },
    value: {
      type: [String, Number],
      default: '',
    },
    disabled: {
      type: [Boolean, String],
      default: false,
    },
    /**
     * 已废弃属性，用于历史兼容
     */
    autoFocus: {
      type: [Boolean, String],
      default: false,
    },
    focus: {
      type: [Boolean, String],
      default: false,
    },
    cursor: {
      type: [Number, String],
      default: -1,
    },
    selectionStart: {
      type: [Number, String],
      default: -1,
    },
    selectionEnd: {
      type: [Number, String],
      default: -1,
    },
    type: {
      type: String,
      default: 'text',
    },
    password: {
      type: [Boolean, String],
      default: false,
    },
    placeholder: {
      type: String,
      default: '',
    },
    placeholderStyle: {
      type: String,
      default: '',
    },
    placeholderClass: {
      type: String,
      default: '',
    },
    maxlength: {
      type: [Number, String],
      default: 140,
    },
    confirmType: {
      type: String,
      default: 'done',
    },
  },
  keyboardProps
)

export const emit = [
  'input',
  'focus',
  'blur',
  'update:value',
  'update:modelValue',
  'update:focus',
  ...keyboardEmit,
]

type Props = Record<keyof typeof props, any>

interface State {
  value: string
  maxlength: number
  focus: boolean
  composing: boolean
  selectionStart: number
  selectionEnd: number
  cursor: number
}

function useBase(
  props: Props,
  rootRef: Ref<HTMLElement | null>,
  emit: SetupContext['emit']
) {
  const fieldRef: Ref<HTMLFieldElement | null> = ref(null)
  const trigger = useCustomEvent(rootRef, emit)
  const selectionStart = computed(() => {
    const selectionStart = Number(props.selectionStart)
    return isNaN(selectionStart) ? -1 : selectionStart
  })
  const selectionEnd = computed(() => {
    const selectionEnd = Number(props.selectionEnd)
    return isNaN(selectionEnd) ? -1 : selectionEnd
  })
  const cursor = computed(() => {
    const cursor = Number(props.cursor)
    return isNaN(cursor) ? -1 : cursor
  })
  const maxlength = computed(() => {
    var maxlength = Number(props.maxlength)
    return isNaN(maxlength) ? 140 : maxlength
  })
  const value = getValueString(props.modelValue) || getValueString(props.value)
  const state: State = reactive({
    value,
    valueOrigin: value,
    maxlength,
    focus: props.focus,
    composing: false,
    selectionStart,
    selectionEnd,
    cursor,
  })
  watch(
    () => state.focus,
    (val) => emit('update:focus', val)
  )
  watch(
    () => state.maxlength,
    (val) => (state.value = state.value.slice(0, val))
  )
  return {
    fieldRef,
    state,
    trigger,
  }
}

function useValueSync(
  props: Props,
  state: { value: string },
  emit: SetupContext['emit'],
  trigger: CustomEventTrigger
) {
  const valueChangeFn = debounce((val: any) => {
    state.value = getValueString(val)
  }, 100)
  watch(() => props.modelValue, valueChangeFn)
  watch(() => props.value, valueChangeFn)
  const triggerInputFn = throttle((event: Event, detail: InputEventDetail) => {
    emit('update:modelValue', detail.value)
    emit('update:value', detail.value)
    trigger('input', event, detail)
  }, 100)
  const triggerInput = (
    event: Event,
    detail: InputEventDetail,
    force: boolean
  ) => {
    valueChangeFn.cancel()
    triggerInputFn(event, detail)
    if (force) {
      triggerInputFn.flush()
    }
  }
  onBeforeMount(() => {
    valueChangeFn.cancel()
    triggerInputFn.cancel()
  })
  return {
    trigger,
    triggerInput,
  }
}

function useAutoFocus(props: Props, fieldRef: Ref<HTMLFieldElement | null>) {
  const { state: userActionState } = useUserAction()
  const needFocus = computed(() => props.autoFocus || props.focus)
  function focus() {
    if (!needFocus.value) {
      return
    }
    const field = fieldRef.value
    if (!field || (__PLATFORM__ === 'app' && !('plus' in window))) {
      setTimeout(focus, 100)
      return
    }
    if (__PLATFORM__ === 'h5') {
      field.focus()
    } else {
      const timeout = FOCUS_DELAY - (Date.now() - startTime)
      if (timeout > 0) {
        setTimeout(focus, timeout)
        return
      }
      field.focus()
      // 无用户交互的 webview 需主动显示键盘（安卓）
      if (!userActionState.userAction) {
        plus.key.showSoftKeybord()
      }
    }
  }
  function blur() {
    const field = fieldRef.value
    if (field) {
      field.blur()
    }
  }
  watch(
    () => props.focus,
    (value) => {
      if (value) {
        focus()
      } else {
        blur()
      }
    }
  )
  onMounted(() => {
    startTime = startTime || Date.now()
    if (needFocus.value) {
      // nextTick 为了保证逻辑在initField之后执行
      nextTick(focus)
    }
  })
}

function useEvent(
  fieldRef: Ref<HTMLFieldElement | null>,
  state: State,
  trigger: CustomEventTrigger,
  triggerInput: Function,
  beforeInput?: (event: Event, state: State) => any
) {
  function checkSelection() {
    const field = fieldRef.value
    if (
      field &&
      state.focus &&
      state.selectionStart > -1 &&
      state.selectionEnd > -1
    ) {
      field.selectionStart = state.selectionStart
      field.selectionEnd = state.selectionEnd
    }
  }
  function checkCursor() {
    const field = fieldRef.value
    if (
      field &&
      state.focus &&
      state.selectionStart < 0 &&
      state.selectionEnd < 0 &&
      state.cursor > -1
    ) {
      field.selectionEnd = field.selectionStart = state.cursor
    }
  }
  function initField() {
    const field = fieldRef.value as HTMLFieldElement
    const onFocus = function (event: Event) {
      state.focus = true
      trigger('focus', event, {
        value: state.value,
      })
      // 从 watch:focusSync 中移出到这里。在watcher中如果focus初始值为ture，则不会执行以下逻辑
      checkSelection()
      checkCursor()
    }
    const onInput = function (event: Event, force?: boolean) {
      event.stopPropagation()
      let beforeInputDetail: Object | Boolean | undefined = {}
      if (
        typeof beforeInput === 'function' &&
        (beforeInputDetail = beforeInput(event, state)) === false
      ) {
        return
      }
      state.value = field.value
      if (!state.composing) {
        triggerInput(
          event,
          Object.assign(
            {
              value: field.value,
              cursor: field.selectionEnd,
            },
            (() =>
              beforeInputDetail instanceof Object
                ? beforeInputDetail
                : undefined)()
          ),
          force
        )
      }
    }
    const onBlur = function (event: Event) {
      // iOS 输入法 compositionend 事件可能晚于 blur
      if (state.composing) {
        state.composing = false
        onInput(event, true)
      }
      state.focus = false
      trigger('blur', event, {
        value: state.value,
        cursor: (event.target as HTMLFieldElement).selectionEnd,
      })
    }
    // 避免触发父组件 change 事件
    field.addEventListener('change', (event: Event) => event.stopPropagation())
    field.addEventListener('focus', onFocus)
    field.addEventListener('blur', onBlur)
    field.addEventListener('input', onInput)
    field.addEventListener('compositionstart', (event) => {
      event.stopPropagation()
      state.composing = true
    })
    field.addEventListener('compositionend', (event) => {
      event.stopPropagation()
      if (state.composing) {
        state.composing = false
        // 部分输入法 compositionend 事件可能晚于 input
        onInput(event)
      }
    })
  }
  watch([() => state.selectionStart, () => state.selectionEnd], checkSelection)
  watch(() => state.cursor, checkCursor)
  watch(() => fieldRef.value, initField)
}

export function useField(
  props: Props,
  rootRef: Ref<HTMLElement | null>,
  emit: SetupContext['emit'],
  beforeInput?: (event: Event, state: State) => any
) {
  UniViewJSBridgeSubscribe()
  const { fieldRef, state, trigger } = useBase(props, rootRef, emit)
  const { triggerInput } = useValueSync(props, state, emit, trigger)
  useAutoFocus(props, fieldRef)
  useKeyboard(props, fieldRef, trigger)
  const { state: scopedAttrsState } = useScopedAttrs()
  useFormField('name', state)
  useEvent(fieldRef, state, trigger, triggerInput, beforeInput)

  // Safari 14 以上修正禁用状态颜色
  // TODO fixDisabledColor 可以调整到beforeMount或mounted做修正，确保不影响SSR
  const fixDisabledColor = __NODE_JS__
    ? false
    : String(navigator.vendor).indexOf('Apple') === 0 &&
      CSS.supports('image-orientation:from-image')

  return {
    fieldRef,
    state,
    scopedAttrsState,
    fixDisabledColor,
    trigger,
  }
}