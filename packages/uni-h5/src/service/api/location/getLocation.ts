import {
  defineAsyncApi,
  API_GET_LOCATION,
  API_TYPE_GET_LOCATION,
  GetLocationProtocol,
  GetLocationOptions,
} from '@dcloudio/uni-api'
import { getJSONP } from '../../../helpers/getJSONP'

type GeoRes = (coords: GeolocationCoordinates, skip?: boolean) => void

export const getLocation = <API_TYPE_GET_LOCATION>defineAsyncApi(
  API_GET_LOCATION,
  ({ type, altitude }, { resolve, reject }) => {
    const key = __uniConfig.qqMapKey

    new Promise((resolve: GeoRes, reject) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (res) => resolve(res.coords),
          reject,
          {
            enableHighAccuracy: altitude,
            timeout: 1000 * 100,
          }
        )
      } else {
        reject(new Error('device nonsupport geolocation'))
      }
    })
      .catch(() => {
        return new Promise((resolve: GeoRes, reject) => {
          getJSONP(
            `https://apis.map.qq.com/ws/location/v1/ip?output=jsonp&key=${key}`,
            {
              callback: 'callback',
            },
            (res: any) => {
              if ('result' in res && res.result.location) {
                const location = res.result.location
                resolve(
                  {
                    latitude: location.lat,
                    longitude: location.lng,
                  } as GeolocationCoordinates,
                  true
                )
              } else {
                reject(new Error(res.message || JSON.stringify(res)))
              }
            },
            () => reject(new Error('network error'))
          )
        })
      })
      .then((coords: GeolocationCoordinates, skip?: boolean) => {
        if ((type && type.toUpperCase() === 'WGS84') || skip) {
          return coords
        }
        return new Promise((resolve: GeoRes) => {
          getJSONP(
            `https://apis.map.qq.com/jsapi?qt=translate&type=1&points=${coords.longitude},${coords.latitude}&key=${key}&output=jsonp&pf=jsapi&ref=jsapi`,
            {
              callback: 'cb',
            },
            (res: any) => {
              if (
                'detail' in res &&
                'points' in res.detail &&
                res.detail.points.length
              ) {
                const location = res.detail.points[0]
                resolve(
                  Object.assign({}, coords, {
                    longitude: location.lng,
                    latitude: location.lat,
                  })
                )
              } else {
                resolve(coords)
              }
            },
            () => resolve(coords)
          )
        })
      })
      .then((coords: GeolocationCoordinates) => {
        resolve(
          Object.assign({}, coords, {
            speed: coords.altitude || 0,
            altitude: coords.altitude || 0,
            verticalAccuracy: coords.altitudeAccuracy || 0,
            // 无专门水平精度，使用位置精度替代
            horizontalAccuracy: coords.accuracy || 0,
          })
        )
      })
      .catch((error) => {
        reject(error.message)
      })
  },
  GetLocationProtocol,
  GetLocationOptions
)
