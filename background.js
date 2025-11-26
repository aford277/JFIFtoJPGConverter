// background.js - Manifest V3 Service Worker
// Converts downloaded .jfif files to JPG and removes the original

// Sleep helper
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// Check if filename ends in .jfif
function isJfif(filename) {
  if (!filename) return false;
  return filename.toLowerCase().endsWith(".jfif");
}

// Convert blob → JPEG blob using OffscreenCanvas
async function convertBlobToJpeg(blob, quality = 0.92) {
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0);

  const jpegBlob = await canvas.convertToBlob({
    type: "image/jpeg",
    quality: quality,
  });

  bitmap.close();
  return jpegBlob;
}

// Convert Blob → base64 data URL (MV3 safe)
function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Main download listener
chrome.downloads.onChanged.addListener(async (delta) => {
  try {
    // Only run when download completes
    if (!delta.state || delta.state.current !== "complete") return;

    const id = delta.id;
    const items = await chrome.downloads.search({ id });

    if (!items || items.length === 0) return;

    const item = items[0];
    const filename = item.filename;

    if (!isJfif(filename)) return;

    console.log("[jfif-to-jpg] Detected JFIF:", filename);

    // Wait slightly for Chrome to finish touching disk
    await sleep(150);

    let blobData = null;

    // Try fetching using item.url (works in most cases)
    try {
      if (item.url) {
        const resp = await fetch(item.url);
        if (resp.ok) {
          blobData = await resp.blob();
        }
      }
    } catch (err) {
      console.warn("[jfif-to-jpg] fetch(item.url) failed:", err);
    }

    // If blob still not retrieved, we cannot continue
    if (!blobData) {
      console.error("[jfif-to-jpg] Could not obtain file contents for:", filename);
      return;
    }

    // Convert to JPEG blob
    const jpegBlob = await convertBlobToJpeg(blobData);

    // Convert JPG blob to a base64 data URL (MV3 safe)
    const dataUrl = await blobToDataURL(jpegBlob);

    // Prepare new filename (same as original, but .jpg)
    const base = filename.replace(/\.jfif$/i, "");
    const suggestedName = base.split(/[/\\]/).pop() + ".jpg";

    console.log("[jfif-to-jpg] Saving JPG as:", suggestedName);

    // Trigger new download
    const newDownloadId = await new Promise((res, rej) => {
      chrome.downloads.download(
        {
          url: dataUrl,
          filename: suggestedName,
          conflictAction: "uniquify",
          saveAs: false,
        },
        (did) => {
          if (chrome.runtime.lastError) return rej(chrome.runtime.lastError);
          res(did);
        }
      );
    });

    console.log("[jfif-to-jpg] JPG download complete:", newDownloadId);

    // Try removing original JFIF file
    try {
      await new Promise((res, rej) => {
        chrome.downloads.removeFile(item.id, () => {
          if (chrome.runtime.lastError) return rej(chrome.runtime.lastError);
          res();
        });
      });
      console.log("[jfif-to-jpg] Deleted original JFIF:", filename);
    } catch (err) {
      console.warn("[jfif-to-jpg] removeFile failed (not fatal):", err);
    }

    // Remove from download history
    chrome.downloads.erase({ id: item.id });

  } catch (err) {
    console.error("[jfif-to-jpg] Unexpected error:", err);
  }
});
