import sqlite3
from datetime import datetime
from pathlib import Path
from config import DB_PATH

class Database:
    def __init__(self):
        self.db_path = DB_PATH
        self.init_db()

    def init_db(self):
        """Initialize database with entries table"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                transcription TEXT NOT NULL,
                wellness_score INTEGER NOT NULL,
                analysis TEXT NOT NULL,
                speech_energy REAL,
                pause_duration REAL
            )
        """)

        conn.commit()
        conn.close()

    def save_entry(self, transcription, wellness_score, analysis, speech_energy=0.0, pause_duration=0.0):
        """Save a new entry to the database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        timestamp = datetime.now().isoformat()

        cursor.execute("""
            INSERT INTO entries (timestamp, transcription, wellness_score, analysis, speech_energy, pause_duration)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (timestamp, transcription, wellness_score, analysis, speech_energy, pause_duration))

        conn.commit()
        conn.close()

    def get_recent_entries(self, limit=10):
        """Get recent entries from database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute("""
            SELECT * FROM entries ORDER BY timestamp DESC LIMIT ?
        """, (limit,))

        entries = cursor.fetchall()
        conn.close()

        return entries

    def get_all_entries(self):
        """Get all entries from database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM entries ORDER BY timestamp DESC")
        entries = cursor.fetchall()
        conn.close()

        return entries
