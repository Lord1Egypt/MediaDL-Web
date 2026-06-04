import os
import json
import shutil
import tempfile
import requests
from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS

import yt_dlp
try:
    from yt_dlp.utils import DownloadError, ExtractorError, GeoRestrictedError, AgeRestrictedError
except ImportError:
    from yt_dlp.utils import DownloadError, ExtractorError
    GeoRestrictedError = Exception
    AgeRestrictedError = Exception

app = Flask(__name__)
CORS(app)

FORMAT_MAP = {
    'best': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[vcodec!=none][acodec!=none]/best',
    '1080p': 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][vcodec!=none][acodec!=none]/best[height<=1080]',
    '720p': 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][vcodec!=none][acodec!=none]/best[height<=720]',
    '480p': 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][vcodec!=none][acodec!=none]/best[height<=480]',
    '360p': 'bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[height<=360][vcodec!=none][acodec!=none]/best[height<=360]',
    'mp3': 'bestaudio[ext=mp3]/bestaudio',
    'm4a': 'bestaudio[ext=m4a]/bestaudio'
}

def get_cookie_file(cookies_text):
    if not cookies_text or not cookies_text.strip():
        return None
    # Write to a temporary file in Netscape cookies.txt format
    temp = tempfile.NamedTemporaryFile(delete=False, mode='w', encoding='utf-8', suffix='.txt')
    temp.write(cookies_text)
    temp.close()
    return temp.name

def get_yt_dlp_info(url, cookies_text=None, extract_flat=True, offset=0):
    cookie_file = get_cookie_file(cookies_text)
    
    opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': extract_flat,
        'noplaylist': False,
        'ignoreerrors': True,
        'geo_bypass': True,
    }
    if cookie_file:
        opts['cookiefile'] = cookie_file
        
    if extract_flat:
        # Limit pagination to 50 items at a time
        opts['playliststart'] = offset + 1
        opts['playlistend'] = offset + 50

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
            return info
    finally:
        if cookie_file and os.path.exists(cookie_file):
            os.unlink(cookie_file)

def extract_direct_url(url, ydl_format, cookies_text=None):
    cookie_file = get_cookie_file(cookies_text)
    
    opts = {
        'quiet': True,
        'no_warnings': True,
        'format': ydl_format,
        'geo_bypass': True,
    }
    if cookie_file:
        opts['cookiefile'] = cookie_file
        
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            direct_url = info.get('url')
            filesize = info.get('filesize') or info.get('filesize_approx')
            ext = info.get('ext') or 'mp4'
            
            # If no single direct URL is returned (e.g. combined audio+video formats with no merge)
            headers = info.get('http_headers') or {}
            if not direct_url:
                formats = info.get('formats', [])
                # Find combined formats
                combined_formats = [f for f in formats if f.get('vcodec') != 'none' and f.get('acodec') != 'none' and f.get('url')]
                if combined_formats:
                    # Sort by height desc
                    combined_formats.sort(key=lambda x: x.get('height') or 0, reverse=True)
                    best_combined = combined_formats[0]
                    direct_url = best_combined.get('url')
                    filesize = best_combined.get('filesize') or best_combined.get('filesize_approx')
                    ext = best_combined.get('ext') or ext
                    headers = best_combined.get('http_headers') or headers
                elif formats:
                    # Fallback to the last available format with a URL
                    valid_formats = [f for f in formats if f.get('url')]
                    if valid_formats:
                        direct_url = valid_formats[-1].get('url')
                        filesize = valid_formats[-1].get('filesize') or valid_formats[-1].get('filesize_approx')
                        ext = valid_formats[-1].get('ext') or ext
                        headers = valid_formats[-1].get('http_headers') or headers
                        
            return {
                "direct_url": direct_url,
                "filename": f"{info.get('title') or 'video'}.{ext}",
                "filesize": filesize,
                "headers": headers
            }
    finally:
        if cookie_file and os.path.exists(cookie_file):
            os.unlink(cookie_file)

@app.route('/api/info', methods=['POST'])
def api_info():
    data = request.json or {}
    url = data.get('url')
    cookies_text = data.get('cookies')
    offset = int(data.get('offset', 0))
    
    if not url:
        return jsonify({"error": "Missing URL"}), 400
        
    try:
        # First, run with extract_flat=True to check if it's a playlist or channel
        info = get_yt_dlp_info(url, cookies_text, extract_flat=True, offset=offset)
        
        if not info:
            return jsonify({"error": "No information could be extracted"}), 404
            
        # Is it a playlist/channel/user profile?
        if info.get('_type') == 'playlist' or 'entries' in info:
            entries = info.get('entries', [])
            items = []
            for entry in entries:
                if not entry:
                    continue
                # Resolve thumbnail
                thumbnails = entry.get('thumbnails') or []
                thumb = entry.get('thumbnail')
                if not thumb and thumbnails:
                    thumb = thumbnails[-1].get('url')
                    
                entry_url = entry.get('url')
                entry_id = entry.get('id')
                
                # Reconstruct full URL for entries if they are relative/partial
                if entry_url and not entry_url.startswith('http'):
                    ie_key = entry.get('ie_key')
                    if ie_key == 'Youtube' or 'youtube' in url:
                        entry_url = f"https://www.youtube.com/watch?v={entry_url}"
                elif not entry_url and entry_id:
                    if 'youtube' in url or 'youtu.be' in url:
                        entry_url = f"https://www.youtube.com/watch?v={entry_id}"
                    elif 'tiktok' in url:
                        entry_url = f"https://www.tiktok.com/embed/{entry_id}"
                    elif 'instagram' in url:
                        entry_url = f"https://www.instagram.com/p/{entry_id}/"
                    else:
                        entry_url = url
                        
                items.append({
                    "id": entry_id,
                    "title": entry.get('title') or "Untitled",
                    "thumbnail": thumb or "",
                    "duration": entry.get('duration'),
                    "url": entry_url,
                    "uploader": entry.get('uploader') or info.get('playlist_uploader') or info.get('uploader') or "",
                    "is_photo": entry.get('ext') in ['jpg', 'jpeg', 'png', 'webp']
                })
                
            return jsonify({
                "type": "playlist",
                "playlist_title": info.get('title') or "Playlist",
                "playlist_uploader": info.get('uploader') or "",
                "thumbnail": info.get('thumbnail') or (items[0]['thumbnail'] if items else ""),
                "count": info.get('playlist_count') or len(items),
                "items": items
            })
            
        # It is a single video/photo
        # Extract full info for single item
        info = get_yt_dlp_info(url, cookies_text, extract_flat=False)
        
        ext = info.get('ext')
        is_photo = ext in ['jpg', 'jpeg', 'png', 'webp'] or (info.get('extractor') in ['imgur', 'flickr', 'pinterest'] and ext not in ['mp4', 'webm', 'gif'])
        
        photos = []
        if is_photo:
            photos.append({
                "url": info.get('url'),
                "filename": f"{info.get('title') or 'photo'}.{ext or 'jpg'}"
            })
            
        # Extract format table
        formats = []
        if not is_photo:
            for fmt in info.get('formats', []):
                formats.append({
                    "format_id": fmt.get('format_id'),
                    "ext": fmt.get('ext'),
                    "resolution": fmt.get('resolution') or f"{fmt.get('width')}x{fmt.get('height')}" if (fmt.get('width') and fmt.get('height')) else "audio",
                    "fps": fmt.get('fps'),
                    "filesize": fmt.get('filesize') or fmt.get('filesize_approx'),
                    "vcodec": fmt.get('vcodec'),
                    "acodec": fmt.get('acodec'),
                    "format_note": fmt.get('format_note') or ""
                })
                
        thumbnails = info.get('thumbnails') or []
        thumb = info.get('thumbnail')
        if not thumb and thumbnails:
            thumb = thumbnails[-1].get('url')
            
        return jsonify({
            "type": "single",
            "title": info.get('title') or "Untitled",
            "thumbnail": thumb or "",
            "duration": info.get('duration'),
            "uploader": info.get('uploader') or info.get('channel') or "",
            "view_count": info.get('view_count'),
            "upload_date": info.get('upload_date'),
            "url": url,
            "is_photo": is_photo,
            "photos": photos,
            "formats": formats
        })
        
    except GeoRestrictedError:
        return jsonify({"error": "This content is geo-restricted in your region."}), 403
    except AgeRestrictedError:
        return jsonify({"error": "Age-restricted content. Cookies may be required to bypass restriction."}), 403
    except DownloadError as e:
        return jsonify({"error": f"Extraction failed: {str(e)}"}), 400
    except ExtractorError as e:
        return jsonify({"error": f"Unsupported site or extractor error: {str(e)}"}), 400
    except Exception as e:
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500

@app.route('/api/download', methods=['POST'])
def api_download():
    data = request.json or {}
    url = data.get('url')
    fmt_selection = data.get('format', 'best')
    cookies_text = data.get('cookies')
    
    if not url:
        return jsonify({"error": "Missing URL"}), 400
        
    ydl_format = FORMAT_MAP.get(fmt_selection, fmt_selection)
    
    try:
        result = extract_direct_url(url, ydl_format, cookies_text)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def get_stream_headers(media_url):
    from urllib.parse import urlparse
    parsed = urlparse(media_url)
    domain = parsed.netloc.lower()
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Encoding': 'identity;q=1, *;q=0',
        'Accept-Language': 'en-US,en;q=0.9',
    }
    
    if 'tiktok' in domain:
        headers['Referer'] = 'https://www.tiktok.com/'
    elif 'instagram' in domain:
        headers['Referer'] = 'https://www.instagram.com/'
    elif 'twitter' in domain or 'twimg' in domain or 'x.com' in domain:
        headers['Referer'] = 'https://twitter.com/'
    elif 'youtube' in domain or 'googlevideo' in domain:
        headers['Referer'] = 'https://www.youtube.com/'
    else:
        headers['Referer'] = f"https://{parsed.netloc}/"
        
    return headers

@app.route('/api/stream', methods=['GET', 'POST'])
def api_stream():
    if request.method == 'POST':
        media_url = request.form.get('url')
        filename = request.form.get('filename', 'download')
        req_headers_str = request.form.get('headers')
    else:
        media_url = request.args.get('url')
        filename = request.args.get('filename', 'download')
        req_headers_str = request.args.get('headers')
    
    if not media_url:
        return "Missing URL", 400
        
    try:
        headers = get_stream_headers(media_url)
        if req_headers_str:
            try:
                custom_headers = json.loads(req_headers_str)
                if isinstance(custom_headers, dict):
                    headers.update(custom_headers)
            except Exception:
                pass
                
        req = requests.get(media_url, headers=headers, stream=True)
        
        # Check if the CDN request failed (e.g. 403 Forbidden)
        if req.status_code >= 400:
            return f"CDN returned status error: {req.status_code}", req.status_code
            
        def generate():
            for chunk in req.iter_content(chunk_size=8192):
                if chunk:
                    yield chunk
                    
        # URL-encode non-ASCII characters for Content-Disposition (RFC 6266)
        from urllib.parse import quote
        encoded_filename = quote(filename)
        # Safe ASCII fallback (remove non-ASCII characters)
        safe_filename = filename.encode('ascii', 'ignore').decode('ascii').replace('"', '\\"')
        if not safe_filename or not safe_filename.strip():
            # If no ascii characters remain, fall back to a generic name
            safe_filename = "download.mp4"
            
        response_headers = {
            'Content-Disposition': f'attachment; filename="{safe_filename}"; filename*=UTF-8\'\'{encoded_filename}',
            'Content-Type': req.headers.get('Content-Type', 'application/octet-stream')
        }
        if req.headers.get('Content-Length'):
            response_headers['Content-Length'] = req.headers.get('Content-Length')
            
        return Response(stream_with_context(generate()), headers=response_headers)
    except Exception as e:
        return f"Streaming proxy error: {str(e)}", 500

@app.route('/api/formats', methods=['POST'])
def api_formats():
    data = request.json or {}
    url = data.get('url')
    cookies_text = data.get('cookies')
    
    if not url:
        return jsonify({"error": "Missing URL"}), 400
        
    try:
        info = get_yt_dlp_info(url, cookies_text, extract_flat=False)
        if not info:
            return jsonify({"error": "Failed to extract formats"}), 404
            
        formats = []
        for fmt in info.get('formats', []):
            formats.append({
                "format_id": fmt.get('format_id'),
                "ext": fmt.get('ext'),
                "resolution": fmt.get('resolution') or f"{fmt.get('width')}x{fmt.get('height')}" if (fmt.get('width') and fmt.get('height')) else "audio",
                "fps": fmt.get('fps'),
                "filesize": fmt.get('filesize') or fmt.get('filesize_approx'),
                "vcodec": fmt.get('vcodec'),
                "acodec": fmt.get('acodec'),
                "format_note": fmt.get('format_note') or ""
            })
        return jsonify({
            "title": info.get('title') or "Formats",
            "formats": formats
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

TIKTOK_DOMAINS = ('tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com')

def is_tiktok(url):
    return any(d in url for d in TIKTOK_DOMAINS)

def _make_download_response(file_path, display_filename, tmp_dir):
    """Stream a file from disk to the browser, then delete it."""
    from urllib.parse import quote
    encoded = quote(display_filename)
    safe = display_filename.encode('ascii', 'ignore').decode('ascii').replace('"', '\\"')
    if not safe.strip():
        safe = 'download' + os.path.splitext(file_path)[1]
    file_size = os.path.getsize(file_path)

    def generate():
        try:
            with open(file_path, 'rb') as f:
                while True:
                    chunk = f.read(65536)
                    if not chunk:
                        break
                    yield chunk
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

    return Response(stream_with_context(generate()), headers={
        'Content-Disposition': f'attachment; filename="{safe}"; filename*=UTF-8\'\'{encoded}',
        'Content-Type': 'application/octet-stream',
        'Content-Length': str(file_size),
    })

@app.route('/api/proxy-download', methods=['POST'])
def api_proxy_download():
    """Download and serve media without manually proxying CDN URLs.

    TikTok: tikwm.com API returns a CDN URL that works from Vercel (their servers
    are not IP-blocked by TikTok CDN the way Vercel's IPs are).

    All others: yt-dlp downloads the file to /tmp so it handles all CDN auth
    internally — no manual CDN proxying needed."""
    if request.is_json:
        data = request.json or {}
    else:
        data = request.form

    url = (data.get('url') or '').strip()
    fmt_selection = data.get('format', 'best')
    cookies_text = data.get('cookies') or ''

    if not url:
        return "Missing URL parameter", 400

    audio_only = fmt_selection in ('mp3', 'm4a')

    # ── TikTok: use tikwm.com (their CDN is not blocked on Vercel) ──────────
    if is_tiktok(url):
        try:
            r = requests.post(
                "https://www.tikwm.com/api/",
                data={"url": url, "hd": 1},
                headers={"User-Agent": "Mozilla/5.0"},
                timeout=15,
            )
            d = r.json()
            if d.get("code") == 0 and d.get("data"):
                td = d["data"]
                cdn_url = td.get("music") if audio_only else (td.get("hdplay") or td.get("play"))
                title = td.get("title") or "TikTok Video"
                ext = "mp3" if audio_only else "mp4"
                filename = f"{title}.{ext}"

                cdn_req = requests.get(cdn_url, stream=True, timeout=30,
                                       headers={"User-Agent": "Mozilla/5.0"})
                if cdn_req.status_code < 400:
                    from urllib.parse import quote
                    encoded = quote(filename)
                    safe = filename.encode('ascii', 'ignore').decode('ascii').replace('"', '\\"') or f"tiktok.{ext}"

                    def tiktok_stream():
                        for chunk in cdn_req.iter_content(chunk_size=65536):
                            if chunk:
                                yield chunk

                    return Response(stream_with_context(tiktok_stream()), headers={
                        'Content-Disposition': f'attachment; filename="{safe}"; filename*=UTF-8\'\'{encoded}',
                        'Content-Type': cdn_req.headers.get('Content-Type', 'application/octet-stream'),
                        **({'Content-Length': cdn_req.headers['Content-Length']}
                           if cdn_req.headers.get('Content-Length') else {}),
                    })
        except Exception:
            pass  # fall through to yt-dlp

    # ── All other platforms: yt-dlp downloads to /tmp, we stream from disk ──
    ydl_format = FORMAT_MAP.get(fmt_selection, fmt_selection)
    cookie_file = get_cookie_file(cookies_text)
    tmp_dir = tempfile.mkdtemp()

    try:
        opts = {
            'quiet': True,
            'no_warnings': True,
            'format': ydl_format,
            'outtmpl': os.path.join(tmp_dir, '%(title)s.%(ext)s'),
            'geo_bypass': True,
            'noplaylist': True,
        }
        if cookie_file:
            opts['cookiefile'] = cookie_file

        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)

        # Find the produced file (ignore partial/temp files)
        files = [f for f in os.listdir(tmp_dir)
                 if not f.endswith(('.part', '.ytdl', '.tmp'))]
        if not files:
            return "Download failed — no output file", 500

        actual_file = os.path.join(tmp_dir, files[0])
        return _make_download_response(actual_file, files[0], tmp_dir)

    except DownloadError as e:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        return f"Download failed: {str(e)}", 400
    except Exception as e:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        return f"Error: {str(e)}", 500
    finally:
        if cookie_file and os.path.exists(cookie_file):
            try:
                os.unlink(cookie_file)
            except Exception:
                pass


@app.route('/api/batch', methods=['POST'])
def api_batch():
    data = request.json or {}
    items = data.get('items', [])
    cookies_text = data.get('cookies')
    
    def generate():
        for item in items:
            url = item.get('url')
            fmt_selection = item.get('format', 'best')
            ydl_format = FORMAT_MAP.get(fmt_selection, fmt_selection)
            
            try:
                result = extract_direct_url(url, ydl_format, cookies_text)
                response_data = {
                    "url": url,
                    "status": "done",
                    "direct_url": result["direct_url"],
                    "filename": result["filename"],
                    "filesize": result["filesize"],
                    "headers": result.get("headers", {})
                }
            except Exception as e:
                response_data = {
                    "url": url,
                    "status": "error",
                    "error": str(e)
                }
            yield f"data: {json.dumps(response_data)}\n\n"
            
    return Response(stream_with_context(generate()), mimetype='text/event-stream')

@app.route('/api/health')
def api_health():
    try:
        return jsonify({
            "status": "ok",
            "yt_dlp_version": yt_dlp.version.__version__
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "error": str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
