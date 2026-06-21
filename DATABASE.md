# OncoWispr Database Documentation

## Schema

### entries table

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Auto-incrementing row ID |
| timestamp | TEXT | ISO format timestamp of entry |
| transcription | TEXT | Speech transcription |
| wellness_score | INTEGER | 1-10 wellness rating |
| analysis | TEXT | AI analysis of mental health indicators |
| speech_energy | REAL | RMS energy of recorded audio |
| pause_duration | REAL | Duration of pauses in speech |

## Example Entry

```json
{
  "id": 1,
  "timestamp": "2026-06-20T14:30:00.000000",
  "transcription": "I've been feeling quite positive lately, enjoyed my day",
  "wellness_score": 8,
  "analysis": "Positive emotional indicators detected. Speech shows energy and engagement.",
  "speech_energy": 1523.45,
  "pause_duration": 0.3
}
```

## Wellness Score Scale

- **1-3**: Severe signs of depression/sadness (very low energy, hopelessness)
- **4-5**: Moderate signs of depression/sadness
- **6-7**: Neutral/mixed emotions
- **8-9**: Positive mental health (energetic, optimistic)
- **10**: Excellent mental health

## API Usage

### Get all entries
```python
entries = db.get_all_entries()
```

### Get recent entries
```python
recent = db.get_recent_entries(limit=10)
```

### Save new entry
```python
db.save_entry(
    transcription="Text here",
    wellness_score=8,
    analysis="Analysis here",
    speech_energy=1500.0,
    pause_duration=0.5
)
```

## Data Analysis

To analyze wellness trends over time:

```python
entries = db.get_all_entries()
scores = [entry[3] for entry in entries]  # wellness_score is index 3

average_score = sum(scores) / len(scores)
trend = "improving" if scores[-1] > scores[0] else "declining"
```
