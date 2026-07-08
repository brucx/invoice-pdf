// Minimal HarfBuzz-wasm font subsetter (adapted from the MIT-licensed
// `subset-font` package). We subset to the document's exact characters and
// embed the result whole: @pdf-lib/fontkit's own runtime subsetting corrupts
// CJK glyphs, so pdf.js embeds with { subset: false }.

let hbPromise = null;

async function instantiate(loadWasm) {
  const bytes = await loadWasm();
  const { instance } = await WebAssembly.instantiate(bytes);
  return instance.exports;
}

export function getHb(loadWasm) {
  if (!hbPromise) hbPromise = instantiate(loadWasm);
  return hbPromise;
}

export function subsetFontBytes(hb, fontBytes, text) {
  const input = hb.hb_subset_input_create_or_fail();
  if (!input) throw new Error('hb_subset_input_create_or_fail failed');

  const fontBuffer = hb.malloc(fontBytes.byteLength);
  // The heap view must be recreated after malloc — wasm memory may have grown.
  new Uint8Array(hb.memory.buffer).set(new Uint8Array(fontBytes), fontBuffer);

  const blob = hb.hb_blob_create(fontBuffer, fontBytes.byteLength, 2 /* WRITABLE */, 0, 0);
  const face = hb.hb_face_create(blob, 0);
  hb.hb_blob_destroy(blob);

  // Keep all layout features (equivalent of --font-features='*').
  const layoutFeatures = hb.hb_subset_input_set(input, 6 /* LAYOUT_FEATURE_TAG */);
  hb.hb_set_clear(layoutFeatures);
  hb.hb_set_invert(layoutFeatures);

  const unicodes = hb.hb_subset_input_unicode_set(input);
  for (const ch of new Set(text)) hb.hb_set_add(unicodes, ch.codePointAt(0));

  let subset;
  try {
    subset = hb.hb_subset_or_fail(face, input);
    if (!subset) throw new Error('hb_subset_or_fail failed — corrupt font?');
  } finally {
    hb.hb_subset_input_destroy(input);
  }

  const result = hb.hb_face_reference_blob(subset);
  const offset = hb.hb_blob_get_data(result, 0);
  const length = hb.hb_blob_get_length(result);
  if (!length) throw new Error('hb subset produced empty font');
  const out = new Uint8Array(hb.memory.buffer).slice(offset, offset + length);

  hb.hb_blob_destroy(result);
  hb.hb_face_destroy(subset);
  hb.hb_face_destroy(face);
  hb.free(fontBuffer);
  return out;
}
