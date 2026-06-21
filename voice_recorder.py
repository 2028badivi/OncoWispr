import speech_recognition as sr
import numpy as np
from config import AUDIO_TEMP_PATH, SAMPLE_RATE

class VoiceRecorder:
    def __init__(self):
        self.recognizer = sr.Recognizer()
        self.recognizer.energy_threshold = 4000
        self.is_recording = False
        self.audio_frames = []
        self.speech_energy = 0.0
        self.pause_duration = 0.0

    def record_audio(self):
        """Record audio from microphone and return transcription with speech dynamics"""
        try:
            with sr.Microphone(sample_rate=SAMPLE_RATE) as source:
                self.recognizer.adjust_for_ambient_noise(source, duration=0.5)

                audio = self.recognizer.listen(source, timeout=30, phrase_time_limit=30)

                # Extract speech dynamics
                self.speech_energy = self._calculate_energy(audio)

                # Transcribe
                try:
                    transcription = self.recognizer.recognize_google(audio)
                    return transcription, self.speech_energy, self.pause_duration
                except sr.UnknownValueError:
                    return "", self.speech_energy, self.pause_duration
                except sr.RequestError as e:
                    print(f"Error with speech recognition service: {e}")
                    return "", self.speech_energy, self.pause_duration

        except sr.RequestError as e:
            print(f"Microphone error: {e}")
            return "", 0.0, 0.0
        except Exception as e:
            print(f"Recording error: {e}")
            return "", 0.0, 0.0

    def _calculate_energy(self, audio):
        """Calculate RMS energy of audio signal"""
        try:
            audio_data = np.frombuffer(audio.get_raw_data(), dtype=np.int16)
            rms = np.sqrt(np.mean(audio_data ** 2))
            return float(rms)
        except Exception:
            return 0.0
