// SAVING A FILE FROM THE APP — the one path that works everywhere.
//
// Lifted out of HandoffScreen, which learned all of this the hard way and now shares it with the Рендер
// step. The naïve `<a download>` is a NO-OP inside the native app (Capacitor/WKWebView never honours the
// attribute), and Web Share is flaky there for anything that isn't an image — a PNG shares fine, a PDF
// or a CSV silently does nothing. So on native we write the real bytes to the cache directory and hand
// its URI to the system share sheet, which reliably offers Save to Files / Photos / Telegram for every
// type. Desktop browsers fall back to Web Share, and then to a plain download.

import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

/** Blob → bare base64 (no "data:" prefix), which is what Filesystem.writeFile wants. */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(blob);
  });
}

export interface ShareMsgs {
  /** shown when it worked */
  ok: string;
  /** shown when it didn't */
  fail: string;
}

/**
 * Save or share one file.
 *
 * `file.name` carries the real extension (the share sheet routes on it). `bytes` overrides the file's
 * own contents when the true MIME differs from what a `File` can express.
 */
export async function shareOrDownload(
  file: File,
  msgs: ShareMsgs,
  flash: (m: string) => void,
  bytes?: Blob,
): Promise<void> {
  const data = bytes ?? file;

  if (Capacitor.isNativePlatform()) {
    try {
      const b64 = await blobToBase64(data);
      await Filesystem.writeFile({ path: file.name, data: b64, directory: Directory.Cache });
      const { uri } = await Filesystem.getUri({ path: file.name, directory: Directory.Cache });
      await Share.share({ title: file.name, url: uri });
      flash(msgs.ok);
    } catch (e) {
      // the sheet throwing "canceled"/"abort" is a normal dismissal, not a failure — stay quiet
      if (!/cancel|abort|dismiss/i.test((e as { message?: string })?.message ?? "")) flash(msgs.fail);
    }
    return;
  }

  const nav = navigator as Navigator & {
    canShare?: (d?: { files?: File[] }) => boolean;
    share?: (d: { files?: File[]; title?: string }) => Promise<void>;
  };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: file.name });
      flash(msgs.ok);
      return;
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError") return; // the user cancelled
    }
  }

  try {
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
    flash(msgs.ok);
  } catch {
    flash(msgs.fail);
  }
}

/** A data URL (what `captureHiRes` returns) → a Blob the share sheet can carry. */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}
