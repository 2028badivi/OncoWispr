#!/usr/bin/env python3

import tkinter as tk
import threading
from pynput import keyboard
from dotenv import load_dotenv
import os

from gui import OncoWisprGUI
from voice_recorder import VoiceRecorder
from analyzer import SpeechAnalyzer
from database import Database

load_dotenv()

class OncoWispr:
    def __init__(self):
        self.root = tk.Tk()
        self.gui = OncoWisprGUI(self.root, self.on_fn_release)
        self.recorder = VoiceRecorder()
        self.analyzer = SpeechAnalyzer()
        self.db = Database()

        self.fn_pressed = False
        self.is_processing = False

        # Setup global FN key listener
        self.listener = keyboard.Listener(on_press=self.on_key_press, on_release=self.on_key_release)
        self.listener.start()

        self.root.protocol("WM_DELETE_WINDOW", self.on_close)

    def on_key_press(self, key):
        """Handle key press"""
        try:
            if key == keyboard.Key.fn:
                self.on_fn_press()
        except AttributeError:
            pass

    def on_key_release(self, key):
        """Handle key release"""
        try:
            if key == keyboard.Key.fn:
                self.on_fn_release()
        except AttributeError:
            pass

    def on_fn_press(self):
        """Handle FN key press"""
        if self.fn_pressed or self.is_processing:
            return

        self.fn_pressed = True
        self.gui.show()
        self.gui.start_recording_animation()

    def on_fn_release(self):
        """Handle FN key release"""
        if not self.fn_pressed:
            return

        self.fn_pressed = False
        self.gui.stop_recording_animation()

        # Start recording and analysis in background thread
        thread = threading.Thread(target=self.process_recording)
        thread.daemon = True
        thread.start()

    def process_recording(self):
        """Record, transcribe, analyze, and save entry"""
        try:
            self.is_processing = True
            self.gui.update_status("Recording...")

            # Record audio
            transcription, speech_energy, pause_duration = self.recorder.record_audio()

            if not transcription.strip():
                self.gui.update_status("No speech detected")
                self.root.after(2000, self.gui.hide)
                self.is_processing = False
                return

            self.gui.update_status("Analyzing...")

            # Analyze speech
            wellness_score, analysis = self.analyzer.analyze_speech(transcription, speech_energy)

            # Save to database
            self.db.save_entry(transcription, wellness_score, analysis, speech_energy, pause_duration)

            # Update GUI
            self.gui.update_score(wellness_score)
            self.gui.update_status(f"Score: {wellness_score}/10")

            print(f"Entry saved - Score: {wellness_score}/10")
            print(f"Transcription: {transcription}")
            print(f"Analysis: {analysis}\n")

            # Hide GUI after 3 seconds
            self.root.after(3000, self.gui.hide)

        except Exception as e:
            print(f"Error during processing: {e}")
            self.gui.update_status("Error occurred")
            self.root.after(2000, self.gui.hide)

        finally:
            self.is_processing = False

    def on_close(self):
        """Handle window close"""
        self.listener.stop()
        self.root.quit()
        self.root.destroy()

    def run(self):
        """Start the application"""
        print("OncoWispr started. Press FN key to record.")
        print("Press Ctrl+C or close window to exit.\n")

        try:
            self.root.mainloop()
        except KeyboardInterrupt:
            self.on_close()

if __name__ == "__main__":
    app = OncoWispr()
    app.run()
