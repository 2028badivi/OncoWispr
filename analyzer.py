from anthropic import Anthropic
from config import ANTHROPIC_API_KEY

class SpeechAnalyzer:
    def __init__(self):
        self.client = Anthropic(api_key=ANTHROPIC_API_KEY)

    def analyze_speech(self, transcription, speech_energy):
        """Analyze speech for mental health indicators and return wellness score"""
        if not transcription.strip():
            return 5, "No speech detected. Could not analyze."

        prompt = f"""Analyze the following speech sample for mental health indicators:

Transcription: "{transcription}"
Speech Energy Level: {speech_energy}

Based on this speech sample, assess the person's mental wellness on a scale of 1-10:
- 1-3: Severe signs of depression/sadness (very low energy, hopelessness, withdrawal)
- 4-5: Moderate signs of depression/sadness
- 6-7: Neutral/mixed emotions
- 8-9: Positive mental health (energetic, optimistic, engaged)
- 10: Excellent mental health

Provide:
1. A wellness score (1-10)
2. Brief analysis (2-3 sentences) of detected emotional/mental health indicators

Format your response as:
SCORE: [number]
ANALYSIS: [your analysis]


Make sure to think from context of how to format it, like for example new lines, like for example if it sounds like an email you should format it in different lines, and you should make sure that these things are correct and accurate. And make sure you have specifically how symbols are exactly accurate to the exact same symbols or correct thing.


"""

        try:
            message = self.client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=300,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )

            response_text = message.content[0].text

            # Parse response
            score = self._extract_score(response_text)
            analysis = self._extract_analysis(response_text)

            return score, analysis

        except Exception as e:
            print(f"Analysis error: {e}")
            return 5, f"Error during analysis: {str(e)}"

    def _extract_score(self, response):
        """Extract wellness score from response"""
        try:
            lines = response.split('\n')
            for line in lines:
                if 'SCORE:' in line:
                    score_str = line.replace('SCORE:', '').strip()
                    score = int(''.join(filter(str.isdigit, score_str.split()[0])))
                    return max(1, min(10, score))
        except Exception:
            pass
        return 5

    def _extract_analysis(self, response):
        """Extract analysis from response"""
        try:
            lines = response.split('\n')
            for i, line in enumerate(lines):
                if 'ANALYSIS:' in line:
                    analysis = line.replace('ANALYSIS:', '').strip()
                    if i + 1 < len(lines):
                        analysis += ' ' + lines[i + 1].strip()
                    return analysis
        except Exception:
            pass
        return "Analysis completed."
