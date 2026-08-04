onmessage = (event) => {
  const { samples, sampleRate, hopMs = 20, frameMs = 44 } = event.data;
  const downRate = 12000;
  const stride = Math.max(1, Math.round(sampleRate / downRate));
  const mono = samples;
  const reduced = new Float32Array(Math.ceil(mono.length / stride));
  for (let i = 0, j = 0; i < mono.length; i += stride, j++) reduced[j] = mono[i];
  const sr = sampleRate / stride;
  const hop = Math.max(1, Math.round(sr * hopMs / 1000));
  const size = Math.max(64, Math.round(sr * frameMs / 1000));
  const minLag = Math.max(2, Math.floor(sr / 1000));
  const maxLag = Math.min(size - 2, Math.ceil(sr / 65));
  const times = [], pitches = [], confidence = [];

  for (let start = 0; start + size < reduced.length; start += hop) {
    let mean = 0, energy = 0;
    for (let i = 0; i < size; i++) mean += reduced[start + i];
    mean /= size;
    for (let i = 0; i < size; i++) {
      const v = reduced[start + i] - mean;
      energy += v * v;
    }
    const rms = Math.sqrt(energy / size);
    times.push((start + size / 2) / sr);
    if (rms < 0.006) { pitches.push(0); confidence.push(0); continue; }

    let bestLag = 0, best = -Infinity, zero = 0;
    for (let i = 0; i < size; i++) {
      const v = reduced[start + i] - mean;
      zero += v * v;
    }
    for (let lag = minLag; lag <= maxLag; lag++) {
      let sum = 0;
      const count = size - lag;
      for (let i = 0; i < count; i++) {
        sum += (reduced[start + i] - mean) * (reduced[start + i + lag] - mean);
      }
      const score = sum / Math.max(1, count);
      if (score > best) { best = score; bestLag = lag; }
    }
    const conf = Math.max(0, Math.min(1, best / (zero / size + 1e-12)));
    if (conf < 0.32 || !bestLag) { pitches.push(0); confidence.push(conf); continue; }
    pitches.push(sr / bestLag);
    confidence.push(conf);
  }
  postMessage({ times, pitches, confidence });
};
