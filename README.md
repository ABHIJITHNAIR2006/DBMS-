# ClayStock - Stationery Management System

An academic DBMS mini-project demonstrating a 3NF Relational Database Management System with a tactile claymorphic user interface, 3D stationery visualization, and Gemini-powered DBMS viva assistance, smart search, and restock forecasting.

## Features
- **Normalized 3NF Relational Schema**: 10 interconnected tables covering items, suppliers, pincode-city functional dependencies, batches, consumable/durable specializations, purchases, and departmental distributions.
- **Derived Stock Calculations**: Accurate, real-time stock computation preventing stockouts.
- **SQL Audit Log & Query Playground**: Live interactive query playground, normalization walkthrough, and relational schema diagrams.
- **Tactile Claymorphism UI**: Bespoke clay components, light/dark themes, and interactive 3D hero scene with 6 stationery items.
- **Gemini AI Features**:
  - AI Smart Search: Translates natural language into structured catalog filters.
  - AI Restock Advisor: Automated procurement suggestions based on inventory levels.
  - AI Item Assistant: Suggests catalog attributes, category, type, and unit prices.
  - AI Database Assistant: Interactive DBMS tutor and viva exam explainer for SQL queries.

## Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The application runs at `http://localhost:3000`.

## Deploy on Vercel

To deploy ClayStock on Vercel:

1. **Import the Repository**:
   - Push this codebase to GitHub, GitLab, or Bitbucket.
   - Go to [Vercel Dashboard](https://vercel.com/dashboard) and click **Add New > Project**.
   - Import your repository. Vercel automatically detects Vite framework settings configured in `vercel.json`.

2. **Configure Environment Variables**:
   - In your Vercel project settings, navigate to **Settings > Environment Variables**.
   - Add the following environment variable:
     - `GEMINI_API_KEY`: Your Google Gemini API Key (ensure it is enabled for **Production**, **Preview**, and **Development**).
     - *(Optional)* `GEMINI_MODEL`: Defaults to `gemini-2.5-flash` if not set.

3. **Deploy & Verify**:
   - Trigger a redeployment.
   - Once deployed, verify your Gemini AI integration by opening `https://<your-vercel-domain>/api/gemini/status` in your browser.
   - It should return:
     ```json
     {
       "available": true,
       "model": "gemini-2.5-flash"
     }
     ```
