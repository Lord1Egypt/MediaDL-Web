# MediaDL Web 🌐

[![Vercel Deployment](https://img.shields.io/badge/Deploy-Vercel-black?style=flat-square&logo=vercel)](https://vercel.com/)
[![yt-dlp Engine](https://img.shields.io/badge/Engine-yt--dlp-blue?style=flat-square&logo=python)](https://github.com/yt-dlp/yt-dlp)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

A high-performance, responsive browser-based media downloader powered by the Python `yt-dlp` library. **MediaDL Web** runs on Vercel as a serverless Flask API combined with a clean, fast Single Page Application (SPA) frontend.

---

## ⚡ One-Click Deployment

Deploy your own instance of **MediaDL Web** to Vercel instantly without any configuration:

[![Deploy to Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Lord1Egypt/MediaDL-Web&project-name=mediadl-web)

---

## ✨ Features

| Feature | Description |
| :--- | :--- |
| **1000+ Websites** | Supports download extractions from every site compatible with `yt-dlp`. [See Supported Sites List](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md). |
| **Auto-Detection** | Instantly identifies single files, playlists, channel feeds, and user profiles automatically. |
| **Lazy Pagination** | Requests listings 50 items at a time to prevent serverless function timeouts on huge playlists. |
| **Photo & Carousel Support**| Downloads Instagram carousels, Twitter/X gallery images, and Pinterest pins as previews or ZIP archives. |
| **Dynamic Formats Table** | Lists all stream formats (resolutions, fps, file extensions) dynamically for advanced users. |
| **Real-time Batch Queue** | Processes multiple selections simultaneously with real-time progress indicators powered by Server-Sent Events (SSE). |
| **Advanced Cookie Support**| Paste Netscape standard cookies block securely to access age-restricted or private profile contents. |
| **No Disk Writes** | Streams media files directly using Flask proxied buffer streaming, staying compliant with Vercel's readonly server limits. |

---

## 📁 Repository Structure

```text
MediaDL-Web/
├── api/
│   ├── __init__.py
│   └── index.py              # Serverless Flask API with routes
├── public/
│   ├── index.html            # Main SPA dashboard
│   ├── style.css             # Glassmorphism dark-theme layout
│   └── app.js                # Frontend view state controller
├── requirements.txt          # Python serverless dependencies
├── runtime.txt               # Set to python-3.11
├── vercel.json               # Route rules and execution limits
├── .env.example              # Development environment setup
└── README.md                 # Project documentation
```

---

## ⚙️ Manual Deployment Instructions

To deploy manually using the Vercel CLI:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Lord1Egypt/MediaDL-Web.git
   cd MediaDL-Web
   ```

2. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

3. **Log in to Vercel:**
   ```bash
   vercel login
   ```

4. **Deploy production build:**
   ```bash
   vercel --prod
   ```

---

## 🔒 Session Cookies & Restrictions

Some platforms (like Instagram private accounts, region-locked TikToks, or age-restricted YouTube videos) require active browser credentials. 
- Go to the **Advanced section** in the UI.
- Paste your standard Netscape-format `cookies.txt` (extracted from extensions like *Get cookies.txt LOCALLY*).
- These cookies are stored strictly in-memory during the extraction request and are never logged or stored on disk.

---

## 🏷️ Credits & Tech Stack
- **Engine**: [yt-dlp](https://github.com/yt-dlp/yt-dlp)
- **Backend API**: Python [Flask](https://flask.palletsprojects.com/) + [Flask-CORS](https://flask-cors.readthedocs.io/)
- **Hosting**: [Vercel](https://vercel.com) (Serverless functions)
- **Icons**: [Lucide Icons](https://lucide.dev)

---

## 📄 License
This project is licensed under the MIT License - see the LICENSE file for details.
