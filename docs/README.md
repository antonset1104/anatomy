# Dokumentasi Resmi — Anatomy Atelier (AuriSphere Pro)

Selamat datang di pusat dokumentasi lengkap **Anatomy Atelier**. Direktori ini menyediakan dokumentasi komprehensif mulai dari arsitektur teknis, spesifikasi fungsional, panduan pengguna, hingga struktur pengindeksan SEO dan sitemap XML.

---

## 📚 Daftar Dokumen

1. 🛠️ **[Dokumentasi Teknis (Technical Documentation)](./TECHNICAL_DOCUMENTATION.md)**
   - Arsitektur sistem (Next.js 16 + React 19 + Vinext + Three.js + Cloudflare Workers).
   - Pipeline grafis 3D WebGL (Shader depth prepass, live clipping planes, raycast snapping, measurement engine).
   - Manajemen state client-only (`localStorage` external store) tanpa akun server.
   - Sistem lokalisasi multi-bahasa (12 bahasa termasuk RTL).
   - Skrip pengujian, build statis, dan deployment.

2. 🧬 **[Dokumentasi Fungsional (Functional Documentation)](./FUNCTIONAL_DOCUMENTATION.md)**
   - Rincian 9 spesimen organ 3D (Jantung, Otak, Paru-paru, Hati, Ginjal, Bola Mata, Usus, Pankreas, Kulit).
   - Rincian 8 sistem biologis tubuh manusia.
   - 62 struktur anotasi anatomi berstandar *Terminologia Anatomica (TA2)*.
   - Fitur investigasi 3D (Cross-section sagittal/axial/coronal, X-ray, Isolate, Wireframe, Laser Ruler mm, Pin Labels, Capture PNG).
   - Modul pembelajaran mandiri (*Guided Lessons* & *Grand Tour*).
   - Engine kuis adaptif (3 Mode: *Label the model*, *Name the structure*, *Match the roles*).
   - Sistem gamifikasi (Skor kemahiran, 10 lencana prestasi, streak harian, catatan medis).
   - Mode komparasi ganda (*Side-by-side Dual View*) dan *Command Palette (Ctrl+K)*.

3. 📖 **[Panduan Pengguna (User Guide)](./USER_GUIDE.md)**
   - Panduan navigasi visual dan kontrol model 3D (Mouse, Touch, Orbit, Zoom, Pan).
   - Langkah demi langkah penggunaan alat pemotong irisan, x-ray, dan penggaris milimeter.
   - Cara mengikuti modul belajar otomatis dan menyelesaikan sesi kuis.
   - Cara menulis dan mengekspor catatan medis ke format Markdown (`.md`).
   - Panduan mencetak lembar studi fisik/PDF.
   - Daftar lengkap tombol pintasan papan ketik (*Keyboard Shortcuts*).
   - Pengaturan kualitas grafis, tema gelap/terang, dan bahasa.

4. 🗺️ **[Dokumentasi Sitemap XML & SEO](./SITEMAP_DOCUMENTATION.md)**
   - Matriks 276 URL terindeks di 12 bahasa resmi.
   - Konfigurasi `priority`, `changefreq`, dan relasi multi-bahasa `xhtml:link` / `hreflang`.
   - Logika pembangkitan statis otomatis via `scripts/generate-static-files.mjs`.
   - Integrasi metadata terstruktur Schema.org JSON-LD dan `robots.txt`.
