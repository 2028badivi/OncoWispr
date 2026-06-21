import tkinter as tk
from tkinter import ttk
import threading
import numpy as np
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
from matplotlib.figure import Figure
from config import WINDOW_WIDTH, WINDOW_HEIGHT, POSITION_X_OFFSET, POSITION_Y_OFFSET

class OncoWisprGUI:
    def __init__(self, root, on_fn_release_callback):
        self.root = root
        self.on_fn_release_callback = on_fn_release_callback
        self.is_visible = False
        self.is_recording = False

        # Setup window
        self.root.geometry(f"{WINDOW_WIDTH}x{WINDOW_HEIGHT}")
        self.root.title("OncoWispr")
        self.root.attributes('-topmost', True)
        self.root.configure(bg='#1a1a1a')

        # Remove window decorations for floating effect
        self.root.attributes('-type', 'splash')

        # Create main frame
        self.main_frame = tk.Frame(self.root, bg='#1a1a1a')
        self.main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        # Title
        title_label = tk.Label(
            self.main_frame,
            text="OncoWispr",
            font=("Arial", 14, "bold"),
            fg="#00d9ff",
            bg='#1a1a1a'
        )
        title_label.pack(pady=(0, 10))

        # Status label
        self.status_label = tk.Label(
            self.main_frame,
            text="Press FN to record",
            font=("Arial", 10),
            fg="#ffffff",
            bg='#1a1a1a'
        )
        self.status_label.pack(pady=(0, 10))

        # Wave animation canvas
        self.fig = Figure(figsize=(4, 2), dpi=100, facecolor='#1a1a1a')
        self.ax = self.fig.add_subplot(111)
        self.ax.set_facecolor('#0d0d0d')
        self.ax.set_ylim(-1, 1)
        self.ax.set_xlim(0, 100)
        self.ax.axis('off')

        self.canvas = FigureCanvasTkAgg(self.fig, master=self.main_frame)
        self.canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)

        self.wave_line = None
        self.wave_phase = 0

        # Score display
        self.score_label = tk.Label(
            self.main_frame,
            text="Wellness Score: --",
            font=("Arial", 10),
            fg="#00ff00",
            bg='#1a1a1a'
        )
        self.score_label.pack(pady=(10, 0))

        self.root.withdraw()

    def show(self):
        """Show the GUI window at bottom-center of screen"""
        if self.is_visible:
            return

        screen_width = self.root.winfo_screenwidth()
        screen_height = self.root.winfo_screenheight()

        # Position at bottom-center
        x = (screen_width // 2) - (WINDOW_WIDTH // 2)
        y = screen_height - WINDOW_HEIGHT - 50

        self.root.geometry(f"+{x}+{y}")
        self.root.deiconify()
        self.is_visible = True

    def hide(self):
        """Hide the GUI window"""
        if not self.is_visible:
            return

        self.root.withdraw()
        self.is_visible = False
        self.update_status("Press FN to record")

    def start_recording_animation(self):
        """Start wave animation for recording"""
        self.is_recording = True
        self.update_status("Recording...")
        self.animate_wave()

    def stop_recording_animation(self):
        """Stop wave animation"""
        self.is_recording = False
        self.update_status("Processing...")

    def animate_wave(self):
        """Animate wave visualization"""
        if not self.is_recording:
            return

        self.ax.clear()
        self.ax.set_facecolor('#0d0d0d')
        self.ax.set_ylim(-1, 1)
        self.ax.set_xlim(0, 100)
        self.ax.axis('off')

        # Generate wave
        x = np.linspace(0, 100, 200)
        y = np.sin((x / 10) + (self.wave_phase / 10)) * np.exp(-x / 150)

        self.ax.plot(x, y, color='#00d9ff', linewidth=2)
        self.ax.fill_between(x, y, alpha=0.3, color='#00d9ff')

        self.canvas.draw()

        self.wave_phase += 5
        self.root.after(50, self.animate_wave)

    def update_status(self, status):
        """Update status label"""
        self.status_label.config(text=status)

    def update_score(self, score):
        """Update wellness score display"""
        color = self._get_score_color(score)
        self.score_label.config(text=f"Wellness Score: {score}/10", fg=color)

    def _get_score_color(self, score):
        """Get color based on wellness score"""
        if score <= 3:
            return "#ff0000"  # Red
        elif score <= 5:
            return "#ff9900"  # Orange
        elif score <= 7:
            return "#ffff00"  # Yellow
        else:
            return "#00ff00"  # Green

    def clear_wave(self):
        """Clear wave animation"""
        self.ax.clear()
        self.ax.set_facecolor('#0d0d0d')
        self.ax.set_ylim(-1, 1)
        self.ax.set_xlim(0, 100)
        self.ax.axis('off')
        self.canvas.draw()
