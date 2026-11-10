import {
  MAX_REFERENCE_AUDIO_SECONDS,
  MAX_REFERENCE_FILE_BYTES,
  MAX_REFERENCE_VIDEO_SECONDS,
  type ReferenceVisualSample
} from "./reference-analysis";

export interface PreparedReferenceAudio {
  samples: Float32Array;
  sampleRateHz: number;
}
export interface ExtractedVideoReference {
  audioBuffer: AudioBuffer | null;
  durationSeconds: number;
  sourceSampleRateHz: number;
  sourceChannelCount: number;
  visualFrames: ReferenceVisualSample[];
  warnings: string[];
  audioCaptureAvailable: boolean;
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Reference analysis was cancelled.", "AbortError");
}
function waitForMediaEvent(
  media: HTMLMediaElement,
  eventName: "loadedmetadata" | "loadeddata" | "seeked" | "ended",
  signal?: AbortSignal,
  timeoutMs = 15_000
): Promise<void> {
  return new Promise((resolve, reject) => {
    let timeout = 0;
    const cleanup = () => {
      window.clearTimeout(timeout);
      media.removeEventListener(eventName, onEvent);
      media.removeEventListener("error", onError);
      signal?.removeEventListener("abort", onAbort);
    };
    const onEvent = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error("The browser could not decode this media file.")); };
    const onAbort = () => { cleanup(); reject(new DOMException("Reference analysis was cancelled.", "AbortError")); };
    media.addEventListener(eventName, onEvent, { once: true });
    media.addEventListener("error", onError, { once: true });
    signal?.addEventListener("abort", onAbort, { once: true });
    timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Timed out while decoding the reference media."));
    }, timeoutMs);
  });
}

export function validateReferenceFile(file: File, kind: "audio" | "video"): void {
  if (file.size <= 0) throw new RangeError("The selected reference file is empty.");
  if (file.size > MAX_REFERENCE_FILE_BYTES) {
    throw new RangeError("Reference files must be 150 MB or smaller.");
  }
  const genericType = !file.type || file.type === "application/octet-stream";
  if (kind === "video" && !genericType && !file.type.startsWith("video/")) {
    throw new TypeError("Choose a video file for video analysis.");
  }
  if (kind === "audio" && !genericType && !file.type.startsWith("audio/")) {
    throw new TypeError("Choose an audio file for audio analysis.");
  }
}

export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  validateReferenceFile(file, "audio");
  const Context = window.AudioContext;
  if (!Context) throw new Error("This browser does not support the Web Audio API.");
  const context = new Context();
  try {
    const bytes = await file.arrayBuffer();
    return await context.decodeAudioData(bytes);
  } finally {
    await context.close().catch(() => undefined);
  }
}

/** Browser resampling also performs the channel downmix, keeping the WASM input bounded. */
export async function prepareMonoReferenceAudio(
  buffer: AudioBuffer,
  signal?: AbortSignal
): Promise<PreparedReferenceAudio> {
  assertNotAborted(signal);
  if (!Number.isFinite(buffer.duration) || buffer.duration <= 0 ||
      buffer.duration > MAX_REFERENCE_AUDIO_SECONDS) {
    throw new RangeError("Audio references must be between a fraction of a second and 10 minutes.");
  }
  const targetRate = Math.min(12_000, Math.floor(900_000 / buffer.duration));
  if (targetRate < 1_000) {
    throw new RangeError("This recording is too long to analyze safely in the browser.");
  }
  const frameCount = Math.max(128, Math.floor(buffer.duration * targetRate));
  if (frameCount > 900_000) throw new RangeError("Reference audio exceeds the analysis memory limit.");
  const offline = new OfflineAudioContext(1, frameCount, targetRate);
  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start(0);
  const rendered = await offline.startRendering();
  assertNotAborted(signal);
  return {
    samples: rendered.getChannelData(0).slice(),
    sampleRateHz: rendered.sampleRate
  };
}

function chooseRecorderOptions(): MediaRecorderOptions | undefined {
  if (typeof MediaRecorder.isTypeSupported !== "function") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/ogg;codecs=opus",
    "audio/mp4",
    "audio/webm"
  ];
  const mimeType = candidates.find(candidate => MediaRecorder.isTypeSupported(candidate));
  return mimeType ? { mimeType } : undefined;
}

async function sampleVideoFrames(
  video: HTMLVideoElement,
  durationSeconds: number,
  signal: AbortSignal | undefined,
  onProgress?: (progress: number, message: string) => void
): Promise<ReferenceVisualSample[]> {
  await waitForMediaEvent(video, "loadeddata", signal, 20_000).catch(() => {
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) throw new Error("Video frames are not available for visual analysis.");
  });
  const canvas = document.createElement("canvas");
  canvas.width = 80;
  canvas.height = 45;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("This browser cannot create a video-analysis canvas.");
  const pixelCount = canvas.width * canvas.height;
  let previous = new Float32Array(pixelCount);
  const results: ReferenceVisualSample[] = [];
  const sampleCount = Math.max(16, Math.min(96, Math.ceil(durationSeconds * 1.5)));

  for (let index = 0; index < sampleCount; index += 1) {
    assertNotAborted(signal);
    const timeSeconds = sampleCount === 1
      ? 0
      : (index / (sampleCount - 1)) * Math.max(0, durationSeconds - 0.04);
    if (Math.abs(video.currentTime - timeSeconds) > 0.025) {
      const seeked = waitForMediaEvent(video, "seeked", signal, 12_000);
      video.currentTime = timeSeconds;
      await seeked;
    }
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const luminance = new Float32Array(pixelCount);
    let brightness = 0;
    let motion = 0;
    for (let pixel = 0; pixel < pixelCount; pixel += 1) {
      const offset = pixel * 4;
      const value = (
        pixels[offset] * 0.2126 +
        pixels[offset + 1] * 0.7152 +
        pixels[offset + 2] * 0.0722
      ) / 255;
      luminance[pixel] = value;
      brightness += value;
      if (index > 0) motion += Math.abs(value - previous[pixel]);
    }
    results.push({
      timeSeconds,
      brightness: brightness / pixelCount,
      motion: index > 0 ? motion / pixelCount : 0
    });
    previous = luminance;
    onProgress?.(0.72 + 0.22 * ((index + 1) / sampleCount), "Comparing video frames");
  }
  return results;
}

/**
 * Extract the video's audio locally through a Web Audio MediaStreamDestination.
 * The source is routed to a zero-gain output, so the analysis does not play
 * the reference loudly through the user's speakers.
 */
export async function extractVideoReference(
  file: File,
  signal?: AbortSignal,
  onProgress?: (progress: number, message: string) => void
): Promise<ExtractedVideoReference> {
  validateReferenceFile(file, "video");
  if (typeof MediaRecorder === "undefined") {
    throw new Error("This browser does not support local video-audio capture. Try an audio file instead.");
  }
  const Context = window.AudioContext;
  if (!Context) throw new Error("This browser does not support the Web Audio API.");

  const video = document.createElement("video");
  const objectUrl = URL.createObjectURL(file);
  video.preload = "auto";
  video.playsInline = true;
  video.src = objectUrl;
  video.style.position = "fixed";
  video.style.left = "-10000px";
  video.style.width = "2px";
  video.style.height = "2px";
  document.body.appendChild(video);

  let audioContext: AudioContext | null = null;
  let recorder: MediaRecorder | null = null;
  let streamDestination: MediaStreamAudioDestinationNode | null = null;
  let source: MediaElementAudioSourceNode | null = null;
  let durationSeconds = 0;
  let audioBuffer: AudioBuffer | null = null;
  let sourceSampleRateHz = 0;
  let sourceChannelCount = 0;
  let audioCaptureAvailable = false;
  let disposed = false;
  const captureWait = new AbortController();
  const relayAbort = () => captureWait.abort();
  signal?.addEventListener("abort", relayAbort, { once: true });
  const cleanup = async () => {
    if (disposed) return;
    disposed = true;
    stopRecording?.();
    try { source?.disconnect(); } catch { /* already disconnected */ }
    streamDestination?.stream.getTracks().forEach(track => track.stop());
    await audioContext?.close().catch(() => undefined);
    video.pause();
    video.removeAttribute("src");
    video.load();
    video.remove();
    URL.revokeObjectURL(objectUrl);
    signal?.removeEventListener("abort", relayAbort);
    signal?.removeEventListener("abort", stopOnAbort);
  };
  const warnings: string[] = [];
  const chunks: Blob[] = [];
  let stopRecording: (() => void) | undefined;
  const stopOnAbort = () => {
    captureWait.abort();
    video.pause();
    stopRecording?.();
  };
  signal?.addEventListener("abort", stopOnAbort, { once: true });

  try {
    assertNotAborted(signal);
    audioContext = new Context();
    source = audioContext.createMediaElementSource(video);
    streamDestination = audioContext.createMediaStreamDestination();
    const silentOutput = audioContext.createGain();
    silentOutput.gain.value = 0;
    source.connect(streamDestination);
    source.connect(silentOutput);
    silentOutput.connect(audioContext.destination);

    const options = chooseRecorderOptions();
    recorder = options
      ? new MediaRecorder(streamDestination.stream, options)
      : new MediaRecorder(streamDestination.stream);
    recorder.addEventListener("dataavailable", event => {
      if (event.data.size > 0) chunks.push(event.data);
    });
    const stopped = new Promise<Blob>((resolve, reject) => {
      recorder!.addEventListener("stop", () => {
        resolve(new Blob(chunks, { type: recorder!.mimeType || "audio/webm" }));
      }, { once: true });
      recorder!.addEventListener("error", () => reject(new Error("The browser could not record the video's audio track.")), { once: true });
    });
    void stopped.catch(() => undefined);
    stopRecording = () => {
      if (recorder?.state === "recording") recorder.stop();
    };

    const metadata = waitForMediaEvent(video, "loadedmetadata", captureWait.signal, 20_000);
    video.addEventListener("timeupdate", () => {
      if (video.duration > 0) {
        onProgress?.(0.05 + 0.62 * (video.currentTime / video.duration), "Capturing video audio");
      }
    });
    recorder.start(1_000);
    const playback = video.play();
    const resumed = audioContext.resume();
    await metadata;
    durationSeconds = video.duration;
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      throw new Error("The selected video has no readable duration.");
    }
    if (durationSeconds > MAX_REFERENCE_VIDEO_SECONDS) {
      throw new RangeError("Video references must be 3 minutes or shorter for synchronized local audio capture.");
    }
    await Promise.all([playback, resumed]);
    assertNotAborted(signal);
    const ended = waitForMediaEvent(
      video, "ended", captureWait.signal, MAX_REFERENCE_VIDEO_SECONDS * 1_000 + 30_000
    );
    await ended;
    stopRecording();
    const recording = await stopped;
    if (recording.size > 0) {
      try {
        audioBuffer = await audioContext.decodeAudioData(await recording.arrayBuffer());
        sourceSampleRateHz = audioBuffer.sampleRate;
        sourceChannelCount = audioBuffer.numberOfChannels;
        audioCaptureAvailable = true;
      } catch {
        warnings.push("The browser captured the video but could not decode its recorded audio track.");
      }
    } else {
      warnings.push("The browser did not return an audio stream for this video.");
    }
  } catch (error) {
    stopRecording?.();
    captureWait.abort();
    if (signal?.aborted) {
      await cleanup();
      throw new DOMException("Reference analysis was cancelled.", "AbortError");
    }
    if (Number.isFinite(video.duration) && video.duration > 0) durationSeconds = video.duration;
    if (error instanceof RangeError) {
      await cleanup();
      throw error;
    }
    warnings.push(
      error instanceof Error
        ? "Video audio extraction: " + error.message
        : "Video audio extraction was unavailable in this browser."
    );
  }

  let visualFrames: ReferenceVisualSample[] = [];
  if (durationSeconds > 0 && Number.isFinite(durationSeconds)) {
    try {
      video.pause();
      if (video.readyState >= HTMLMediaElement.HAVE_METADATA && video.currentTime > 0.01) {
        const seeked = waitForMediaEvent(video, "seeked", signal, 12_000);
        video.currentTime = 0;
        await seeked;
      }
      visualFrames = await sampleVideoFrames(video, durationSeconds, signal, onProgress);
    } catch (error) {
      if (signal?.aborted) {
        await cleanup();
        throw new DOMException("Reference analysis was cancelled.", "AbortError");
      }
      warnings.push(error instanceof Error
        ? "Video visual analysis: " + error.message
        : "Video frame analysis was unavailable.");
    }
  }
  onProgress?.(1, "Video analysis captured");

  await cleanup();

  return {
    audioBuffer,
    durationSeconds,
    sourceSampleRateHz,
    sourceChannelCount,
    visualFrames,
    warnings,
    audioCaptureAvailable
  };
}
