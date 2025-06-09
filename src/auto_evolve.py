import os
import random
import time
from datetime import datetime

# Make sure the engine folder exists
if not os.path.exists("engine"):
    os.makedirs("engine")

story_file = "engine/story_feed.txt"

names = [
    ("Emma", "New York", "USA"),
    ("Arjun", "Mumbai", "India"),
    ("Sofia", "Berlin", "Germany"),
    ("Juan", "Mexico City", "Mexico"),
    ("Aisha", "Lagos", "Nigeria"),
    ("Hiroshi", "Tokyo", "Japan"),
    ("Fatima", "Dubai", "UAE"),
    ("Luca", "Rome", "Italy"),
    ("Ming", "Shanghai", "China"),
    ("Sarah", "Sydney", "Australia")
]

jobs = [
    "started working as a teacher",
    "opened a small bakery",
    "enrolled in a university",
    "joined a startup",
    "ran for city council",
    "launched a tech blog",
    "became a delivery driver",
    "invested in real estate",
    "started learning AI development",
    "quit their job to travel"
]

emotions = [
    "happy", "ambitious", "curious", "hopeful", "nervous", "excited", "free", "focused", "proud", "brave"
]

while True:
    name, city, country = random.choice(names)
    job = random.choice(jobs)
    emotion = random.choice(emotions)
    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")

    line = f"🌍 [{timestamp}] {name} from {city}, {country} {job}. Emotion: {emotion}.\n"

    with open(story_file, "a", encoding="utf-8") as f:
        f.write(line)

    print("✅ New story added:", line.strip())
    time.sleep(10)
