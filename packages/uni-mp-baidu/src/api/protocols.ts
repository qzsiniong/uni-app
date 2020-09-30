export {
  redirectTo,
  previewImage,
  getSystemInfo,
  getSystemInfoSync
} from '@dcloudio/uni-mp-core'

function createTodoMethod(contextName: string, methodName: string) {
  return function unsupported() {
    console.error(`__PLATFORM_TITLE__ ${contextName}暂不支持${methodName}`)
  }
}

type Data = Record<string, any>

export const request = {
  args() {
    // TODO
    // data 不支持 ArrayBuffer
    // method 不支持 TRACE, CONNECT
    return {
      method: 'method',
      dataType(type: string) {
        return {
          name: 'dataType',
          value: type === 'json' ? type : 'string'
        }
      }
    }
  }
}

export const connectSocket = {
  args: {
    method: false
  }
}

export const getRecorderManager = {
  returnValue(fromRes: Data, toRes: UniApp.RecorderManager) {
    toRes.onFrameRecorded = createTodoMethod(
      'RecorderManager',
      'onFrameRecorded'
    )
  }
}

export const getBackgroundAudioManager = {
  returnValue(fromRes: Data, toRes: UniApp.BackgroundAudioManager) {
    toRes.onPrev = createTodoMethod('BackgroundAudioManager', 'onPrev')
    toRes.onNext = createTodoMethod('BackgroundAudioManager', 'onNext')
  }
}

export const scanCode = {
  args: {
    onlyFromCamera: false,
    scanType: false
  }
}

export const navigateToMiniProgram = {
  name: 'navigateToSmartProgram',
  args: {
    appId: 'appKey',
    envVersion: false
  }
}

export const navigateBackMiniProgram = {
  name: 'navigateBackSmartProgram'
}

export const showShareMenu = {
  name: 'openShare'
}

export const getAccountInfoSync = {
  name: 'getEnvInfoSync',
  returnValue(fromRes: Data, toRes: UniApp.AccountInfo) {
    toRes.miniProgram = {
      appId: fromRes.appKey
    } as UniApp.MiniProgram
    toRes.plugin = {
      appId: '',
      version: fromRes.sdkVersion
    }
  }
}
