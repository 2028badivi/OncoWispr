import tkinter as tk
import threading
import math
import platform
import time
import subprocess
import os
import array
import sys
import tempfile
import wave
import urllib.request
import urllib.error
import urllib.parse
import json
import Quartz
import sqlite3
from CoreFoundation import CFRunLoopGetCurrent, CFRunLoopRun, CFRunLoopStop, CFRunLoopAddSource, kCFRunLoopCommonModes, CFMachPortCreateRunLoopSource

# ─── Configuration ────────────────────────────────────────────────────────────
WIDTH  = 120
HEIGHT = 40
RADIUS = 15
Y_OFFSET = 100

COLOR_PRESSED    = "#E5E7EB"   # Normal mode oval fill (grayish glassmorphic)
COLOR_PROCESSING = "#E5E7EB"
COLOR_IDLE       = "#10B981"   # Emerald (only shown briefly)

API_KEY = os.environ.get("GROQ_API_KEY") or ""
STT_MODEL  = "whisper-large-v3-turbo"   # Speech-to-text
DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "oncowispr.db")

# Default Firebase placeholders (may be overridden by config file in same folder)
FIREBASE_API_KEY = os.environ.get('FIREBASE_API_KEY') or None
FIREBASE_PROJECT_ID = os.environ.get('FIREBASE_PROJECT_ID') or None
FIREBASE_DATABASE_URL = os.environ.get('FIREBASE_DATABASE_URL') or None

# Quartz flag constants
FN_FLAG      = Quartz.kCGEventFlagMaskSecondaryFn  # fn key held


def load_firebase_config():
    """Load firebase config JSON placed in the same folder (if any)."""
    cfg = {}
    folder = os.path.dirname(os.path.abspath(__file__))
    candidates = ["firebase_config.json", "firebaseConfig.json", "config.json", "firebase.json", "firebase_config.json"]
    for name in candidates:
        path = os.path.join(folder, name)
        if os.path.exists(path):
            try:
                with open(path, 'r') as f:
                    data = json.load(f)
                cfg.update(data)
                break
            except Exception:
                pass
    return cfg

# Try to load firebase config from file in the project folder
_cfg = load_firebase_config()
if _cfg:
    FIREBASE_API_KEY = os.environ.get("FIREBASE_API_KEY") or ""
    FIREBASE_PROJECT_ID = "oncowispr"


def init_db():
    # Use a connection with a timeout to reduce "database is locked" races
    conn = sqlite3.connect(DB_FILE, timeout=10)

    conn.execute("""
    CREATE TABLE IF NOT EXISTS entries(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT,
        transcript TEXT,
        wellness_score INTEGER,
        depression_score INTEGER,
        sentiment TEXT,
        explanation TEXT,
        duration REAL,
        wpm REAL,
        avg_volume REAL
    )
    """)

    # Ensure any missing columns are added (backwards-compatible)
    try:
        cur = conn.execute("PRAGMA table_info(entries)")
        existing_cols = [r[1] for r in cur.fetchall()]
        desired = [
            ("transcript", "TEXT"),
            ("wellness_score", "INTEGER"),
            ("depression_score", "INTEGER"),
            ("sentiment", "TEXT"),
            ("explanation", "TEXT"),
            ("duration", "REAL"),
            ("wpm", "REAL"),
            ("avg_volume", "REAL"),
        ]
        for name, typ in desired:
            if name not in existing_cols:
                try:
                    conn.execute(f"ALTER TABLE entries ADD COLUMN {name} {typ}")
                    print(f"Added missing column to entries: {name} {typ}")
                except Exception as e:
                    print(f"Failed to add column {name}: {e}")
    except Exception:
        pass

    conn.commit()
    try:
        # Enable WAL for better concurrency
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA synchronous=NORMAL;")
    except Exception:
        pass
    conn.close()


def save_entry(transcript, analysis=None, duration=0.0, wpm=0.0, avg_volume=0.0):
    """Save entry into DB, adapting to existing table schema.
    `analysis` is a dict returned by analyze_depression().
    """
    # Open connection with timeout; each caller gets its own connection
    conn = sqlite3.connect(DB_FILE, timeout=10)
    # Inspect columns
    cur = conn.execute("PRAGMA table_info(entries)")
    cols_info = cur.fetchall()
    cols = [r[1] for r in cols_info]

    data = {}
    data['timestamp'] = time.strftime("%Y-%m-%d %H:%M:%S")

    # map transcription/tranScript
    if 'transcription' in cols:
        data['transcription'] = transcript
    if 'transcript' in cols:
        data['transcript'] = transcript

    # analysis-derived fields
    if analysis and isinstance(analysis, dict):
        data['wellness_score'] = int(analysis.get('wellness_score', 0)) if 'wellness_score' in cols else None
        data['depression_score'] = int(analysis.get('depression_score', 0)) if 'depression_score' in cols else None
        if 'sentiment' in cols:
            data['sentiment'] = analysis.get('sentiment', '')
        if 'explanation' in cols:
            # store explanation or full analysis JSON
            try:
                data['explanation'] = analysis.get('explanation', '')
            except Exception:
                data['explanation'] = json.dumps(analysis)
    else:
        # defaults
        if 'wellness_score' in cols:
            data['wellness_score'] = 0
        if 'depression_score' in cols:
            data['depression_score'] = 0
        if 'sentiment' in cols:
            data['sentiment'] = ''
        if 'explanation' in cols:
            data['explanation'] = ''

    # Backwards compatibility: some DBs expect a serialized `analysis` column
    if 'analysis' in cols:
        try:
            data['analysis'] = json.dumps(analysis) if analysis is not None else ''
        except Exception:
            data['analysis'] = str(analysis) if analysis is not None else ''

    # runtime metrics
    if 'duration' in cols:
        data['duration'] = float(duration)
    if 'wpm' in cols:
        data['wpm'] = float(wpm)
    if 'avg_volume' in cols:
        data['avg_volume'] = float(avg_volume)

    # Build insert SQL dynamically
    insert_cols = []
    insert_vals = []
    for k, v in data.items():
        if k in cols:
            insert_cols.append(k)
            insert_vals.append(v)

    if not insert_cols:
        conn.close()
        return

    placeholders = ','.join(['?'] * len(insert_cols))
    sql = f"INSERT INTO entries({', '.join(insert_cols)}) VALUES({placeholders})"
    # Retry loop for transient "database is locked" errors
    attempts = 0
    while True:
        try:
            conn.execute(sql, tuple(insert_vals))
            conn.commit()
            break
        except sqlite3.OperationalError as e:
            if 'locked' in str(e).lower() and attempts < 5:
                attempts += 1
                time.sleep(0.2 * attempts)
                continue
            else:
                conn.close()
                raise
    conn.close()


def analyze_depression(transcript):
    """Analyze transcript for depression indicators via Groq API and return parsed JSON."""
    prompt = f"""
Analyze this transcript for depression indicators.

Return JSON only.

{{
    "wellness_score": 1-10,
    "depression_score": 1-10,
    "sentiment": "positive|neutral|negative",
    "explanation": "brief explanation"
}}

Transcript:
{transcript}
"""
    try:
        payload = json.dumps({
            "model": "openai/gpt-oss-120b",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.1
        }).encode()

        req = urllib.request.Request("https://api.groq.com/openai/v1/chat/completions", data=payload)
        req.add_header('Authorization', f'Bearer {API_KEY}')
        req.add_header('Content-Type', 'application/json')
        req.add_header('User-Agent', 'Mozilla/5.0')

        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode())
            content = data["choices"][0]["message"]["content"].strip()

            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif content.startswith("```"):
                content = content.strip("`\n")

            try:
                parsed = json.loads(content)
                return parsed
            except:
                return {
                    "wellness_score": 0,
                    "depression_score": 0,
                    "sentiment": "neutral",
                    "explanation": content[:200]
                }
    except Exception as e:
        print(f"Depression analysis failed: {e}")
        return {
            "wellness_score": 0,
            "depression_score": 0,
            "sentiment": "neutral",
            "explanation": "analysis failed"
        }


def refine_transcription_with_groq(transcript):
    """Send transcript to Groq LLM to clean grammar/spelling, preserve oncology terms,
    and output a concise, corrected transcript. Returns refined string or original on failure.
    """
    if not transcript or not transcript.strip():
        return transcript
    try:
        system_msg = (
            "You are a clinical transcription editor specialized in oncology. "
            "Edit the user's transcript to correct grammar, punctuation, and spelling, "
            "while preserving and correcting oncology-specific terms, drug names, dosages, "
            "and clinical concepts. Be conservative with clinical terminology — do not "
            "DO NOTTTTTTTTT invent medical details. Output ONLY the cleaned transcription text with no commentary."
            "make sure to just format the incoming text that youi get t trnscribe and DO NOT ANALUZE IT O RANYTING OT COMEMNTARY ON IT. JUST FORMAT THE TRANSCEIPTION THAT IS ALL THA YOU NEED TO DO STRICTLY!!!"
        )

        user_msg = f"make sure to just format the incoming text that youi get t trnscribe and DO NOT ANALUZE IT O RANYTING OT COMEMNTARY ON IT. JUST FORMAT THE TRANSCEIPTION THAT IS ALL THA YOU NEED TO DO STRICTLY!!! Please clean and normalize this transcript for clinical notes:\n\n{transcript}"

        payload = json.dumps({
            "model": "openai/gpt-oss-120b",
            "messages": [
                {"role": "system", "content": system_msg},
                {"role": "user",   "content": user_msg}
            ],
            "temperature": 0.0
        }).encode()

        req = urllib.request.Request("https://api.groq.com/openai/v1/chat/completions", data=payload)
        req.add_header('Authorization', f'Bearer {API_KEY}')
        req.add_header('Content-Type', 'application/json')
        req.add_header('User-Agent', 'Mozilla/5.0')

        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode())
            content = data["choices"][0]["message"]["content"].strip()

            # strip code fences if present
            if "```" in content:
                content = content.split("```")[-1].strip()

            # If content contains JSON or extra text, try to extract the final line(s)
            return content

    except Exception as e:
        print(f"Refinement failed: {e}")
        return transcript


def send_to_firebase(entry):
    """Attempt to send the saved entry to Firebase Realtime Database via REST.
    Tries common RTDB hostnames for the provided projectId.
    """
    try:
        # Prefer an explicit service account path (env or common project file)
        sa_override = os.environ.get('FIREBASE_SERVICE_ACCOUNT')
        # User-provided path (project root) — accept this specific filename too
        default_sa = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'oncowispr-firebase-adminsdk-fbsvc-158b0dd60f.json')
        sa_path = None
        if sa_override and os.path.exists(sa_override):
            sa_path = sa_override
        elif os.path.exists(default_sa):
            sa_path = default_sa
        else:
            # Discover any matching admin SDK json in project folder
            for name in os.listdir(os.path.dirname(os.path.abspath(__file__))):
                if name.startswith('oncowispr-firebase-adminsdk') and name.endswith('.json'):
                    sa_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), name)
                    break

        if sa_path:
            try:
                if send_to_firestore_with_service_account(entry, sa_path):
                    return True
            except Exception as e:
                print(f"Authenticated Firestore send failed: {e}")

        # If an explicit RTDB URL is provided, prefer it
        payload = json.dumps(entry).encode()
        headers = {"Content-Type": "application/json"}

        if FIREBASE_DATABASE_URL:
            # Allow user to provide full RTDB host like https://project.firebaseio.com
            url = FIREBASE_DATABASE_URL.rstrip('/') + '/entries.json'
            if FIREBASE_API_KEY:
                sep = '&' if '?' in url else '?'
                url = f"{url}{sep}auth={FIREBASE_API_KEY}"
            try:
                req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
                with urllib.request.urlopen(req, timeout=10) as resp:
                    if resp.getcode() in (200, 201):
                        print(f"Sent entry to Firebase RTDB at {url}")
                        return True
            except Exception as e:
                print(f"Firebase RTDB send failed for {url}: {e}")

        # If no explicit DB URL, try common hostnames derived from project id
        project = FIREBASE_PROJECT_ID
        if project:
            hosts = [f"https://{project}.firebaseio.com", f"https://{project}-default-rtdb.firebaseio.com"]
            for host in hosts:
                url = f"{host}/entries.json"
                if FIREBASE_API_KEY:
                    url = f"{url}?auth={FIREBASE_API_KEY}"
                try:
                    req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
                    with urllib.request.urlopen(req, timeout=10) as resp:
                        if resp.getcode() in (200, 201):
                            print(f"Sent entry to Firebase at {url}")
                            return True
                except Exception as e:
                    print(f"Firebase send failed for {url}: {e}")
        else:
            print("No Firebase DB URL or project id configured; skipping RTDB attempts")

        # Fallback: try Firestore REST API (best-effort, requires appropriate rules)
        try:
            # Best-effort: attempt Firestore REST write if project+API key are available
            if FIREBASE_PROJECT_ID and FIREBASE_API_KEY:
                fs_url = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents/entries?key={FIREBASE_API_KEY}"
                # convert flat entry dict into Firestore document fields
                fs_doc = {"fields": {}}
                for k, v in entry.items():
                    if isinstance(v, int):
                        fs_doc["fields"][k] = {"integerValue": str(v)}
                    elif isinstance(v, float):
                        fs_doc["fields"][k] = {"doubleValue": float(v)}
                    else:
                        fs_doc["fields"][k] = {"stringValue": str(v)}

                req = urllib.request.Request(fs_url, data=json.dumps(fs_doc).encode(), headers={"Content-Type": "application/json"}, method="POST")
                with urllib.request.urlopen(req, timeout=10) as resp:
                    if resp.getcode() in (200, 201):
                        print(f"Sent entry to Firestore at {fs_url}")
                        return True
        except Exception as e:
            print(f"Firestore send failed: {e}")

        return False
    except Exception as e:
        print(f"Firebase send error: {e}")
        return False


def paste_into_target(text, target_app=None):
    """Attempt to paste `text` into `target_app` using AppleScript (brings app frontmost).
    Best-effort: uses pbcopy + osascript to activate and send Cmd+V.
    """
    try:
        # copy to clipboard
        p = subprocess.Popen(["pbcopy"], stdin=subprocess.PIPE, text=True)
        p.communicate(input=text, timeout=1.0)
    except Exception as e:
        print(f"pbcopy failed: {e}")

    if platform.system() != 'Darwin':
        print("Paste-to-app only supported on macOS")
        return False

    attempts = 0
    max_attempts = 3
    while attempts < max_attempts:
        attempts += 1
        if not target_app:
            # fallback: use System Events keystroke (frontmost)
            script = 'tell application "System Events" to keystroke "v" using command down'
            try:
                subprocess.run(["osascript", "-e", script], check=False)
                print("Pasted to frontmost app via System Events")
                return True
            except Exception as e:
                print(f"AppleScript paste failed (frontmost): {e}")
        else:
            script_activate = f'tell application "{target_app}" to activate'
            script_paste    = 'tell application "System Events" to keystroke "v" using command down'
            try:
                subprocess.run(["osascript", "-e", script_activate], check=False)
                # increase sleep on retries to allow app to become active
                time.sleep(0.08 * attempts)
                subprocess.run(["osascript", "-e", script_paste], check=False)
                print(f"Pasted into {target_app} (attempt {attempts})")
                return True
            except Exception as e:
                print(f"Paste to {target_app} failed on attempt {attempts}: {e}")
        time.sleep(0.05 * attempts)
    print("All paste attempts failed")
    return False


def send_to_firestore_with_service_account(entry, sa_json_path):
    """Use service account JSON to obtain access token and write to Firestore.
    This is a minimal, best-effort implementation that constructs a JWT, signs it with
    openssl and exchanges it for an access token, then calls Firestore REST API.
    """
    try:
        with open(sa_json_path, 'r') as f:
            sa = json.load(f)
    except Exception as e:
        print(f"Failed to load service account JSON: {e}")
        return False

    client_email = sa.get('client_email')
    private_key  = sa.get('private_key')
    project_id   = sa.get('project_id')
    if not client_email or not private_key or not project_id:
        print("Service account JSON missing required fields")
        return False

    # Build JWT
    header = json.dumps({"alg": "RS256", "typ": "JWT"}, separators=(',', ':')).encode()
    iat = int(time.time())
    exp = iat + 3600
    payload = json.dumps({
        "iss": client_email,
        "scope": "https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/cloud-platform",
        "aud": "https://oauth2.googleapis.com/token",
        "exp": exp,
        "iat": iat
    }, separators=(',', ':')).encode()

    import base64

    def b64url(b: bytes) -> str:
        return base64.urlsafe_b64encode(b).decode().rstrip('=')

    unsigned_jwt = f"{b64url(header)}.{b64url(payload)}"

    # Write private key to temp file for openssl
    tmpkey = None
    try:
        fd, tmpkey = tempfile.mkstemp(prefix='sa-key-', suffix='.pem')
        os.close(fd)
        with open(tmpkey, 'w') as kf:
            kf.write(private_key)

        # Sign using openssl
        proc1 = subprocess.Popen(['openssl', 'dgst', '-sha256', '-sign', tmpkey], stdin=subprocess.PIPE, stdout=subprocess.PIPE)
        sig, _ = proc1.communicate(input=unsigned_jwt.encode())
        if proc1.returncode != 0:
            # Try alternative: echo -n | openssl
            raise Exception('openssl signing failed')

        signature_b64 = base64.b64encode(sig).decode()
        signature_b64url = signature_b64.replace('+', '-').replace('/', '_').rstrip('=')
        signed_jwt = unsigned_jwt + '.' + signature_b64url

        # Exchange for access token
        data = urllib.parse.urlencode({
            'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion': signed_jwt
        }).encode()
        req = urllib.request.Request('https://oauth2.googleapis.com/token', data=data, method='POST')
        req.add_header('Content-Type', 'application/x-www-form-urlencoded')
        with urllib.request.urlopen(req, timeout=10) as resp:
            token_resp = json.loads(resp.read().decode())
        access_token = token_resp.get('access_token')
        if not access_token:
            print('Failed to obtain access token')
            return False

        # Build Firestore document
        fs_url = f"https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents/entries"
        fs_doc = {"fields": {}}
        for k, v in entry.items():
            if isinstance(v, int):
                fs_doc['fields'][k] = {'integerValue': str(v)}
            elif isinstance(v, float):
                fs_doc['fields'][k] = {'doubleValue': float(v)}
            else:
                fs_doc['fields'][k] = {'stringValue': str(v)}

        req2 = urllib.request.Request(fs_url, data=json.dumps(fs_doc).encode(), method='POST')
        req2.add_header('Content-Type', 'application/json')
        req2.add_header('Authorization', f'Bearer {access_token}')
        with urllib.request.urlopen(req2, timeout=10) as resp2:
            if resp2.getcode() in (200, 201):
                print(f"Sent entry to Firestore (authenticated) for project {project_id}")
                return True
    except Exception as e:
        print(f"Authenticated Firestore error: {e}")
        return False
    finally:
        if tmpkey and os.path.exists(tmpkey):
            try:
                os.remove(tmpkey)
            except:
                pass

    return False

# ─── Overlay Class ───────────────────────────────────────────────────────────
class PolymorphicOverlay:
    def __init__(self):
        self.root = tk.Tk()
        self.root.withdraw()

        self.hide_dock_icon()

        self.window = tk.Toplevel(self.root)
        self.window.withdraw()

        self.window.overrideredirect(True)
        self.window.attributes("-topmost", True)

        try:
            self.window.config(bg='systemTransparent')
            self.window.attributes("-transparent", True)
        except:
            self.window.attributes("-alpha", 0.0)

        self.canvas = tk.Canvas(
            self.window,
            width=WIDTH,
            height=HEIGHT,
            bg='systemTransparent',
            highlightthickness=0,
            borderwidth=0
        )
        self.canvas.pack()

        # UI / Animation state
        self.current_state     = "idle"
        self.current_volume    = 0.0
        self.wave_phase        = 0.0
        self.loading_angle     = 0.0
        self.processing_after_id = None
        self.target_app        = None
        self.recording_start_time = 0
        self.volume_samples = []

        # Audio capture state
        self.audio_process  = None
        self.audio_active   = False
        self.wav_path       = None
        self.wav_file       = None

        self.shape_id = self.draw_shape()
        self.update_position()
        self._apply_nswindow_transparency()

        self.animate_ui()

    # ── Dock / window helpers ────────────────────────────────────────────────

    def hide_dock_icon(self):
        try:
            from AppKit import NSApplication, NSApplicationActivationPolicyAccessory
            NSApplication.sharedApplication().setActivationPolicy_(NSApplicationActivationPolicyAccessory)
        except:
            pass

    def _apply_nswindow_transparency(self):
        if platform.system() != "Darwin":
            return
        try:
            self.window.update_idletasks()
            from ctypes import c_void_p, cdll, c_bool, c_int, CFUNCTYPE
            objc = cdll.LoadLibrary('/usr/lib/libobjc.A.dylib')
            objc.objc_getClass.restype     = c_void_p
            objc.sel_registerName.restype  = c_void_p
            objc.objc_msgSend.restype      = c_void_p
            objc.objc_msgSend.argtypes     = [c_void_p, c_void_p]

            NSApp = objc.objc_msgSend(
                objc.objc_getClass(b"NSApplication"),
                objc.sel_registerName(b"sharedApplication")
            )
            windows        = objc.objc_msgSend(NSApp, objc.sel_registerName(b"windows"))
            count_fn       = Quartz.CFMachPortInvalidate  # just to import; use CFUNCTYPE below
            count_sel      = objc.sel_registerName(b"count")
            count_fn2      = (lambda w, s: int(objc.objc_msgSend(w, s)))
            n_windows      = count_fn2(windows, count_sel)

            obj_at_idx_sel     = objc.sel_registerName(b"objectAtIndex:")
            set_bg_sel         = objc.sel_registerName(b"setBackgroundColor:")
            set_opaque_sel     = objc.sel_registerName(b"setOpaque:")
            set_has_shadow_sel = objc.sel_registerName(b"setHasShadow:")

            clear_color = objc.objc_msgSend(
                objc.objc_getClass(b"NSColor"),
                objc.sel_registerName(b"clearColor")
            )

            msg_send_vp   = (lambda w, s, a: objc.objc_msgSend(w, s, a))
            msg_send_bool = (lambda w, s, b: objc.objc_msgSend(w, s, b))
            msg_send_idx  = (lambda w, s, i: objc.objc_msgSend(w, s, i))

            from ctypes import CFUNCTYPE, c_void_p, c_bool, c_int
            _vp   = CFUNCTYPE(None, c_void_p, c_void_p, c_void_p)(objc.objc_msgSend)
            _bool = CFUNCTYPE(None, c_void_p, c_void_p, c_bool)(objc.objc_msgSend)
            _idx  = CFUNCTYPE(c_void_p, c_void_p, c_void_p, c_int)(objc.objc_msgSend)

            for i in range(n_windows):
                win = _idx(windows, obj_at_idx_sel, i)
                if win:
                    _vp(win, set_bg_sel, clear_color)
                    _bool(win, set_opaque_sel, False)
                    _bool(win, set_has_shadow_sel, False)
        except:
            pass

    def update_position(self):
        sw = self.root.winfo_screenwidth()
        sh = self.root.winfo_screenheight()
        x  = (sw - WIDTH) // 2
        y  = sh - HEIGHT - Y_OFFSET
        self.window.geometry(f"{WIDTH}x{HEIGHT}+{x}+{y}")

    # ── macOS helpers ────────────────────────────────────────────────────────

    def get_frontmost_app(self):
        if platform.system() != "Darwin":
            return None
        try:
            result = subprocess.run(
                ["osascript", "-e",
                 'tell application "System Events" to name of first application process whose frontmost is true'],
                capture_output=True, text=True, timeout=1.0
            )
            if result.returncode == 0:
                name = result.stdout.strip()
                if name and name not in ["Python", "Tk"]:
                    return name
        except:
            pass
        return None

    def play_sound(self, sound_name):
        if platform.system() != "Darwin":
            return
        path = f"/System/Library/Sounds/{sound_name}.aiff"
        if os.path.exists(path):
            try:
                subprocess.Popen(["afplay", "-v", "0.25", path],
                                 stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            except:
                pass

    # ── Audio recording ─────────────────────────────────────────────────────

    def start_recording(self):
        self.stop_recording()
        self.recording_start_time = time.time()
        self.wav_path = os.path.join(tempfile.gettempdir(), f"recording_{int(time.time())}.wav")
        try:
            self.wav_file = wave.open(self.wav_path, "wb")
            self.wav_file.setnchannels(1)
            self.wav_file.setsampwidth(2)
            self.wav_file.setframerate(16000)
        except Exception as e:
            print("Failed to initialize WAV file:", e)
            self.wav_file = None

        cmd = [
            "ffmpeg", "-hide_banner", "-loglevel", "error",
            "-f", "avfoundation", "-thread_queue_size", "1024",
            "-i", ":default",
            "-ar", "16000", "-ac", "1",
            "-f", "s16le", "pipe:1"
        ]
        try:
            self.audio_process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                stdin=subprocess.DEVNULL
            )
            self.audio_active = True
            self.audio_thread = threading.Thread(target=self._read_audio_loop, daemon=True)
            self.audio_thread.start()
        except Exception as e:
            print("Failed to start audio recording:", e)

    def stop_recording(self):
        self.audio_active = False
        if self.audio_process:
            try:
                self.audio_process.terminate()
                self.audio_process.wait(timeout=0.2)
            except:
                try:
                    self.audio_process.kill()
                except:
                    pass
            self.audio_process = None
        if self.wav_file:
            try:
                self.wav_file.close()
            except:
                pass
            self.wav_file = None
        self.current_volume = 0.0

    def _read_audio_loop(self):
        while self.audio_active and self.audio_process:
            try:
                chunk = self.audio_process.stdout.read(1024)
                if not chunk:
                    break
                if len(chunk) < 2:
                    continue
                samples = array.array("h")
                samples.frombytes(chunk[: len(chunk) - (len(chunk) % 2)])
                if sys.byteorder != "little":
                    samples.byteswap()
                if samples:
                    rms   = math.sqrt(sum(s * s for s in samples) / len(samples))
                    self.current_volume = min(1.0, rms / 8000.0)
                    try:
                        self.volume_samples.append(self.current_volume)
                    except Exception:
                        pass
                    if self.wav_file:
                        try:
                            self.wav_file.writeframes(chunk)
                        except:
                            pass
            except:
                break

    # ── Drawing ─────────────────────────────────────────────────────────────

    def draw_shape(self):
        self.canvas.delete("shape")

        return self.create_rounded_rect(
            self.canvas,
            0,
            0,
            WIDTH,
            HEIGHT,
            radius=RADIUS * 1.5,
            fill=COLOR_PRESSED,
            outline="",
            width=0,
            tags="shape"
        )

    def create_rounded_rect(self, canvas, x1, y1, x2, y2, radius=10, **kwargs):
        points = [
            x1+radius, y1,  x2-radius, y1,
            x2, y1,         x2, y1+radius,
            x2, y2-radius,  x2, y2,
            x2-radius, y2,  x1+radius, y2,
            x1, y2,         x1, y2-radius,
            x1, y1+radius,  x1, y1
        ]
        return canvas.create_polygon(points, **kwargs, smooth=True)

    def draw_wave(self):
        self.canvas.delete("wave")
        if self.current_state != "pressed":
            return
        amp   = 2.0 + 12.0 * self.current_volume
        steps = 40
        # Primary wave
        pts = []
        for i in range(steps + 1):
            x = (WIDTH * i) / steps
            y = (HEIGHT / 2) + amp * math.sin(0.15 * x + self.wave_phase)
            pts += [x, y]
        # Secondary wave
        pts2 = []
        for i in range(steps + 1):
            x = (WIDTH * i) / steps
            y = (HEIGHT / 2) + (amp * 0.6) * math.sin(0.20 * x - self.wave_phase * 0.8)
            pts2 += [x, y]
        self.canvas.create_line(pts2, fill="#9CA3AF", width=1.5, smooth=True, tags="wave")
        self.canvas.create_line(pts,  fill="#4B5563", width=2.5, smooth=True, tags="wave")

    def draw_loading_circle(self):
        self.canvas.delete("loading")
        if self.current_state != "processing":
            return
        cx, cy, r = WIDTH // 2, HEIGHT // 2, 6
        arc_color = "#4B5563"
        self.canvas.create_arc(
            cx-r, cy-r, cx+r, cy+r,
            start=self.loading_angle, extent=270,
            outline=arc_color, width=2, style="arc",
            tags="loading"
        )

    def animate_ui(self):
        if self.current_state == "pressed" and self.window.winfo_viewable():
            self.wave_phase += 0.15
            self.draw_wave()
        elif self.current_state == "processing" and self.window.winfo_viewable():
            self.loading_angle = (self.loading_angle + 12) % 360
            self.draw_loading_circle()
        self.root.after(30, self.animate_ui)

    # ── Show / Hide ──────────────────────────────────────────────────────────

    def show(self):
        if self.current_state != "pressed":
            self.current_state = "pressed"
            self.canvas.delete("all")
            self.shape_id = self.draw_shape()
            self.start_recording()
            self.play_sound("Tink")

        try:
            self.window.attributes("-alpha", 0.75)
        except:
            pass

        self.window.deiconify()
        self.window.attributes("-topmost", True)
        self._apply_nswindow_transparency()

    def hide(self):
        self.current_state = "idle"
        self.stop_recording()
        self.canvas.delete("wave")
        self.canvas.delete("loading")
        self.window.withdraw()

    # ── Processing pipeline ──────────────────────────────────────────────────

    def start_processing(self):
        if self.processing_after_id:
            try:
                self.root.after_cancel(self.processing_after_id)
            except:
                pass
            self.processing_after_id = None

        if self.current_state == "processing":
            return
        self.current_state = "processing"
        self.canvas.delete("wave")
        self.stop_recording()

        threading.Thread(target=self._send_to_groq, daemon=True).start()

    def _send_to_groq(self):
        """Transcribe audio → optionally send to AI → paste result."""
        if not self.wav_path or not os.path.exists(self.wav_path) or os.path.getsize(self.wav_path) <= 44:
            print("Recorded audio file is empty. Skipping transcription.")
            self.play_sound("Sosumi")
            self.root.after(0, self.hide)
            return

        transcription = ""
        try:
            boundary     = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
            with open(self.wav_path, 'rb') as f:
                file_content = f.read()

            print(f"Sending {len(file_content)} byte WAV to Groq STT...")

            body = []
            body.append(f'--{boundary}'.encode())
            body.append(b'Content-Disposition: form-data; name="model"')
            body.append(b'')
            body.append(STT_MODEL.encode())

            body.append(f'--{boundary}'.encode())
            body.append(f'Content-Disposition: form-data; name="file"; filename="{os.path.basename(self.wav_path)}"'.encode())
            body.append(b'Content-Type: audio/wav')
            body.append(b'')
            body.append(file_content)

            body.append(f'--{boundary}--'.encode())
            body.append(b'')

            request_body = b'\r\n'.join(body)

            req = urllib.request.Request(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                data=request_body
            )
            req.add_header('Authorization',  f'Bearer {API_KEY}')
            req.add_header('Content-Type',   f'multipart/form-data; boundary={boundary}')
            req.add_header('Content-Length', str(len(request_body)))
            req.add_header('User-Agent',     'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36')

            with urllib.request.urlopen(req, timeout=30) as resp:
                result        = json.loads(resp.read().decode())
                transcription = result.get("text", "").strip()

            print(f"Transcription: {transcription!r}")

        except urllib.error.HTTPError as e:
            print("STT HTTP Error:", e.code, e.reason)
            try:
                print("Body:", e.read().decode())
            except:
                pass
        except Exception as e:
            print("STT Error:", e)
        finally:
            try:
                if self.wav_path and os.path.exists(self.wav_path):
                    os.remove(self.wav_path)
            except:
                pass

        if not transcription.strip():
            self.root.after(0, self.hide)
            return

        # Pass raw transcription to processing/saver
        self.root.after(
            0,
            lambda: self.finish_processing(transcription)
        )

    def finish_processing(self, transcription):
        duration = time.time() - self.recording_start_time

        if not transcription or not transcription.strip():
            self.hide()
            return

        # First, refine the raw transcription for clarity and oncology-specific precision
        refined = refine_transcription_with_groq(transcription)
        if refined and refined.strip():
            transcription = refined

        words = len(transcription.split())
        wpm = (words / duration * 60) if duration > 0 else 0

        avg_volume = (
            sum(self.volume_samples) / len(self.volume_samples)
            if self.volume_samples else 0
        )

        # Analyze the (refined) transcription
        analysis = analyze_depression(transcription)

        # Save using flexible save_entry API
        save_entry(
            transcription,
            analysis=analysis,
            duration=duration,
            wpm=wpm,
            avg_volume=avg_volume
        )

        # Also attempt to send to Firebase (best-effort)
        entry = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "transcript": transcription,
            "wellness_score": analysis.get("wellness_score", 0),
            "depression_score": analysis.get("depression_score", 0),
            "sentiment": analysis.get("sentiment", "neutral"),
            "explanation": analysis.get("explanation", ""),
            "duration": duration,
            "wpm": wpm,
            "avg_volume": avg_volume
        }
        threading.Thread(target=send_to_firebase, args=(entry,), daemon=True).start()

        # Copy to clipboard (user requested: only copy)
        try:
            proc = subprocess.Popen(["pbcopy"], stdin=subprocess.PIPE, text=True)
            proc.communicate(input=transcription, timeout=1.0)
            print("Copied transcription to clipboard")
        except Exception as e:
            print("Failed to copy to clipboard:", e)

        # Attempt to paste into previously frontmost app (best-effort)
        try:
            pasted = paste_into_target(transcription, getattr(self, 'target_app', None))
            if not pasted:
                print("Paste attempt did not succeed; transcription remains on clipboard")
        except Exception as e:
            print(f"Paste helper raised: {e}")

        self.hide()



# ─── Quartz CGEventTap keyboard listener ──────────────────────────────────────

def start_listener(overlay):
    """
    Uses a Quartz CGEventTap to watch for kCGEventFlagsChanged events.
    Detects when the fn key (kCGEventFlagMaskSecondaryFn) is pressed or released.
    Ctrl modifier (kCGEventFlagMaskControl) is read ONLY when fn first goes down.
    Cmd modifier (kCGEventFlagMaskCommand) is used to open the dashboard.
    """

    fn_was_down        = [False]

    def event_callback(proxy, ev_type, event, refcon):
        if ev_type != Quartz.kCGEventFlagsChanged:
            return event

        flags   = Quartz.CGEventGetFlags(event)
        fn_down = bool(flags & FN_FLAG)

        if fn_down and not fn_was_down[0]:
            # fn key went down
            fn_was_down[0] = True
            overlay.root.after(0, handle_fn_press)

        elif not fn_down and fn_was_down[0]:
            # fn key went up
            fn_was_down[0] = False
            overlay.root.after(0, handle_fn_release)

        return event

    def handle_fn_press():
        if overlay.current_state == "processing":
            return
        # Capture target app before overlay might appear
        try:
            app = overlay.get_frontmost_app()
            if app:
                overlay.target_app = app
        except Exception:
            pass

        overlay.show()

    def handle_fn_release():
        if overlay.current_state == "processing":
            return

        overlay.start_processing()

    # Build the event tap
    event_mask = (1 << Quartz.kCGEventFlagsChanged)
    tap = Quartz.CGEventTapCreate(
        Quartz.kCGSessionEventTap,
        Quartz.kCGHeadInsertEventTap,
        Quartz.kCGEventTapOptionListenOnly,   # passive – won't block events
        event_mask,
        event_callback,
        None
    )

    if not tap:
        print("⚠️  Could not create Quartz event tap.")
        print("   Make sure your terminal has Accessibility access:")
        print("   System Settings → Privacy & Security → Accessibility")
        return

    rl_source = CFMachPortCreateRunLoopSource(None, tap, 0)
    CFRunLoopAddSource(CFRunLoopGetCurrent(), rl_source, kCFRunLoopCommonModes)
    Quartz.CGEventTapEnable(tap, True)
    print("Quartz event tap active — listening for fn key.")
    CFRunLoopRun()


# ─── Entry point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("Initializing Fn Dictation Utility...")
    init_db()
    overlay = PolymorphicOverlay()

    tap_thread = threading.Thread(target=start_listener, args=(overlay,), daemon=True)
    tap_thread.start()

    print("Utility active.")
    print("  Hold fn → dictate and save transcription to SQLite DB")

    try:
        overlay.root.mainloop()
    except KeyboardInterrupt:
        pass
