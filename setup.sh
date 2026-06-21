#!/bin/bash

echo "🔧 OncoWispr Setup Script"
echo "========================"
echo ""

# Check Python version
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 not found. Please install Python 3.8+"
    exit 1
fi

echo "✅ Python3 found: $(python3 --version)"
echo ""

# Create virtual environment
echo "📦 Creating virtual environment..."
python3 -m venv venv
source venv/bin/activate

echo "✅ Virtual environment created"
echo ""

# Install dependencies
echo "📥 Installing dependencies..."
pip install -q -r requirements.txt

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi
echo ""

# Check for .env file
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found"
    echo "📝 Creating .env from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env and add your ANTHROPIC_API_KEY"
    echo ""
fi

echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "  1. Activate virtual environment: source venv/bin/activate"
echo "  2. Edit .env with your Anthropic API key"
echo "  3. Run: python main.py"
echo ""
