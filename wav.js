function audioBufferToWav(sampleRate, channelBuffers, bits = 24) {
  const channels = channelBuffers.length;
  const bytes = bits / 8;
  const frames = channelBuffers[0].length;
  const buffer = new ArrayBuffer(44 + frames * channels * bytes);
  const view = new DataView(buffer);
  const text = (offset, value) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, "RIFF"); view.setUint32(4, 36 + frames * channels * bytes, true); text(8, "WAVE");
  text(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, channels, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * bytes, true); view.setUint16(32, channels * bytes, true);
  view.setUint16(34, bits, true); text(36, "data"); view.setUint32(40, frames * channels * bytes, true);
  let offset = 44;
  for (let i = 0; i < frames; i++) for (let ch = 0; ch < channels; ch++) {
    const s = Math.max(-1, Math.min(1, channelBuffers[ch][i]));
    if (bits === 24) {
      let v = Math.round(s < 0 ? s * 8388608 : s * 8388607);
      if (v < 0) v += 16777216;
      view.setUint8(offset++, v & 255); view.setUint8(offset++, (v >> 8) & 255); view.setUint8(offset++, (v >> 16) & 255);
    } else { view.setInt16(offset, s < 0 ? s * 32768 : s * 32767, true); offset += 2; }
  }
  return buffer;
}
