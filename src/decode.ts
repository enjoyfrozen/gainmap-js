import {
  ClampToEdgeWrapping,
  HalfFloatType,
  LinearFilter,
  NoColorSpace,
  RGBAFormat,
  SRGBColorSpace,
  Texture,
  UnsignedByteType,
  UVMapping
} from 'three'

import { GainMapDecoderMaterial } from './materials/GainMapDecoderMaterial'
import { DecodeParameters } from './types'
import { QuadRenderer } from './utils/QuadRenderer'

export { GainMapDecoderMaterial }

/**
 * Decodes a gainmap using a WebGLRenderTarget
 *
 * @category Decoding Functions
 * @group Decoding Functions
 * @example
 * import { decode } from 'gainmap-js'
 * import { ImageBitmapLoader, Mesh, PlaneGeometry, MeshBasicMaterial } from 'three'
 *
 * const loader = new ImageBitmapLoader()
 * loader.setOptions( { imageOrientation: 'flipY' } )
 *
 * // load SDR Representation
 * const sdr = await loader.loadAsync('sdr.jpg')
 * // load Gainmap recovery image
 * const gainMap = await loader.loadAsync('gainmap.jpg')
 * // load metadata
 * const metadata = await (await fetch('metadata.json')).json()
 *
 * const result = await decodeToRenderTarget({
 *   sdr,
 *   gainMap,
 *   // this will restore the full HDR range
 *   maxDisplayBoost: Math.pow(2, metadata.hdrCapacityMax)
 *   ...metadata,
 * })
 *
 * // result can be used to populate a Texture
 * const mesh = new Mesh(new PlaneGeometry(), new MeshBasicMaterial({ map: result.renderTarget.texture }))
 *
 * @param params
 * @returns
 * @throws {Error} if the WebGLRenderer fails to render the gainmap
 */
export const decode = (params: DecodeParameters): InstanceType<typeof QuadRenderer<typeof HalfFloatType, InstanceType<typeof GainMapDecoderMaterial>>> => {
  const { sdr, gainMap, renderer } = params

  const sdrTexture = new Texture(sdr, UVMapping, ClampToEdgeWrapping, ClampToEdgeWrapping, LinearFilter, LinearFilter, RGBAFormat, UnsignedByteType, 1, SRGBColorSpace)
  sdrTexture.needsUpdate = true
  const gainMapTexture = new Texture(gainMap, UVMapping, ClampToEdgeWrapping, ClampToEdgeWrapping, LinearFilter, LinearFilter, RGBAFormat, UnsignedByteType, 1, NoColorSpace)
  gainMapTexture.needsUpdate = true

  const material = new GainMapDecoderMaterial({
    ...params,
    sdr: sdrTexture,
    gainMap: gainMapTexture
  })

  const quadRenderer = new QuadRenderer(sdr.width, sdr.height, HalfFloatType, NoColorSpace, material, renderer)

  try {
    quadRenderer.render()
  } catch (e) {
    sdrTexture.dispose()
    gainMapTexture.dispose()
    material.dispose()
    quadRenderer.renderTarget.dispose()
    throw e
  }

  return quadRenderer
}
