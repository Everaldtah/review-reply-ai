# Review Reply AI

> AI-powered review response generator for local businesses. Get 3 personalized replies to any Google/Yelp review in seconds.

## Problem It Solves

85% of consumers read reviews before visiting a local business. Responding to reviews increases trust and search ranking — but most business owners never respond because it's time-consuming and hard to stay professional when a review is unfair. **Review Reply AI** generates 3 tailored, on-brand responses per review instantly, letting owners just pick one and post.

## Features

- **3 AI-generated variants** per review — choose the best fit
- **Tone customization** — professional, friendly, formal, casual, enthusiastic
- **Platform support** — Google, Yelp, TripAdvisor, Facebook, Airbnb
- **Rating-aware** — different strategies for 1-star vs 5-star reviews
- **Fallback mode** — works without OpenAI key using smart templates
- **Usage tracking** — monthly reply limits per plan
- **Bulk processing** — handle up to 10 reviews per request
- **REST API** — integrate with any existing system

## Tech Stack

- **Node.js 18+**
- **Express** — REST API
- **SQLite (better-sqlite3)** — embedded storage
- **OpenAI GPT-4o-mini** — AI generation (optional)

## Installation

```bash
git clone https://github.com/Everaldtah/review-reply-ai
cd review-reply-ai
npm install
cp .env.example .env
# Optionally add your OPENAI_API_KEY to .env
node index.js
```

API running at `http://localhost:3000`

## Usage

### 1. Register your business
```bash
curl -X POST http://localhost:3000/businesses \
  -H "Content-Type: application/json" \
  -d '{"name":"Bella Cucina","category":"restaurant","tone":"friendly"}'
# Returns: {"api_key": "rr_..."}
```

### 2. Submit a review and get AI replies
```bash
curl -X POST http://localhost:3000/reviews \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: rr_..." \
  -d '{
    "platform": "google",
    "reviewer_name": "Sarah M.",
    "rating": 4,
    "review_text": "Great pasta but had to wait 30 mins for a table. The tiramisu was divine!"
  }'
```

**Response:**
```json
{
  "review_id": "...",
  "replies": [
    {"variant": 1, "text": "Thank you, Sarah! We're so glad you loved the tiramisu..."},
    {"variant": 2, "text": "Sarah, your kind words about our pasta made our day!..."},
    {"variant": 3, "text": "We appreciate your honest feedback, Sarah..."}
  ]
}
```

### 3. Mark reply as used
```bash
curl -X POST http://localhost:3000/reviews/{review_id}/replies/{reply_id}/use \
  -H "X-Api-Key: rr_..."
```

### 4. Get stats
```bash
curl http://localhost:3000/businesses/me/stats -H "X-Api-Key: rr_..."
```

## Monetization Model

| Plan | Price | Monthly Replies |
|------|-------|----------------|
| Free | $0 | 30 replies |
| Starter | $19/mo | 200 replies |
| Pro | $49/mo | Unlimited |
| Agency | $149/mo | Unlimited + multi-location + white label |

**Target market:** Local business owners (restaurants, salons, clinics, hotels) with 10+ reviews/month.

**Market size:** 33M+ small businesses in the US alone. Even 0.1% at $19/mo = $750K ARR.

**Distribution:** Partner with Google My Business agencies, franchise groups, restaurant management software.

## License

MIT
