#!/usr/bin/env python3

import sys
import os
from pathlib import Path

def test_imports():
    """Test if all required modules can be imported"""
    print("🧪 Testing imports...")

    dependencies = {
        'tkinter': 'tkinter',
        'speech_recognition': 'speech_recognition',
        'pynput': 'pynput',
        'matplotlib': 'matplotlib',
        'numpy': 'numpy',
        'anthropic': 'anthropic',
        'dotenv': 'dotenv'
    }

    failed = []
    for name, module in dependencies.items():
        try:
            __import__(module)
            print(f"  ✅ {name}")
        except ImportError:
            print(f"  ❌ {name}")
            failed.append(name)

    return len(failed) == 0

def test_env():
    """Test if .env file exists and has API key"""
    print("\n🔐 Testing environment...")

    if not Path('.env').exists():
        print("  ❌ .env file not found")
        return False

    print("  ✅ .env file found")

    from dotenv import load_dotenv
    load_dotenv()

    api_key = os.getenv('ANTHROPIC_API_KEY')
    if not api_key or api_key == 'your_api_key_here':
        print("  ⚠️  ANTHROPIC_API_KEY not set or still default value")
        return False

    print("  ✅ ANTHROPIC_API_KEY configured")
    return True

def test_config():
    """Test if config can be loaded"""
    print("\n⚙️  Testing configuration...")

    try:
        from config import DB_PATH, WINDOW_WIDTH, WINDOW_HEIGHT
        print(f"  ✅ Database path: {DB_PATH}")
        print(f"  ✅ Window size: {WINDOW_WIDTH}x{WINDOW_HEIGHT}")
        return True
    except Exception as e:
        print(f"  ❌ Config error: {e}")
        return False

def test_database():
    """Test database initialization"""
    print("\n💾 Testing database...")

    try:
        from database import Database
        db = Database()
        entries = db.get_all_entries()
        print(f"  ✅ Database initialized")
        print(f"  ✅ Entries in database: {len(entries)}")
        return True
    except Exception as e:
        print(f"  ❌ Database error: {e}")
        return False

def main():
    print("=" * 50)
    print("  OncoWispr Setup Verification")
    print("=" * 50)

    checks = [
        test_imports(),
        test_env(),
        test_config(),
        test_database()
    ]

    print("\n" + "=" * 50)
    if all(checks):
        print("✅ All checks passed! Ready to run.")
        print("\nRun: python main.py")
        return 0
    else:
        print("❌ Some checks failed. See above for details.")
        print("\nRun setup: bash setup.sh")
        return 1

if __name__ == "__main__":
    sys.exit(main())
