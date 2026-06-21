import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "oncowispr.db"
AUDIO_TEMP_PATH = BASE_DIR / "temp_audio.wav"

# Anthropic API
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

# Audio settings
SAMPLE_RATE = 16000
CHUNK_SIZE = 1024

# GUI settings
WINDOW_WIDTH = 400
WINDOW_HEIGHT = 300
POSITION_X_OFFSET = 0  # Center on x-axis
POSITION_Y_OFFSET = -350  # Bottom of screen

# Speech analysis thresholds
PAUSE_THRESHOLD = 0.3
ENERGY_THRESHOLD = 1000
