const { db } = require('../models/database');

/**
 * Compute compatibility score between a tenant and a listing.
 * First checks the cache (DB). If not cached, calls LLM.
 * Falls back to rule-based scoring if LLM is unavailable.
 */
async function computeCompatibility(tenantId, listingId) {
  // Check cache first
  const cached = db.prepare(
    'SELECT score, explanation, computed_by FROM compatibility_scores WHERE tenant_id = ? AND listing_id = ?'
  ).get(tenantId, listingId);

  if (cached) return cached;

  // Fetch tenant profile and listing details
  const profile = db.prepare('SELECT * FROM tenant_profiles WHERE user_id = ?').get(tenantId);
  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(listingId);

  if (!profile || !listing) {
    return { score: 0, explanation: 'Missing tenant profile or listing data.', computed_by: 'rule_based' };
  }

  let result;
  try {
    result = await computeWithLLM(profile, listing);
  } catch (err) {
    console.warn('LLM scoring failed, using rule-based fallback:', err.message);
    result = computeRuleBased(profile, listing);
  }

  // Store in DB (upsert)
  db.prepare(`
    INSERT INTO compatibility_scores (tenant_id, listing_id, score, explanation, computed_by)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(tenant_id, listing_id) DO UPDATE SET
      score = excluded.score,
      explanation = excluded.explanation,
      computed_by = excluded.computed_by,
      created_at = datetime('now')
  `).run(tenantId, listingId, result.score, result.explanation, result.computed_by);

  return result;
}

/**
 * LLM-based scoring using OpenAI-compatible API.
 * Prompt from spec: compute score 0-100 based on budget and location match.
 */
async function computeWithLLM(profile, listing) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const OpenAI = require('openai');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const prompt = `Given this room listing:
- Title: ${listing.title}
- Location: ${listing.location}, ${listing.city}
- Rent: $${listing.rent}/month
- Room Type: ${listing.room_type}
- Furnishing: ${listing.furnishing}
- Available From: ${listing.available_from}

And this tenant profile:
- Preferred Location: ${profile.preferred_location}, ${profile.preferred_city}
- Budget Range: $${profile.budget_min} - $${profile.budget_max}/month
- Move-in Date: ${profile.move_in_date}
- Occupation: ${profile.occupation || 'Not specified'}

Compute a compatibility score from 0 to 100 based on budget and location match.
Return ONLY valid JSON in this exact format: { "score": number, "explanation": string }
The explanation should be 1-2 sentences describing the match quality.`;

  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 200
  });

  const content = response.choices[0].message.content.trim();

  // Parse JSON response
  let parsed;
  try {
    // Strip markdown code blocks if present
    const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`LLM returned invalid JSON: ${content}`);
  }

  if (typeof parsed.score !== 'number' || parsed.score < 0 || parsed.score > 100) {
    throw new Error(`LLM returned invalid score: ${parsed.score}`);
  }

  return {
    score: Math.round(parsed.score),
    explanation: parsed.explanation || 'Score computed by AI.',
    computed_by: 'llm'
  };
}

/**
 * Rule-based fallback scoring when LLM is unavailable.
 * Weights: 50% budget match, 50% location match.
 */
function computeRuleBased(profile, listing) {
  let score = 0;
  const reasons = [];

  // Budget scoring (50 points)
  const rent = listing.rent;
  const budgetMin = profile.budget_min;
  const budgetMax = profile.budget_max;

  if (rent >= budgetMin && rent <= budgetMax) {
    score += 50;
    reasons.push(`Rent $${rent} fits within budget ($${budgetMin}-$${budgetMax}).`);
  } else if (rent < budgetMin) {
    // Listing is cheaper than minimum - good but unusual
    score += 40;
    reasons.push(`Rent $${rent} is below budget minimum ($${budgetMin}) - very affordable.`);
  } else {
    // Over budget
    const overBy = rent - budgetMax;
    const overPercent = (overBy / budgetMax) * 100;
    if (overPercent <= 10) {
      score += 30;
      reasons.push(`Rent $${rent} is slightly above budget ($${budgetMax}) by ${Math.round(overPercent)}%.`);
    } else if (overPercent <= 25) {
      score += 15;
      reasons.push(`Rent $${rent} exceeds budget ($${budgetMax}) by ${Math.round(overPercent)}%.`);
    } else {
      score += 0;
      reasons.push(`Rent $${rent} significantly exceeds budget ($${budgetMax}).`);
    }
  }

  // Location scoring (50 points)
  const preferredCity = profile.preferred_city.toLowerCase().trim();
  const listingCity = listing.city.toLowerCase().trim();
  const preferredLoc = profile.preferred_location.toLowerCase().trim();
  const listingLoc = listing.location.toLowerCase().trim();

  if (preferredCity === listingCity) {
    if (listingLoc.includes(preferredLoc) || preferredLoc.includes(listingLoc)) {
      score += 50;
      reasons.push(`Exact location match in ${listing.city}.`);
    } else {
      score += 35;
      reasons.push(`Same city (${listing.city}) but different neighbourhood.`);
    }
  } else {
    // Partial city name match
    if (listingCity.includes(preferredCity) || preferredCity.includes(listingCity)) {
      score += 25;
      reasons.push(`Partial city match: ${listing.city} vs preferred ${profile.preferred_city}.`);
    } else {
      score += 0;
      reasons.push(`Location mismatch: listing is in ${listing.city}, tenant prefers ${profile.preferred_city}.`);
    }
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    explanation: reasons.join(' '),
    computed_by: 'rule_based'
  };
}

/**
 * Batch compute scores for a tenant against multiple listings.
 * Used when a tenant first loads the browse page.
 */
async function batchComputeForTenant(tenantId, listingIds) {
  const results = [];
  for (const listingId of listingIds) {
    const result = await computeCompatibility(tenantId, listingId);
    results.push({ listingId, ...result });
  }
  return results;
}

module.exports = { computeCompatibility, batchComputeForTenant };
