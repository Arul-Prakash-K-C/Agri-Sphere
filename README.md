# Agri Sphere

Agri Sphere is an AI-powered smart agriculture management and direct-to-consumer marketplace platform. Designed to eliminate supply chain middlemen and empower farmers, the platform provides a centralized hub for managing farm operations, securely selling produce directly to consumers, and diagnosing crop diseases instantly using advanced multimodal AI (Google Gemini 2.5 Flash).

## Features

*   **AI Crop Disease Detection:** Upload leaf or plant images to receive instant diagnoses, confidence scores, and treatment recommendations using Google Gemini.
*   **Direct-to-Consumer Marketplace:** A zero-commission platform where verified farmers can list produce, and customers can browse, compare, and purchase directly.
*   **Farm Operations Management (CRUD):** Digital tracking of planted crops, harvest yields, warehouse inventory, and seasonal expenses.
*   **Weather-Integrated Irrigation:** Real-time weather forecasting (via Open-Meteo) combined with smart scheduling to optimize water usage.
*   **Financial & Analytics Dashboard:** Visual insights into farm profitability, expense distributions, and crop yield shares.
*   **Dynamic PDF Reporting:** Automatically generate downloadable PDF reports of financial records and diagnostic histories.
*   **Admin Verification Portal:** Ensures marketplace trust by allowing administrators to safely review and approve newly registered farmers.
*   **Task Management:** A built-in todo list for farmers to organize, prioritize, and track daily agricultural chores.

## 🔑 Demo Login Credentials

**Farmer**
*   **Email:** gmouly1@gmail.com
*   **Password:** 1234567890

**Buyer**
*   **Email:** gmouly2005@gmail.com
*   **Password:** 1234567890

**Admin**
*   **Email:** gmouly@gmail.com
*   **Password:** 1234567890

## Tech Stack

*   **Frontend:** SvelteKit (Svelte 5), Tailwind CSS
*   **Backend:** SvelteKit Server Routes (Node.js)
*   **Database & Auth:** Firebase Firestore, Firebase Authentication
*   **AI Integration:** Google Gemini 2.5 Flash API
*   **Deployment:** Vercel

## Architecture

The system follows a modern serverless full-stack architecture:
*   **Client:** Svelte 5 components handle reactive state and UI rendering.
*   **Server:** SvelteKit API endpoints (`+server.js`) act as a secure proxy, executing database transactions and external API calls.
*   **Data Layer:** Firebase handles role-based user authentication and NoSQL document storage (collections: `users`, `crops`, `sales`, `inventory`, `disease_scans`, `tasks`, etc.).
*   **Intelligence:** The Gemini API performs stateless, multimodal image analysis on demand.

## Folder Structure

```text
src/
├── lib/
│   ├── components/    # Reusable Svelte UI components (Cards, Buttons, etc.)
│   ├── server/        # Firebase Admin SDK initialization
│   ├── services/      # Database abstraction logic
│   ├── pdf/           # PDF generation utilities
│   └── stores/        # Global Svelte reactive states
├── routes/
│   ├── api/           # Backend REST endpoints (disease-detection, dashboard, etc.)
│   ├── admin/         # Admin verification dashboard
│   ├── customer/      # Customer marketplace, wishlist, and comparison tools
│   ├── farmer/        # Farmer operations (crops, inventory, irrigation, AI)
│   ├── login/         # Authentication flow
│   ├── signup/        # Registration flow
│   ├── todo/          # Task management portal
│   └── +layout.svelte # Root layout and dynamic navigation routing
```

## Installation

Clone the repository and install the dependencies:

```bash
git clone <your-repository-url>
cd Agri-Sphere
npm install
```

## Environment Variables

Create a `.env` file in the root directory and add the following keys. You will need to populate these with your own Firebase and Google AI credentials.

```env
# Firebase Client Configuration
VITE_FIREBASE_API_KEY="your_api_key"
VITE_FIREBASE_AUTH_DOMAIN="your_project.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="your_project_id"
VITE_FIREBASE_STORAGE_BUCKET="your_project.firebasestorage.app"
VITE_FIREBASE_MESSAGING_SENDER_ID="your_sender_id"
VITE_FIREBASE_APP_ID="your_app_id"

# Firebase Admin Configuration (Server-Side)
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"..."}'

# AI Configuration
GEMINI_API_KEY="your_gemini_api_key"
```

## Firebase Setup

1. Create a Firebase project in the [Firebase Console](https://console.firebase.google.com/).
2. Enable **Authentication** (Email/Password & Google OAuth).
3. Enable **Firestore Database** and deploy the security rules found in `firestore.rules`.
4. Navigate to **Project Settings > Service Accounts**, generate a new private key, and stringify the JSON into the `FIREBASE_SERVICE_ACCOUNT_KEY` environment variable.

## AI Configuration

1. Obtain an API key from [Google AI Studio](https://aistudio.google.com/).
2. Add it to the `.env` file as `GEMINI_API_KEY`.
3. The platform is configured to use the `gemini-2.5-flash` model for optimal speed and multimodal image processing.

## Running Locally

Start the Vite development server:

```bash
npm run dev
```

Navigate to `http://localhost:5173` in your browser to view the application.

## Deployment

This project is configured to deploy seamlessly to Vercel via the `@sveltejs/adapter-vercel` package.

1. Push your code to GitHub.
2. Import the repository in your Vercel dashboard.
3. Add all environment variables in the Vercel project settings.
4. Click Deploy (Vercel will automatically detect the SvelteKit framework).

## Screenshots

*(Replace the placeholders below with actual image paths once captured)*

![Login Page](placeholder-login.png)
![Farmer Dashboard](placeholder-dashboard.png)
![AI Disease Detection](placeholder-ai.png)
![Marketplace](placeholder-marketplace.png)

## Future Improvements

*   **IoT Sensor Integration:** Connect physical soil moisture and temperature sensors directly to the dashboard to automate data entry.
*   **Payment Gateway:** Integrate Stripe or Razorpay for live marketplace financial transactions.
*   **Predictive Analytics:** Utilize historical weather and harvest data to predict optimal planting dates and expected yields.

## Contributors

*   **Team:** Duo Verse
*   **Members:** Arul Prakash K C, Moulishwar G
*   **Institution:** Sona College Of Technology / MCA

## License

This project is licensed under the MIT License - see the `LICENSE` file for details.
