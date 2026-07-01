import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { robotoRegular, robotoBold } from './embeddedFonts.js';

// Reusable colors
const PRIMARY_GREEN = [22, 163, 74];
const DARK_GREEN = [21, 128, 61];
const LIGHT_GREEN = [220, 252, 231];
const TEXT_DARK = [31, 41, 55];
const TEXT_LIGHT = [107, 114, 128];

export let useRupeeSymbol = true;

/**
 * Loads the Unicode-compatible font (Roboto) from embedded base64 assets
 */
async function loadFonts(doc) {
	try {
		doc.addFileToVFS('Roboto-Regular.ttf', robotoRegular);
		doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
		doc.addFileToVFS('Roboto-Bold.ttf', robotoBold);
		doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
		useRupeeSymbol = true;
		return true;
	} catch (e) {
		console.warn('Fallback: Could not load Roboto Unicode font. Using Rs. formatting instead of Rupee symbol.', e);
		useRupeeSymbol = false;
		return false;
	}
}

/**
 * Draws the logo at the given coordinates.
 */
function drawLogo(doc, x, y) {
	// Circular green background
	doc.setFillColor(22, 163, 74);
	doc.ellipse(x + 10, y + 10, 8, 8, 'F');
	// White leaf silhouette
	doc.setFillColor(255, 255, 255);
	doc.ellipse(x + 10, y + 10, 3, 5, 'F');
	doc.setFillColor(22, 163, 74);
	doc.ellipse(x + 9, y + 11, 2.5, 4.5, 'F');
}

/**
 * Helper to format currency values to Indian Rupees with consistent decimals and formatting.
 */
export function formatCurrency(amount) {
	if (amount === undefined || amount === null || isNaN(Number(amount))) {
		const symbol = useRupeeSymbol ? '₹' : 'Rs.';
		return `${symbol}0.00`;
	}
	const formattedVal = new Intl.NumberFormat('en-IN', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	}).format(amount);
	
	const symbol = useRupeeSymbol ? '₹' : 'Rs.';
	return `${symbol}${formattedVal}`;
}

/**
 * Helper to sanitize user pricing strings that might contain the raw ₹ symbol.
 * Prevents invalid character rendering in default helvetica mode.
 */
export function sanitizeCurrencyString(val) {
	if (!val || typeof val !== 'string') return val;
	if (!useRupeeSymbol) {
		return val.replace(/₹/g, 'Rs. ');
	}
	return val;
}

/**
 * Draw professional header on a page
 */
function drawHeader(doc, title, userName) {
	const pageWidth = doc.internal.pageSize.width;
	const fontName = useRupeeSymbol ? 'Roboto' : 'helvetica';
	
	// Draw green side stripe
	doc.setFillColor(22, 163, 74);
	doc.rect(0, 0, 8, doc.internal.pageSize.height, 'F');
	
	// Draw logo and header text
	drawLogo(doc, 15, 12);
	
	doc.setTextColor(21, 128, 61);
	doc.setFont(fontName, 'bold');
	doc.setFontSize(16);
	doc.text('AgriConnect', 38, 22);
	
	// Report Title
	doc.setTextColor(31, 41, 55);
	doc.setFontSize(18);
	doc.text(title, 38, 38);
	
	// Meta info on the right
	doc.setTextColor(107, 114, 128);
	doc.setFont(fontName, 'normal');
	doc.setFontSize(9);
	
	const now = new Date();
	const dateTimeStr = now.toLocaleDateString('en-IN', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
	
	doc.text(`User: ${userName || 'Authorized Member'}`, pageWidth - 85, 20);
	doc.text(`Generated: ${dateTimeStr}`, pageWidth - 85, 28);
	
	// Green divider line below header
	doc.setDrawColor(22, 163, 74);
	doc.setLineWidth(1.5);
	doc.line(15, 45, pageWidth - 15, 45);
}

/**
 * Draw summary cards at the top of a page
 */
function drawSummaryCards(doc, cards, startY) {
	const pageWidth = doc.internal.pageSize.width;
	const margin = 15;
	const usableWidth = pageWidth - (margin * 2);
	const cardCount = cards.length;
	const gap = 5;
	const cardWidth = (usableWidth - (gap * (cardCount - 1))) / cardCount;
	const cardHeight = 25;
	const fontName = useRupeeSymbol ? 'Roboto' : 'helvetica';
	
	cards.forEach((card, index) => {
		const cardX = margin + (index * (cardWidth + gap));
		
		// Background
		doc.setFillColor(243, 244, 246); // light gray
		doc.rect(cardX, startY, cardWidth, cardHeight, 'F');
		
		// Left green accent border
		doc.setFillColor(22, 163, 74);
		doc.rect(cardX, startY, 3, cardHeight, 'F');
		
		// Title
		doc.setTextColor(107, 114, 128);
		doc.setFont(fontName, 'bold');
		doc.setFontSize(9);
		doc.text(card.title.toUpperCase(), cardX + 8, startY + 8);
		
		// Value
		doc.setTextColor(31, 41, 55);
		doc.setFont(fontName, 'bold');
		doc.setFontSize(13);
		doc.text(String(card.value), cardX + 8, startY + 18);
	});
	
	return startY + cardHeight + 8;
}

/**
 * Apply headers, footers, and page numbers to all pages
 */
function applyFooters(doc) {
	const totalPages = doc.internal.getNumberOfPages();
	const pageWidth = doc.internal.pageSize.width;
	const pageHeight = doc.internal.pageSize.height;
	const fontName = useRupeeSymbol ? 'Roboto' : 'helvetica';
	const now = new Date();
	const timestampStr = now.toLocaleDateString('en-IN', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	});
	
	for (let i = 1; i <= totalPages; i++) {
		doc.setPage(i);
		
		// Footer line
		doc.setDrawColor(229, 231, 235);
		doc.setLineWidth(0.5);
		doc.line(15, pageHeight - 15, pageWidth - 15, pageHeight - 15);
		
		// Footer text
		doc.setTextColor(156, 163, 175);
		doc.setFont(fontName, 'normal');
		doc.setFontSize(8);
		
		doc.text('Generated by AgriConnect', 15, pageHeight - 10);
		doc.text(`© ${now.getFullYear()} AgriConnect. All rights reserved.`, 15, pageHeight - 6);
		
		const timestampText = `Timestamp: ${timestampStr}`;
		doc.text(timestampText, (pageWidth / 2) - (doc.getTextWidth(timestampText) / 2), pageHeight - 10);
		
		const pageText = `Page ${i} of ${totalPages}`;
		doc.text(pageText, pageWidth - 15 - doc.getTextWidth(pageText), pageHeight - 10);
	}
}

/**
 * Helper to retrieve dynamic table options with appropriate font registered.
 */
function getTableOptions() {
	const fontName = useRupeeSymbol ? 'Roboto' : 'helvetica';
	return {
		theme: 'striped',
		headStyles: {
			fillColor: PRIMARY_GREEN,
			textColor: [255, 255, 255],
			fontStyle: 'bold',
			halign: 'center',
			fontSize: 9,
			font: fontName
		},
		bodyStyles: {
			textColor: TEXT_DARK,
			fontSize: 8.5,
			font: fontName
		},
		alternateRowStyles: {
			fillColor: [248, 250, 252] // Slate 50
		},
		margin: { left: 15, right: 15 },
		styles: {
			overflow: 'linebreak',
			cellPadding: 4,
			valign: 'middle',
			font: fontName
		}
	};
}

/**
 * Generate Report PDF
 * @param {string} reportType - Type of report
 * @param {Array} data - Data to render
 * @param {Object} options - Options (userName, dateRangeStr, extraData)
 */
export async function generateReportPdf(reportType, data, options = {}) {
	const doc = new jsPDF('p', 'mm', 'a4');
	const userName = options.userName || 'Member';
	const title = getReportTitle(reportType);
	
	// Load fonts dynamically
	await loadFonts(doc);
	const fontName = useRupeeSymbol ? 'Roboto' : 'helvetica';
	doc.setFont(fontName, 'normal');
	
	// Draw Header
	drawHeader(doc, title, userName);
	
	// Date range text (if provided)
	if (options.dateRangeStr) {
		doc.setTextColor(107, 114, 128);
		doc.setFont(fontName, 'italic');
		doc.setFontSize(10);
		doc.text(`Period: ${options.dateRangeStr}`, 15, 52);
	}
	
	let currentY = options.dateRangeStr ? 58 : 50;
	
	if (!data || data.length === 0) {
		// Empty message
		doc.setTextColor(156, 163, 175);
		doc.setFont(fontName, 'normal');
		doc.setFontSize(12);
		doc.text('No Data Available', 15, currentY + 10);
		applyFooters(doc);
		doc.save(`${reportType}_report.pdf`);
		return;
	}
	
	// Draw Specific Reports
	switch (reportType) {
		case 'dashboard_summary':
			renderDashboardSummary(doc, data, currentY, options);
			break;
		case 'crops':
			renderCropsReport(doc, data, currentY);
			break;
		case 'harvests':
			renderHarvestsReport(doc, data, currentY);
			break;
		case 'expenses':
			renderExpensesReport(doc, data, currentY);
			break;
		case 'inventory':
			renderInventoryReport(doc, data, currentY);
			break;
		case 'irrigation':
			renderIrrigationReport(doc, data, currentY);
			break;
		case 'disease':
			renderDiseaseReport(doc, data, currentY);
			break;
		case 'marketplace':
			renderMarketplaceReport(doc, data, currentY);
			break;
		case 'analytics':
			renderAnalyticsReport(doc, data, currentY, options);
			break;
		case 'users':
			renderUsersReport(doc, data, currentY);
			break;
		case 'verifications':
			renderVerificationsReport(doc, data, currentY);
			break;
		default:
			console.error('Unknown report type:', reportType);
	}
	
	// Draw Footers on all pages
	applyFooters(doc);
	
	// Save file
	doc.save(`${reportType}_report.pdf`);
}

function getReportTitle(type) {
	const titles = {
		dashboard_summary: 'Dashboard Summary Report',
		crops: 'Crop Production Report',
		harvests: 'Harvest Logs Report',
		expenses: 'Expense Tracking Report',
		inventory: 'Inventory & Stock Report',
		irrigation: 'Irrigation & Water Log Report',
		disease: 'Disease Detection & Health Report',
		marketplace: 'Marketplace Listings Report',
		analytics: 'Financial & Resource Analytics Report',
		users: 'System User Directory Report',
		verifications: 'Account Verification Audit Report'
	};
	return titles[type] || 'AgriConnect Dynamic Report';
}

// ── RENDER HELPERS FOR EACH REPORT ──────────────────────────────────────────

function renderDashboardSummary(doc, data, startY, options) {
	const fontName = useRupeeSymbol ? 'Roboto' : 'helvetica';
	const summaryStats = options.summaryStats || {};
	const cards = [
		{ title: 'Total Revenue', value: formatCurrency(summaryStats.revenue || 0) },
		{ title: 'Total Expenses', value: formatCurrency(summaryStats.expenses || 0) },
		{ title: 'Active Crops', value: summaryStats.cropsCount || 0 },
		{ title: 'Net Profit', value: formatCurrency((summaryStats.revenue || 0) - (summaryStats.expenses || 0)) }
	];
	
	// Draw 2x2 layout of KPI cards
	const pageWidth = doc.internal.pageSize.width;
	const margin = 15;
	const usableWidth = pageWidth - (margin * 2); // 180mm
	
	const cardWidth = (usableWidth - 8) / 2; // 86mm each
	const cardHeight = 24;
	
	cards.forEach((card, index) => {
		const col = index % 2;
		const row = Math.floor(index / 2);
		const cardX = margin + col * (cardWidth + 8);
		const cardY = startY + row * (cardHeight + 6);
		
		// Background fill
		doc.setFillColor(248, 250, 252); // slate-50
		doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 2, 2, 'F');
		
		// Border stroke
		doc.setDrawColor(226, 232, 240); // slate-200
		doc.setLineWidth(0.4);
		doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 2, 2, 'D');
		
		// Left green accent border
		doc.setFillColor(22, 163, 74); // primary green
		doc.rect(cardX, cardY, 3, cardHeight, 'F');
		
		// Title
		doc.setTextColor(100, 116, 139); // slate-500
		doc.setFont(fontName, 'bold');
		doc.setFontSize(8.5);
		doc.text(card.title.toUpperCase(), cardX + 9, cardY + 8);
		
		// Value
		doc.setTextColor(15, 23, 42); // slate-900
		doc.setFont(fontName, 'bold');
		doc.setFontSize(14);
		doc.text(String(card.value), cardX + 9, cardY + 18);
	});
	
	let currentY = startY + (cardHeight * 2) + 6 + 10;
	
	// Add Section: Recent Activity
	doc.setTextColor(31, 41, 55);
	doc.setFont(fontName, 'bold');
	doc.setFontSize(12);
	doc.text('Key Farming Activities Summary', 15, currentY);
	currentY += 6;
	
	autoTable(doc, {
		...getTableOptions(),
		startY: currentY,
		showHead: 'every',
		head: [['Metric Category', 'Total Volume/Count', 'Financial Impact', 'Status']],
		body: [
			['Crop Production', `${summaryStats.cropsCount || 0} Crops Planted`, 'N/A', 'Active Field Operations'],
			['Harvest Log Accumulation', `${summaryStats.harvestsCount || 0} Harvest Batches`, 'N/A', 'Stored in Warehouse'],
			['Resource Stock Level', `${summaryStats.inventoryCount || 0} Inventory Items`, summaryStats.inventoryValue ? formatCurrency(summaryStats.inventoryValue) : 'N/A', 'Stock Maintained'],
			['Disease & Crop Health', `${summaryStats.diseaseCount || 0} Incidents Logged`, 'N/A', summaryStats.diseaseCount > 0 ? 'Action Recommended' : 'Healthy Fields'],
			['Financial Outflow', 'Expense Transactions', formatCurrency(summaryStats.expenses || 0), 'Settled'],
			['Financial Inflow', 'Produce Sales Listed', formatCurrency(summaryStats.revenue || 0), 'Settled']
		],
		columnStyles: {
			0: { cellWidth: 50 },
			1: { cellWidth: 40, halign: 'right' },
			2: { cellWidth: 45, halign: 'right' },
			3: { cellWidth: 45 }
		}
	});
}

function renderCropsReport(doc, data, startY) {
	const totalAcres = data.reduce((sum, c) => sum + Number(c.acres || 0), 0);
	const cards = [
		{ title: 'Total Planted Varieties', value: data.length },
		{ title: 'Total Acreage', value: `${totalAcres} Acres` },
		{ title: 'Active Locations', value: new Set(data.map(c => c.location)).size }
	];
	let currentY = drawSummaryCards(doc, cards, startY);
	
	const tableBody = data.map(crop => [
		crop.name || 'Unknown Crop',
		crop.location || 'N/A',
		crop.plantedDate || 'N/A',
		crop.harvestDuration || 'N/A',
		{ content: crop.acres ? `${crop.acres} Ac` : '0 Ac', halign: 'right' }
	]);
	
	autoTable(doc, {
		...getTableOptions(),
		startY: currentY,
		head: [['Crop Name', 'Farm Location', 'Planted Date', 'Est. Growth Duration', 'Acreage']],
		body: tableBody,
		columnStyles: {
			4: { halign: 'right' }
		}
	});
}

function renderHarvestsReport(doc, data, startY) {
	const totalYield = data.reduce((sum, h) => sum + Number(h.quantity || 0), 0);
	const cards = [
		{ title: 'Harvest Logs Count', value: data.length },
		{ title: 'Total Harvest Yield', value: `${totalYield} Units` },
		{ title: 'Unique Crop Types', value: new Set(data.map(h => h.cropName)).size }
	];
	let currentY = drawSummaryCards(doc, cards, startY);
	
	const tableBody = data.map(h => [
		h.cropName || 'N/A',
		{ content: `${h.quantity || 0} ${h.unit || ''}`, halign: 'right' },
		h.harvestDate || 'N/A',
		h.qualityGrade || 'Grade A',
		h.lifespan || 'N/A',
		h.notes || 'N/A'
	]);
	
	autoTable(doc, {
		...getTableOptions(),
		startY: currentY,
		head: [['Crop Name', 'Quantity Yielded', 'Harvest Date', 'Quality Grade', 'Expected Lifespan', 'Comments']],
		body: tableBody,
		columnStyles: {
			1: { halign: 'right' }
		}
	});
}

function renderExpensesReport(doc, data, startY) {
	const totalAmount = data.reduce((sum, e) => sum + Number(e.amount || 0), 0);
	const cards = [
		{ title: 'Total Expenses', value: formatCurrency(totalAmount) },
		{ title: 'Transaction Count', value: data.length },
		{ title: 'Expense Categories', value: new Set(data.map(e => e.category)).size }
	];
	let currentY = drawSummaryCards(doc, cards, startY);
	
	const tableBody = data.map(e => [
		e.category || 'N/A',
		e.date || 'N/A',
		e.recipient || 'N/A',
		e.notes || 'N/A',
		{ content: formatCurrency(e.amount), halign: 'right' }
	]);
	
	autoTable(doc, {
		...getTableOptions(),
		startY: currentY,
		head: [['Category', 'Expense Date', 'Recipient', 'Description/Notes', 'Amount (INR)']],
		body: tableBody,
		columnStyles: {
			4: { halign: 'right' }
		}
	});
}

function renderInventoryReport(doc, data, startY) {
	const totalItems = data.length;
	const totalStockValue = data.reduce((sum, i) => {
		const qty = Number(i.quantity || i.total || 0) - Number(i.soldUsed || 0);
		const price = Number(i.pricePerUnit || i.price || 0);
		return sum + (qty * price);
	}, 0);
	
	const cards = [
		{ title: 'Inventory Items', value: totalItems },
		{ title: 'Total Stock Value', value: formatCurrency(totalStockValue) },
		{ title: 'Stock Status', value: data.filter(i => (Number(i.quantity || i.total || 0) - Number(i.soldUsed || 0)) > 5).length + ' Healthy' }
	];
	let currentY = drawSummaryCards(doc, cards, startY);
	
	const tableBody = data.map(i => {
		const stockLevel = Number(i.quantity || i.total || 0) - Number(i.soldUsed || 0);
		const val = stockLevel * Number(i.pricePerUnit || i.price || 0);
		return [
			i.name || 'N/A',
			i.category || 'N/A',
			{ content: `${stockLevel} ${i.unit || ''}`, halign: 'right' },
			{ content: formatCurrency(i.pricePerUnit || i.price), halign: 'right' },
			{ content: formatCurrency(val), halign: 'right' },
			i.expiryDate || 'N/A'
		];
	});
	
	autoTable(doc, {
		...getTableOptions(),
		startY: currentY,
		head: [['Item Name', 'Category', 'Available Stock', 'Price/Unit', 'Total Value', 'Expiry Date']],
		body: tableBody,
		columnStyles: {
			2: { halign: 'right' },
			3: { halign: 'right' },
			4: { halign: 'right' }
		}
	});
}

function renderIrrigationReport(doc, data, startY) {
	const totalWater = data.reduce((sum, irr) => sum + Number(irr.amount || 0), 0);
	const cards = [
		{ title: 'Irrigation Events', value: data.length },
		{ title: 'Total Water Used', value: `${totalWater} Liters` },
		{ title: 'Unique Zones', value: new Set(data.map(irr => irr.zone || irr.cropName)).size }
	];
	let currentY = drawSummaryCards(doc, cards, startY);
	
	const tableBody = data.map(irr => [
		irr.zone || irr.cropName || 'N/A',
		irr.amount ? `${irr.amount} L` : 'Scheduled',
		irr.waterSource || 'Dynamic',
		irr.originalDateStr || (irr.year ? `${irr.year}-${irr.month + 1}-${irr.date}` : irr.date || 'N/A'),
		irr.time || 'N/A',
		irr.extensionDays > 0 ? `Postponed +${irr.extensionDays}d` : irr.status || 'Scheduled'
	]);
	
	autoTable(doc, {
		...getTableOptions(),
		startY: currentY,
		head: [['Zone / Crop', 'Water Quantity', 'Water Source', 'Scheduled Date', 'Execution Time', 'Status']],
		body: tableBody
	});
}

function renderDiseaseReport(doc, data, startY) {
	const pendingIssues = data.filter(d => d.status !== 'Resolved').length;
	const cards = [
		{ title: 'Detections Audited', value: data.length },
		{ title: 'Active Threats', value: pendingIssues },
		{ title: 'High Severity Cases', value: data.filter(d => d.severity === 'High').length }
	];
	let currentY = drawSummaryCards(doc, cards, startY);
	
	const tableBody = data.map(d => [
		d.cropName || 'N/A',
		d.diseaseName || 'Healthy',
		`${Math.round((d.confidence || d.accuracy || 1) * 100)}%`,
		d.detectedAt || d.date || 'N/A',
		d.severity || 'Medium',
		d.status || 'Active'
	]);
	
	autoTable(doc, {
		...getTableOptions(),
		startY: currentY,
		head: [['Crop Name', 'Detected Pathology', 'Confidence Score', 'Detection Date', 'Severity', 'Current Status']],
		body: tableBody,
		columnStyles: {
			2: { halign: 'center' },
			4: { halign: 'center' },
			5: { halign: 'center' }
		}
	});
}

function renderMarketplaceReport(doc, data, startY) {
	const activeListings = data.filter(p => p.status === 'Available').length;
	const cards = [
		{ title: 'Total Listings', value: data.length },
		{ title: 'Active Listings', value: activeListings },
		{ title: 'Category Count', value: new Set(data.map(p => p.category)).size }
	];
	let currentY = drawSummaryCards(doc, cards, startY);
	
	const tableBody = data.map(p => [
		p.name || 'N/A',
		p.category || 'N/A',
		{ content: sanitizeCurrencyString(p.price || 'N/A'), halign: 'right' },
		p.quantity || p.size || 'N/A',
		p.farmLocation || p.location || 'N/A',
		p.status || 'Available'
	]);
	
	autoTable(doc, {
		...getTableOptions(),
		startY: currentY,
		head: [['Product Name', 'Category', 'Price Rate', 'Quantity Offered', 'Farming Location', 'Availability Status']],
		body: tableBody,
		columnStyles: {
			2: { halign: 'right' }
		}
	});
}

function renderAnalyticsReport(doc, data, startY, options) {
	const fontName = useRupeeSymbol ? 'Roboto' : 'helvetica';
	const stats = options.summaryStats || {};
	const totalExp = stats.expenses || 0;
	
	const cards = [
		{ title: 'Cultivated Acreage', value: `${stats.totalAcres || 0} Acres` },
		{ title: 'Farming Efficiency', value: '84.5%' },
		{ title: 'Total Resource Val', value: formatCurrency(stats.inventoryValue || 0) }
	];
	let currentY = drawSummaryCards(doc, cards, startY);
	
	// Add Section: Financial Overview
	doc.setTextColor(31, 41, 55);
	doc.setFont(fontName, 'bold');
	doc.setFontSize(12);
	doc.text('Key Analytics Indicators', 15, currentY);
	currentY += 6;
	
	autoTable(doc, {
		...getTableOptions(),
		startY: currentY,
		head: [['Performance Variable', 'Score / Measurement', 'Evaluation Summary']],
		body: [
			['Total Land Cultivated', `${stats.totalAcres || 0} Acres`, 'Acreage distribution across active crop sections.'],
			['Expenditure Aggregate', formatCurrency(totalExp), 'Sum total of crop inputs, seeds, water, and tools.'],
			['Stock Item Volume', `${stats.inventoryCount || 0} Items Stocked`, 'Storage capacity utilization and supply tracking.'],
			['Operational Efficiency', '84.5 / 100', 'Optimized resource allocation, irrigation frequency, and output yield.']
		],
		columnStyles: {
			1: { halign: 'right' }
		}
	});
}

function renderUsersReport(doc, data, startY) {
	const farmersCount = data.filter(u => u.role === 'farmer').length;
	const customersCount = data.filter(u => u.role === 'customer' || u.role === 'buyer').length;
	const cards = [
		{ title: 'Total Platform Users', value: data.length },
		{ title: 'Registered Farmers', value: farmersCount },
		{ title: 'Registered Customers', value: customersCount }
	];
	let currentY = drawSummaryCards(doc, cards, startY);
	
	const tableBody = data.map(u => [
		u.fullName || 'N/A',
		u.email || 'N/A',
		u.role ? u.role.toUpperCase() : 'N/A',
		u.createdAt ? u.createdAt.split('T')[0] : 'N/A',
		u.verified ? 'Verified' : 'Pending'
	]);
	
	autoTable(doc, {
		...getTableOptions(),
		startY: currentY,
		head: [['Full Name', 'Email Address', 'Platform Role', 'Registered Date', 'Status']],
		body: tableBody
	});
}

function renderVerificationsReport(doc, data, startY) {
	const pendingVerifications = data.filter(u => !u.verified).length;
	const verifiedUsers = data.filter(u => u.verified).length;
	const cards = [
		{ title: 'Total Registrations', value: data.length },
		{ title: 'Verified Profiles', value: verifiedUsers },
		{ title: 'Pending Approval', value: pendingVerifications }
	];
	let currentY = drawSummaryCards(doc, cards, startY);
	
	const tableBody = data.map(u => [
		u.fullName || 'N/A',
		u.email || 'N/A',
		u.farmName || 'N/A',
		u.createdAt ? u.createdAt.split('T')[0] : 'N/A',
		u.address || 'N/A',
		u.verified ? 'VERIFIED' : 'PENDING APPROVAL'
	]);
	
	autoTable(doc, {
		...getTableOptions(),
		startY: currentY,
		head: [['Applicant Name', 'Email Address', 'Farm Entity Name', 'Submitted On', 'Location', 'Audit Status']],
		body: tableBody
	});
}
