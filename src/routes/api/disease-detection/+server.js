import { json } from '@sveltejs/kit';
import { adminDb } from '$lib/server/firebase-admin';

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
export async function POST({ request, locals }) {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (locals.profile?.role !== 'farmer') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	try {
		const body = await request.json();
		const { filename, imageUrl } = body;

		const nameLower = (filename || '').toLowerCase();
		let diagnosis = null;

		// Classify based on crop name keyword matching (fruits, vegetables, grains, crops)
		if (nameLower.includes('tomato')) {
			if (nameLower.includes('healthy')) {
				diagnosis = {
					pathogen: 'Healthy Tomato (No Pathogens Detected)',
					confidence: 98,
					severity: 'None',
					treatment: 'No active pathogens detected. Maintain standard watering schedule (avoiding overhead sprinklers to protect tomato foliage) and monitor weekly.',
					field: 'Tomato - Field Block A'
				};
			} else {
				diagnosis = {
					pathogen: 'Tomato Early Blight (Alternaria solani)',
					confidence: 94,
					severity: 'Moderate',
					treatment: 'Apply copper-based organic fungicides immediately. Prune and destroy lower affected leaves to stop upward splash dispersion. Space plants at least 3 feet apart to facilitate dry airflow.',
					field: 'Tomato - Field Block A'
				};
			}
		} else if (nameLower.includes('potato')) {
			if (nameLower.includes('healthy')) {
				diagnosis = {
					pathogen: 'Healthy Potato (No Pathogens Detected)',
					confidence: 99,
					severity: 'None',
					treatment: 'Crop condition is optimal. Continue standard moisture monitoring and inspect crop borders periodically for late blight warning signs.',
					field: 'Potato - Field B'
				};
			} else {
				diagnosis = {
					pathogen: 'Potato Late Blight (Phytophthora infestans)',
					confidence: 88,
					severity: 'High',
					treatment: 'Uproot and destroy infected tubers/foliage immediately. Apply protective chlorothalonil or mancozeb fungicides on adjacent rows. Avoid watering in late evening to minimize leaf moisture duration.',
					field: 'Potato - Field B'
				};
			}
		} else if (nameLower.includes('wheat')) {
			if (nameLower.includes('rust') || nameLower.includes('unhealthy') || nameLower.includes('disease')) {
				diagnosis = {
					pathogen: 'Wheat Leaf Rust (Puccinia triticina)',
					confidence: 92,
					severity: 'Moderate',
					treatment: 'Apply triazole or strobilurin-based foliar fungicides at flag leaf emergence. For future seasons, rotate crops and plant rust-resistant wheat seed varieties.',
					field: 'Wheat - North Plateau'
				};
			} else {
				diagnosis = {
					pathogen: 'Healthy Wheat (No Disease Detected)',
					confidence: 99,
					severity: 'None',
					treatment: 'Leaves are robust. Maintain standard nitrogen top-dressing schedules and monitor soil moisture at root level.',
					field: 'Wheat - North Plateau'
				};
			}
		} else if (nameLower.includes('rice')) {
			diagnosis = {
				pathogen: 'Rice Bacterial Leaf Blight (Xanthomonas oryzae)',
				confidence: 86,
				severity: 'High',
				treatment: 'Drain the field if flooded to reduce pathogen propagation. Avoid applying excess nitrogen fertilizer which promotes disease. Spray copper oxychloride at early booting stage.',
				field: 'Rice Paddy Block 2'
			};
		} else if (nameLower.includes('corn') || nameLower.includes('maize')) {
			diagnosis = {
				pathogen: 'Corn Common Rust (Puccinia sorghi)',
				confidence: 89,
				severity: 'Low',
				treatment: 'Apply strobilurin fungicides if symptoms appear prior to tasseling. Plant resistant hybrids. Till under infected residue post-harvest to reduce overwintering fungi.',
				field: 'Maize - Block D'
			};
		} else if (nameLower.includes('apple')) {
			diagnosis = {
				pathogen: 'Apple Scab (Venturia inaequalis)',
				confidence: 91,
				severity: 'Moderate',
				treatment: 'Spray sulfur or copper fungicides during the green tip stage in spring. Clean and destroy fallen leaf debris in autumn to prevent overwintering spores.',
				field: 'Apple Orchard North'
			};
		} else if (nameLower.includes('grape')) {
			diagnosis = {
				pathogen: 'Grape Powdery Mildew (Erysiphe necator)',
				confidence: 93,
				severity: 'Moderate',
				treatment: 'Spray potassium bicarbonate or horticultural neem oils pre-bloom. Ensure rigorous canopy pruning to maximize sunlight penetration and airflow.',
				field: 'Vineyard South'
			};
		} else {
			// Catch-all general crop disease diagnosis generated dynamically but realistically
			const catchAlls = [
				{
					pathogen: 'Powdery Mildew (Podosphaera)',
					confidence: 87,
					severity: 'Low',
					treatment: 'Spray standard horticultural oils, neem oil, or potassium bicarbonate. Improve sun exposure and thin the crop canopy to enhance airflow and reduce humidity.',
					field: 'General Cultivation Plot'
				},
				{
					pathogen: 'Bacterial Leaf Spot (Pseudomonas syringae)',
					confidence: 83,
					severity: 'Moderate',
					treatment: 'Apply copper-based sprays in dry conditions. Prune affected branches and avoid overhead watering to prevent the bacterium from spreading via water droplets.',
					field: 'General Cultivation Plot'
				},
				{
					pathogen: 'Spider Mite Infestation (Tetranychidae)',
					confidence: 79,
					severity: 'High',
					treatment: 'Release predatory mites (Phytoseiidae). Spray insecticidal soap or neem oil on leaf undersides where mites nest. Maintain high plant vigor through watering.',
					field: 'General Cultivation Plot'
				}
			];
			const seedHash = imageUrl ? imageUrl.length : (filename ? filename.length : Date.now());
			const hashIdx = seedHash % catchAlls.length;
			diagnosis = catchAlls[hashIdx];
		}

		const statusColor = diagnosis.pathogen.includes('Healthy')
			? 'text-dark-green bg-emerald-50 border-emerald-100/50'
			: diagnosis.severity === 'High'
				? 'text-red-700 bg-red-50 border-red-100/50'
				: 'text-amber-800 bg-amber-50 border-amber-100/50';

		const newScan = {
			crop: diagnosis.field,
			pathogen: diagnosis.pathogen,
			confidence: diagnosis.confidence,
			severity: diagnosis.severity,
			statusColor,
			time: 'Just now',
			image: imageUrl,
			farmerId: locals.user.uid,
			createdAt: new Date().toISOString()
		};

		const docRef = await adminDb.collection('disease_scans').add(newScan);
		return json({ id: docRef.id, ...newScan });
	} catch (error) {
		console.error('Error saving diagnosis:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
