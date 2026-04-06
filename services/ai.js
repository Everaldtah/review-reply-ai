'use strict';

/**
 * AI reply generation service.
 *
 * Uses OpenAI GPT-4o-mini (cheap, fast) to generate 3 personalized review responses.
 * Falls back to rule-based template responses if no API key is configured.
 */

const OpenAI = require('openai');

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const TONE_DESCRIPTIONS = {
  professional: 'professional and courteous',
  friendly: 'warm, friendly, and personable',
  formal: 'formal and business-like',
  casual: 'casual and conversational',
  enthusiastic: 'enthusiastic and energetic',
};

/**
 * Generate 3 reply variants for a review.
 * @param {Object} params
 * @param {string} params.businessName
 * @param {string} params.category - e.g. 'restaurant'
 * @param {string} params.tone - e.g. 'professional'
 * @param {string} params.reviewerName - optional
 * @param {number} params.rating - 1-5
 * @param {string} params.reviewText
 * @returns {Promise<string[]>} - array of 3 reply strings
 */
async function generateReplies({ businessName, category, tone, reviewerName, rating, reviewText }) {
  const toneDesc = TONE_DESCRIPTIONS[tone] || 'professional';
  const starLabel = rating <= 2 ? 'negative' : rating === 3 ? 'mixed' : 'positive';
  const reviewerLabel = reviewerName || 'the customer';

  if (openai) {
    return generateWithOpenAI({ businessName, category, toneDesc, reviewerLabel, rating, starLabel, reviewText });
  }

  // Fallback: rule-based templates (no API key required)
  return generateWithTemplates({ businessName, toneDesc, reviewerLabel, rating, starLabel, reviewText });
}

async function generateWithOpenAI({ businessName, category, toneDesc, reviewerLabel, rating, starLabel, reviewText }) {
  const prompt = `You are a review response expert for a ${category} business called "${businessName}".

Generate exactly 3 different response variants to the following ${starLabel} review (${rating}/5 stars) from ${reviewerLabel}.

Review: "${reviewText}"

Requirements:
- Each response must be ${toneDesc}
- Address specific points mentioned in the review
- For negative/mixed reviews: acknowledge the issue, apologize sincerely, offer to make it right
- For positive reviews: thank them specifically, reinforce what they praised
- Keep each response between 50-120 words
- Do NOT be generic or use templated phrases like "We strive for excellence"
- Each variant should have a meaningfully different approach/angle

Format your response as JSON:
{
  "replies": ["reply1", "reply2", "reply3"]
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.8,
    max_tokens: 800,
  });

  const parsed = JSON.parse(response.choices[0].message.content);
  return parsed.replies;
}

function generateWithTemplates({ businessName, toneDesc, reviewerLabel, rating, starLabel, reviewText }) {
  // Keyword extraction
  const lower = reviewText.toLowerCase();
  const positiveKeywords = ['great', 'amazing', 'excellent', 'wonderful', 'fantastic', 'love', 'best', 'perfect'];
  const negativeKeywords = ['slow', 'wait', 'rude', 'cold', 'wrong', 'disappointing', 'bad', 'terrible', 'never'];
  const foundPositive = positiveKeywords.find(k => lower.includes(k));
  const foundNegative = negativeKeywords.find(k => lower.includes(k));

  if (starLabel === 'positive') {
    return [
      `Thank you so much, ${reviewerLabel}! We're thrilled you had a great experience at ${businessName}. ${foundPositive ? `We love hearing that you found us ${foundPositive}!` : ''} We look forward to welcoming you back soon!`,
      `What a wonderful review — thank you, ${reviewerLabel}! The entire team at ${businessName} works hard to create memorable experiences, and your kind words mean everything to us.`,
      `We're so grateful for your kind review, ${reviewerLabel}! Hearing feedback like yours is exactly what motivates our team at ${businessName} every day. Please come see us again!`,
    ];
  } else if (starLabel === 'negative') {
    return [
      `Thank you for your honest feedback, ${reviewerLabel}. We sincerely apologize for falling short of your expectations at ${businessName}. ${foundNegative ? `We take issues like "${foundNegative}" very seriously.` : ''} Please reach out directly so we can make this right.`,
      `We're sorry to hear about your experience, ${reviewerLabel}. This is not the standard we hold ourselves to at ${businessName}. We'd love the chance to turn this around — please contact us directly.`,
      `${reviewerLabel}, thank you for taking the time to share this. We're genuinely sorry your visit to ${businessName} didn't meet your expectations. Your feedback helps us improve, and we hope to earn your trust back.`,
    ];
  } else {
    return [
      `Thank you for your feedback, ${reviewerLabel}! We're glad parts of your experience at ${businessName} were enjoyable. We'd love to hear more about how we can improve — please don't hesitate to reach out.`,
      `We appreciate you sharing your experience, ${reviewerLabel}. At ${businessName}, we're always looking to improve, and your balanced feedback gives us valuable insights. We hope to exceed your expectations next time!`,
      `Thanks for visiting ${businessName}, ${reviewerLabel}! We appreciate your honest review. We're committed to continuous improvement and hope to impress you even more on your next visit.`,
    ];
  }
}

module.exports = { generateReplies };
