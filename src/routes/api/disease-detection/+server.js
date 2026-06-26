import { json } from '@sveltejs/kit';
import { adminDb } from '$lib/server/firebase-admin';
import { env } from '$env/dynamic/private';

// Diagnostic preset database mapping
const DIAGNOSTIC_PRESETS = {
	tomato: {
		pathogen: 'Tomato Early Blight',
		confidence: 94,
		severity: 'Moderate',
		severityColor: 'bg-amber-500',
		severityTextColor: 'text-amber-800 bg-amber-50 border-amber-100/50',
		treatment: 'Apply copper-based fungicide immediately. Ensure proper spacing between plants to improve air circulation. Remove and destroy affected lower leaves to prevent upward spread.',
		field: 'Tomato - Field Block A'
	},
	potato_unhealthy: {
		pathogen: 'Potato Late Blight',
		confidence: 88,
		severity: 'High',
		severityColor: 'bg-red-500',
		severityTextColor: 'text-red-700 bg-red-50 border-red-100/50',
		treatment: 'Destroy infected plants immediately to prevent infestation of adjacent areas. Apply protective chlorothalonil or mancozeb fungicides on remaining healthy plants. Avoid overhead irrigation.',
		field: 'Potato - Field B'
	},
	wheat_healthy: {
		pathogen: 'Healthy (No Disease Detected)',
		confidence: 99,
		severity: 'None',
		severityColor: 'bg-primary-green',
		severityTextColor: 'text-dark-green bg-emerald-50 border-emerald-100/50',
		treatment: 'No active pathogens detected. Maintain standard nitrogen fertilization schedule and monitor soil moisture levels regularly.',
		field: 'Wheat - North Plateau'
	}
};

/** @type {import('./$types').RequestHandler} */
export async function GET({ locals }) {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (locals.profile?.role !== 'farmer') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	try {
		const snapshot = await adminDb.collection('disease_scans')
			.where('farmerId', '==', locals.user.uid)
			.get();
		
		let scans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

		// Seed initial history if empty
		if (scans.length === 0) {
			const seedScans = [
				{
					crop: 'Potato - Field B',
					pathogen: 'Potato Late Blight',
					confidence: 88,
					severity: 'High',
					statusColor: 'text-red-700 bg-red-50 border-red-100/50',
					time: '2h ago',
					image: 'https://images.unsplash.com/photo-1592417817098-8f3d6eb19675?auto=format&fit=crop&w=600&q=80',
					farmerId: locals.user.uid,
					createdAt: new Date().toISOString()
				}
			];

			for (const item of seedScans) {
				const docRef = await adminDb.collection('disease_scans').add(item);
				scans.push({ id: docRef.id, ...item });
			}
		}

		// Sort by createdAt descending
		scans.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

		return json(scans);
	} catch (error) {
		console.error('Error fetching scan history:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, locals, fetch }) {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (locals.profile?.role !== 'farmer') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	try {
		const apiKey = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : '');
		if (!apiKey) {
			return json({ error: 'Gemini API key is not configured on the server. Please add GEMINI_API_KEY to your .env file.' }, { status: 400 });
		}

		const body = await request.json();
		const { filename, imageUrl } = body;

		if (!imageUrl) {
			return json({ error: 'No image data provided' }, { status: 400 });
		}

		// Extract MIME type and base64 string from data URL
		let mimeType = 'image/jpeg';
		let base64Data = imageUrl;

		if (imageUrl.startsWith('data:')) {
			const parts = imageUrl.split(',');
			base64Data = parts[1];
			const mimePart = parts[0].match(/data:(.*?);base64/);
			if (mimePart) {
				mimeType = mimePart[1];
			}
		}

		const prompt = `You are an expert plant pathologist. Analyze the uploaded leaf image of a crop, vegetable, or fruit.
Use Google Search grounding to fetch the most accurate, up-to-date scientific remedies, fungicide/treatment protocols, and pathogen spread mitigation protocols.

You must respond ONLY with a raw JSON object containing the following keys:
1. "pathogen": The common and scientific name of the disease/pathogen (e.g., "Tomato Early Blight (Alternaria solani)"). If the leaf is healthy, write "Healthy (No Disease Detected)" or "Healthy [Crop Name]".
2. "confidence": A numeric value between 0 and 100 representing your diagnosis confidence.
3. "severity": One of "None", "Low", "Moderate", "High".
4. "why_it_happens": A brief, clear explanation (1-2 sentences) explaining why this disease/pathogen infects the leaf (vectors, humidity, environmental conditions, cause).
5. "steps": An array of strings representing the sequential, step-by-step action plan to solve/treat the disease. Each step should be actionable (e.g. "Apply copper-based organic fungicides", "Prune and destroy infected leaves").
6. "field": A realistic field location name based on the crop type (e.g., "Tomato - Field Block A", "Potato - Field B", "Wheat - North Plateau").

Format the response as a single, clean JSON block:
{
  "pathogen": "...",
  "confidence": 95,
  "severity": "Moderate",
  "why_it_happens": "...",
  "steps": [
    "Step 1...",
    "Step 2..."
  ],
  "field": "..."
}`;

		const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

		const response = await fetch(endpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				contents: [
					{
						parts: [
							{
								inlineData: {
									mimeType: mimeType,
									data: base64Data
								}
							},
							{
								text: prompt
							}
						]
					}
				],
				tools: [
					{
						google_search: {}
					}
				]
			})
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			console.error('Gemini API Error:', errorData);
			return json({ error: `Gemini API returned error: ${errorData.error?.message || response.statusText}` }, { status: 502 });
		}

		const result = await response.json();
		const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;

		if (!textResponse) {
			console.error('Gemini API returned empty response:', result);
			return json({ error: 'Failed to generate diagnostic report from Gemini API' }, { status: 502 });
		}

		let cleanText = textResponse.trim();
		const jsonMatch = cleanText.match(/```json\s*([\s\S]*?)\s*```/) || cleanText.match(/```\s*([\s\S]*?)\s*```/);
		if (jsonMatch) {
			cleanText = jsonMatch[1];
		}
		cleanText = cleanText.trim();

		let parsed;
		try {
			parsed = JSON.parse(cleanText);
		} catch (parseErr) {
			console.error('Failed to parse Gemini response as JSON. Raw text:', textResponse, parseErr);
			return json({ error: 'AI response was not in the expected format. Please try scanning again.' }, { status: 502 });
		}

		const isHealthy = (parsed.pathogen || '').toLowerCase().includes('healthy') || parsed.severity === 'None';
		const severity = parsed.severity || 'Moderate';

		const statusColor = isHealthy
			? 'text-dark-green bg-emerald-50 border-emerald-100/50'
			: severity === 'High'
				? 'text-red-700 bg-red-50 border-red-100/50'
				: 'text-amber-800 bg-amber-50 border-amber-100/50';

		const newScan = {
			crop: parsed.field || 'General Cultivation Plot',
			pathogen: parsed.pathogen || 'Unknown Condition',
			confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 80,
			severity: severity,
			statusColor,
			time: 'Just now',
			image: imageUrl,
			farmerId: locals.user.uid,
			createdAt: new Date().toISOString(),
			whyItHappens: parsed.why_it_happens || parsed.whyItHappens || 'Pathogen vectors or environmental factors.',
			steps: Array.isArray(parsed.steps) ? parsed.steps : (parsed.treatment ? [parsed.treatment] : []),
			treatment: parsed.treatment || (Array.isArray(parsed.steps) ? parsed.steps.join(' ') : 'No treatment protocol provided.')
		};

		const docRef = await adminDb.collection('disease_scans').add(newScan);
		return json({ id: docRef.id, ...newScan });
	} catch (error) {
		console.error('Error saving diagnosis:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
