# OncoWispr - Quick Start

## Installation (2 minutes)

```bash
# 1. Navigate to project
cd /Users/bhavesh/Desktop/projects/oncowispr

# 2. Run setup
bash setup.sh

# 3. Activate virtual environment
source venv/bin/activate

# 4. Edit .env and add your Anthropic API key
nano .env
```

## Verify Setup

```bash
python verify.py
```

## Run the App

```bash
python main.py
```

## How It Works

1. **Press FN key** → GUI appears at bottom center of screen
2. **Speak naturally** → Wave animation shows recording
3. **Release FN key** → App transcribes and analyzes
4. **View wellness score** → 1-10 rating displayed
5. **GUI auto-closes** → Data automatically saved

## Troubleshooting

**ImportError on run:**
```bash
source venv/bin/activate
pip install -r requirements.txt
```

**API Key error:**
- Check .env file exists
- Verify ANTHROPIC_API_KEY is set correctly
- Ensure no quotes around the key

**Microphone not working:**
- Check system audio settings
- Grant microphone permission to terminal
- Test with: `python -c "import speech_recognition; print('OK')"`

**FN key not detected (macOS):**
- The FN key behavior varies by Mac model
- Alternative: Can modify key listener in main.py for different key

## Files Overview

| File | Purpose |
|------|---------|
| main.py | Entry point, FN key listener, app logic |
| gui.py | Tkinter GUI, wave animation, display |
| voice_recorder.py | Audio capture, transcription |
| analyzer.py | AI analysis, wellness scoring |
| database.py | SQLite operations |
| config.py | Settings, paths |
| verify.py | Setup verification tool |

## Database Location

`oncowispr.db` created automatically in project directory.

## Notes

- No shutdown button needed - app auto-manages lifecycle
- One user per database instance
- All entries timestamped and saved permanently
- Wellness scores: 1-3 (severe), 4-5 (moderate), 6-7 (neutral), 8-10 (positive)
