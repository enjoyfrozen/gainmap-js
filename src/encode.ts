import { compress } from './encode-utils/compress'
import { getGainMap } from './encode-utils/get-gainmap'
import { getSDRRendition } from './encode-utils/get-sdr-rendition'
import { CompressedImage, EncodingParametersBase, EncodingParametersWithCompression, GainMapMetadata } from './types'
import { getDataTexture } from './utils/get-data-texture'

/**
 * Encodes a Gainmap starting from an HDR file.
 *
 * @remarks
 * if you do not pass a `renderer` parameter
 * you must manually dispose the result
 * ```js
 * const encodingResult = await encode({ ... })
 * // do something with the buffers
 * const sdr = encodingResult.sdr.getArray()
 * const gainMap = encodingResult.gainMap.getArray()
 * // after that
 * encodingResult.sdr.dispose()
 * encodingResult.gainMap.dispose()
 * ```
 *
 * @category Encoding Functions
 * @group Encoding Functions
 *
 * @example
 * import { encode, findTextureMinMax } from 'gainmap-js'
 * import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js'
 *
 * // load an HDR file
 * const loader = new EXRLoader()
 * const image = await loader.loadAsync('image.exr')
 *
 * // find RAW RGB Max value of a texture
 * const textureMax = await findTextureMinMax(image)
 *
 * // Encode the gainmap
 * const encodingResult = encode({
 *   image,
 *   // this will encode the full HDR range
 *   maxContentBoost: Math.max.apply(this, textureMax)
 * })
 * // can be re-encoded after changing parameters
 * encodingResult.sdr.material.exposure = 0.9
 * encodingResult.sdr.render()
 * // or
 * encodingResult.gainMap.material.gamma = [1.1, 1.1, 1.1]
 * encodingResult.gainMap.render()
 *
 * // must be manually disposed
 * encodingResult.sdr.dispose()
 * encodingResult.gainMap.dispose()
 *
 * @param params Encoding Paramaters
 * @returns
 */
export const encode = (params: EncodingParametersBase) => {
  const { image, renderer } = params

  const dataTexture = getDataTexture(image)

  const sdr = getSDRRendition(dataTexture, renderer, params.toneMapping)

  const gainMapRenderer = getGainMap({
    ...params,
    image: dataTexture,
    sdr,
    renderer: sdr.renderer // reuse the same (maybe disposable?) renderer
  })

  return {
    sdr,
    gainMap: gainMapRenderer,
    hdr: dataTexture,
    getMetadata: () => {
      const meta: GainMapMetadata = {
        gainMapMax: gainMapRenderer.material.gainMapMax,
        gainMapMin: gainMapRenderer.material.gainMapMin,
        gamma: gainMapRenderer.material.gamma,
        hdrCapacityMax: gainMapRenderer.material.hdrCapacityMax,
        hdrCapacityMin: gainMapRenderer.material.hdrCapacityMin,
        offsetHdr: gainMapRenderer.material.offsetHdr,
        offsetSdr: gainMapRenderer.material.offsetSdr
      }
      return meta
    }
  }
}

/**
 * Encodes a Gainmap starting from an HDR file into compressed file formats (`image/jpeg`, `image/webp` or `image/png`).
 *
 * Uses {@link encode} internally, then pipes the results to {@link compress}.
 *
 * @remarks
 * if a `renderer` parameter is not provided
 * This function will automatically dispose its "disposable"
 * renderer, no need to disapose it manually later
 *
 * @category Encoding Functions
 * @group Encoding Functions
 * @example
 * import { encodeAndCompress, findTextureMinMax } from 'gainmap-js'
 * import { encodeJPEGMetadata } from 'gainmap-js/libultrahdr'
 * import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js'
 *
 * // load an HDR file
 * const loader = new EXRLoader()
 * const image = await loader.loadAsync('image.exr')
 *
 * // find RAW RGB Max value of a texture
 * const textureMax = await findTextureMinMax(image)
 *
 * // Encode the gainmap
 * const encodingResult = await encodeAndCompress({
 *   image,
 *   maxContentBoost: Math.max.apply(this, textureMax),
 *   mimeType: 'image/jpeg'
 * })
 *
 * // embed the compressed images + metadata into a single
 * // JPEG file
 * const jpeg = await encodeJPEGMetadata({
 *   ...encodingResult,
 *   sdr: encodingResult.sdr,
 *   gainMap: encodingResult.gainMap
 * })
 *
 * // `jpeg` will be an `Uint8Array` which can be saved somewhere
 *
 *
 * @param params Encoding Paramaters
 * @throws {Error} if the browser does not support [createImageBitmap](https://caniuse.com/createimagebitmap)
 */
export const encodeAndCompress = async (params: EncodingParametersWithCompression) => {
  const encodingResult = encode(params)

  const { mimeType, quality, flipY, withWorker } = params

  let compressResult: [CompressedImage, CompressedImage]

  let rawSDR: Uint8ClampedArray
  let rawGainMap: Uint8ClampedArray

  const sdrImageData = new ImageData(encodingResult.sdr.toArray(), encodingResult.sdr.width, encodingResult.sdr.height)
  const gainMapImageData = new ImageData(encodingResult.gainMap.toArray(), encodingResult.gainMap.width, encodingResult.gainMap.height)

  if (withWorker) {
    const workerResult = await Promise.all([
      withWorker.compress({
        source: sdrImageData,
        mimeType,
        quality,
        flipY
      }),
      withWorker.compress({
        source: gainMapImageData,
        mimeType,
        quality,
        flipY
      })
    ])
    compressResult = workerResult
    rawSDR = workerResult[0].source
    rawGainMap = workerResult[1].source
  } else {
    compressResult = await Promise.all([
      compress({
        source: sdrImageData,
        mimeType,
        quality,
        flipY
      }),
      compress({
        source: gainMapImageData,
        mimeType,
        quality,
        flipY
      })
    ])
    rawSDR = sdrImageData.data
    rawGainMap = gainMapImageData.data
  }

  encodingResult.sdr.dispose()
  encodingResult.gainMap.dispose()

  return {
    ...encodingResult,
    ...encodingResult.getMetadata(),
    sdr: compressResult[0],
    gainMap: compressResult[1],
    rawSDR,
    rawGainMap
  }
}
