# OncoWispr

A mental health monitoring application that uses voice analysis and AI to track emotional wellness.

## Features

- **Voice Recording**: Press FN key to record voice input
- **Speech Transcription**: Automatic transcription of recorded audio
- **Mental Health Analysis**: AI-powered analysis of speech patterns for mental health indicators
- **Wellness Scoring**: 1-10 scale wellness score based on detected emotional cues
- **Data Storage**: SQLite database to track entries over time
- **Wave Animation**: Real-time wave visualization during recording

## Setup

### Prerequisites

- Python 3.8+
- Anthropic API key

### Installation

1. Clone or navigate to the project directory:
```bash
cd /Users/bhavesh/Desktop/projects/oncowispr
```

2. Create a virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Set up environment variables:
```bash
cp .env.example .env
```

5. Add your Anthropic API key to `.env`:
```
ANTHROPIC_API_KEY=your_actual_api_key_here
```

## Usage

Run the application:
```bash
python main.py
```

**How to use:**
1. Press and hold the **FN key** to start recording
2. Speak naturally about how you're feeling
3. Release the **FN key** to stop recording
4. The app will transcribe, analyze, and generate a wellness score
5. Results are saved automatically to the database
6. The GUI will close automatically after displaying the score

## Database

The app creates `oncowispr.db` with an `entries` table containing:
- Timestamp
- Transcription
- Wellness score (1-10)
- Analysis text
- Speech energy metrics
- Pause duration metrics

## Architecture

- `main.py` - Main application and FN key listener
- `gui.py` - Tkinter GUI with wave animation
- `voice_recorder.py` - Audio recording and transcription
- `analyzer.py` - Speech analysis using Anthropic Claude
- `database.py` - SQLite database operations
- `config.py` - Configuration settings

## Notes

- One database per instance (single user design)
- Minimum viable product focused on core functionality
- No shutdown button needed - app manages lifecycle automatically
- Wellness scores: 1-3 (severe), 4-5 (moderate), 6-7 (neutral), 8-9 (positive), 10 (excellent)
