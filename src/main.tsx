import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

// Verifikasi versi bundle yang benar-benar berjalan di browser.
// JANGAN mengandalkan GitHub Actions hijau sebagai bukti user memakai
// build terbaru — cek log ini di console production.
declare const __BUILD_VERSION__: string;
console.log("[APP VERSION]", __BUILD_VERSION__);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./service-worker.js');
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              (newWorker as ServiceWorker).postMessage({ type: 'SKIP_WAITING' });
            }
          });
        }
      });
    } catch (error) {
      console.error('Pendaftaran service worker gagal:', error);
    }
  });
}


