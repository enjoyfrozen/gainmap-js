# gainmap-js
A Javascript (TypeScript) Encoder/Decoder Implementation of Adobe's Gain Map Technology for storing HDR Images using an SDR Image + a "Gain map"

> :warning: This library **is primarily intended** for encoding and decoding gain map images for the [three.js](https://github.com/mrdoob/three.js/) 3D Library
>
> It can be used for general encode/decode of gain maps but it depends on the three.js library which, in itself, is quite heavy if you only use it to encode/decode gain maps.

## Live Demo

https://monogrid.github.io/gainmap-js/

Compares loading:
 1. a `JPEG` file with embedded gain map data
 2. a `webp` sdr file + a `webp` gain map + metadata JSON
 3. a comparable size `.hdr` file for comparison

## Installing
```bash
$ npm install @monogrid/gainmap-js three
```

## What is a Gain map?

[See here](https://gregbenzphotography.com/hdr-images/jpg-hdr-gain-maps-in-adobe-camera-raw/) for a detailed explanation, here are some relevant parts:

> A gain map is a single file with a second pseudo-image embedded in it to create an optimized result for a specific monitor. It can be used to generate the HDR version (which looks dramatically better where supported), the SDR version (without tone mapping to ensures great quality), or anything in between (to better support less capable HDR displays).

> Gain maps are not a new type of file, but rather a technology which can be embedded into a variety of image formats. There are reference specs already for the JPG, AVIF, JXL, and HEIF file formats. JPG is especially notable as it could not properly support HDR without gain maps and it offers a very useful bridge to the future (i.e. highly compatible with today’s software).

> A gain map includes:
>
> * A **base (default) image**. This can be an SDR or an HDR image (JPG gain maps are always encoded with SDR as the base). If the browser or viewing software does not understand gain maps, it will just the treat file as if it were just the base image.
> * The **gain map**. This is a secondary “image” embedded in the file. It is not a real image, but rather contains data to convert each pixel from the base image into the other (SDR or HDR) version of the image.
>* Gain map **metadata**. This tells the browser how the gain map is encoded as well as critical information to optimize rendering on any display.

## API

Refer to the [WIKI](https://github.com/MONOGRID/gainmap-js/wiki) for detailed documentation about the API.

## Examples

### Decoding

The main use case of this library is to decode a JPEG file that contains gain map data
and use it instead of a traditional `.exr` or `.hdr` image.


### Using a single JPEG with embedded Gain map Metadata

This approach lets you load a single file with an embedded Gain Map.

The advantage is to have a single file to load.

The disadvantages are:
 * No WEBP compression
 * Uses the `@monogrid/gainmap-js/libultrahdr` package which is heavier and requires loading a `wasm` in order to extract the gainmap from the JPEG.
 * The JPEG cannot be manipulated in Photoshop, GIMP, or any other software that does not support the gain map technology (no photo editing software supports it at the time of writing 06-11-2023).
 * Photo sharing websites and/or services (i.e. sharing with Slack) will likely strip the Gain map metadata and the HDR information will be lost, leaving you with only the SDR Representation.

```ts
import { JPEGRLoader } from '@monogrid/gainmap-js/libultrahdr'
import {
  EquirectangularReflectionMapping,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  WebGLRenderer
} from 'three'

const renderer = new WebGLRenderer()

const loader = new JPEGRLoader(renderer)

const result = loader.load('gainmap.jpeg')
// `result` can be used to populate a Texture

const scene = new Scene()
const mesh = new Mesh(
  new PlaneGeometry(),
  new MeshBasicMaterial({ map: result.renderTarget.texture })
)
scene.add(mesh)
renderer.render(scene, new PerspectiveCamera())

// `result.renderTarget.texture` must be
// converted to `DataTexture` in order
// to use it as Equirectangular scene background
// if needed

scene.background = result.toDataTexture()
scene.background.mapping = EquirectangularReflectionMapping
scene.background.minFilter = LinearFilter

```

### Using separate files

Using separate files will get rid of the limitations of using a single JPEG file but it will force to use three separate files

1. An SDR Representation file
2. A Gainmap file
3. A JSON containing the gainmap metadata used for decoding

This solution will use the lighter `@monogrid/gainmap-js` package which will not load a `wasm` file and contains less code.

```ts
import { GainMapLoader } from '@monogrid/gainmap-js'
import {
  EquirectangularReflectionMapping,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  WebGLRenderer
} from 'three'

const renderer = new WebGLRenderer()

const loader = new GainMapLoader(renderer)

const result = loader.load(['sdr.jpeg', 'gainmap.jpeg', 'metadata.json'])
// `result` can be used to populate a Texture

const scene = new Scene()
const mesh = new Mesh(
  new PlaneGeometry(),
  new MeshBasicMaterial({ map: result.renderTarget.texture })
)
scene.add(mesh)
renderer.render(scene, new PerspectiveCamera())

// `result.renderTarget.texture` must be
// converted to `DataTexture` in order
// to use it as Equirectangular scene background
// if needed

scene.background = result.toDataTexture()
scene.background.mapping = EquirectangularReflectionMapping
scene.background.minFilter = LinearFilter

```

### Encoding

Encoding a Gain map starting from an EXR file.

This is generally not useful in a `three.js` site but this library exposes methods
that allow to encode an `.exr` or `hdr` file into a `jpeg` with an embedded gain map.

```ts
import { compress, encode, findTextureMinMax } from '@monogrid/gainmap-js'
import { encodeJPEGMetadata } from '@monogrid/gainmap-js/libultrahdr'
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js'

// load an HDR file
const loader = new EXRLoader()
const image = await loader.loadAsync('image.exr')

// find RAW RGB Max value of a texture
const textureMax = await findTextureMinMax(image)

// Encode the gainmap
const encodingResult = encode({
  image,
  // this will encode the full HDR range
  maxContentBoost: Math.max.apply(this, textureMax)
})

// obtain the RAW RGBA SDR buffer and create an ImageData
const sdrImageData = new ImageData(
  encodingResult.sdr.toArray(),
  encodingResult.sdr.width,
  encodingResult.sdr.height
)
// obtain the RAW RGBA Gain map buffer and create an ImageData
const gainMapImageData = new ImageData(
  encodingResult.gainMap.toArray(),
  encodingResult.gainMap.width,
  encodingResult.gainMap.height
)

// parallel compress the RAW buffers into the specified mimeType
const mimeType = 'image/jpeg'
const quality = 0.9

const [sdr, gainMap] = await Promise.all([
  compress({
    source: sdrImageData,
    mimeType,
    quality,
    flipY: true // output needs to be flipped
  }),
  compress({
    source: gainMapImageData,
    mimeType,
    quality,
    flipY: true // output needs to be flipped
  })
])

// obtain the metadata which will be embedded into
// and XMP tag inside the final JPEG file
const metadata = encodingResult.getMetadata()

// embed the compressed images + metadata into a single
// JPEG file
const jpeg = await encodeJPEGMetadata({
  ...encodingResult,
  ...metadata,
  sdr,
  gainMap
})

// `jpeg` will be an `Uint8Array` which can be saved somewhere
```

## Libultrahdr in Vite

If you import `@monogrid/gainmap-js/libultrahdr`
You will need to exclude it from Vite optimizations.

```js
// vite.config.js

module.exports = defineConfig({
  ...
  optimizeDeps: {
    exclude: ['@monogrid/gainmap-js/libultrahdr']
  },
  ...
})
```

## References

* [Adobe Gainmap Specification](https://helpx.adobe.com/camera-raw/using/gain-map.html)
* [Ultra HDR Image Format v1.0](https://developer.android.com/guide/topics/media/platform/hdr-image-format)
