importScripts("./rubberband.umd.min.js", "./wav.js");

let api = null;

async function initializeEngine() {
  if (api) return api;
  postMessage({ phase: "wasm", progress: 0.01, text: "音声エンジンを読み込み中…" });
  const response = await fetch("./rubberband.wasm", { cache: "no-store" });
  if (!response.ok) throw new Error(`音声エンジンを取得できませんでした（HTTP ${response.status}）`);
  let module;
  try {
    module = await WebAssembly.compileStreaming(Promise.resolve(response.clone()));
  } catch (_) {
    module = await WebAssembly.compile(await response.arrayBuffer());
  }
  postMessage({ phase: "wasm", progress: 0.035, text: "音声エンジンを初期化中…" });
  api = await rubberband.RubberBandInterface.initialize(module);
  postMessage({ phase: "wasm", progress: 0.06, text: "音声エンジン準備完了" });
  return api;
}

onmessage = async (event) => {
  let state = 0;
  let channelArrayPtr = 0;
  const inputPtrs = [];
  try {
    await initializeEngine();
    const { channelBuffers, sampleRate, envelope, blockSize = 1024 } = event.data;
    if (!channelBuffers?.length || !channelBuffers[0]?.length) throw new Error("処理する音声データがありません");
    const channels = channelBuffers.length;
    const length = channelBuffers[0].length;
    const options =
      rubberband.RubberBandOption.RubberBandOptionProcessRealTime |
      rubberband.RubberBandOption.RubberBandOptionFormantPreserved |
      rubberband.RubberBandOption.RubberBandOptionPitchHighQuality;
    state = api.rubberband_new(sampleRate, channels, options, 1, 1);
    if (!state) throw new Error("音声処理エンジンの作成に失敗しました");
    api.rubberband_set_max_process_size(state, blockSize);
    api.rubberband_set_expected_input_duration(state, length);

    channelArrayPtr = api.malloc(channels * 4);
    for (let ch = 0; ch < channels; ch++) {
      const ptr = api.malloc(blockSize * 4);
      inputPtrs.push(ptr);
      api.memWritePtr(channelArrayPtr + ch * 4, ptr);
    }
    const outputs = channelBuffers.map(() => new Float32Array(length + sampleRate));
    let read = 0, written = 0, lastProgress = 0;

    const retrieve = () => {
      while (true) {
        const available = api.rubberband_available(state);
        if (available <= 0) break;
        const take = Math.min(blockSize, available, outputs[0].length - written);
        if (take <= 0) break;
        const got = api.rubberband_retrieve(state, channelArrayPtr, take);
        for (let ch = 0; ch < channels; ch++) outputs[ch].set(api.memReadF32(inputPtrs[ch], got), written);
        written += got;
      }
    };

    postMessage({ phase: "process", progress: 0.065, text: "全編処理を開始…" });
    while (read < length) {
      const remaining = Math.min(blockSize, length - read);
      const centerTime = (read + remaining / 2) / sampleRate;
      const envIndex = Math.min(envelope.values.length - 1, Math.max(0, Math.round(centerTime / envelope.stepSec)));
      const cents = envelope.values[envIndex] || 0;
      api.rubberband_set_pitch_scale(state, Math.pow(2, cents / 1200));
      for (let ch = 0; ch < channels; ch++) api.memWrite(inputPtrs[ch], channelBuffers[ch].subarray(read, read + remaining));
      read += remaining;
      api.rubberband_process(state, channelArrayPtr, remaining, read >= length ? 1 : 0);
      retrieve();
      const progress = read / length;
      if (progress - lastProgress > .02) {
        postMessage({ phase: "process", progress: 0.065 + progress * 0.925, text: "全編を補正中…" });
        lastProgress = progress;
      }
    }
    retrieve();
    const latency = api.rubberband_get_latency(state) || 0;
    const trimmed = outputs.map((buffer) => {
      const out = new Float32Array(length);
      const start = Math.min(latency, Math.max(0, written - length));
      out.set(buffer.subarray(start, Math.min(written, start + length)));
      return out;
    });
    inputPtrs.forEach((p) => api.free(p));
    api.free(channelArrayPtr);
    api.rubberband_delete(state);
    state = 0; channelArrayPtr = 0; inputPtrs.length = 0;
    postMessage({ phase: "encode", progress: 0.995, text: "プレビューを仕上げ中…" });
    const wavData = audioBufferToWav(sampleRate, trimmed, 24);
    postMessage({ done: true, progress: 1, channelBuffers: trimmed, wavData }, [wavData]);
  } catch (error) {
    try { inputPtrs.forEach((p) => api?.free(p)); } catch (_) {}
    try { if (channelArrayPtr) api?.free(channelArrayPtr); } catch (_) {}
    try { if (state) api?.rubberband_delete(state); } catch (_) {}
    postMessage({ error: error?.message || String(error), stack: error?.stack || "" });
  }
};
