# Analytics Dashboard Roadmap

Street Food Fighter can grow from a map prototype into an operations and data platform.

## Roles

- GitHub: source code repository
- Vercel: web app hosting and admin UI
- Supabase: shared database for trucks, locations, likes, and visits
- Python: analytics, reports, forecasting, and dashboards

## Admin dashboard ideas

### Daily overview

- Number of active food trucks today
- Number of new truck registrations
- Total likes
- Visit verification count
- Active trucks by hour

### Location analytics

- Active trucks by district
- Popular operating spots
- Heat map of truck locations
- Time based location patterns
- Recommended zones for tomorrow

### Food category analytics

- Count by food type
- Likes by food type
- Visit verification by food type
- Underserved category detection

### Truck ranking

- Top trucks by likes
- Top trucks by verified visits
- Top trucks by repeat activity
- Recently opened trucks

### Python analysis layer

Python can read Supabase data and generate:

- pandas summary tables
- plotly charts
- daily HTML reports
- weekly PDF reports
- demand prediction models
- location recommendation models

## Future architecture

1. Users register trucks in the Vercel web app.
2. Data is saved in Supabase.
3. The admin dashboard reads Supabase data.
4. Python jobs create advanced statistics and reports.
5. Results are shown in the admin page.

## Suggested dashboard stack

- Frontend: Vercel, HTML, JavaScript, Plotly.js
- Database: Supabase PostgreSQL
- Python reports: pandas, plotly, scikit-learn
- Optional scheduled jobs: GitHub Actions or Supabase Edge Functions

## Next implementation steps

1. Connect the current app to Supabase.
2. Add `food_trucks`, `food_truck_likes`, and `visit_logs` tables.
3. Add an admin dashboard page.
4. Add charts for daily count, food category, likes, and location clusters.
5. Add Python report generation later.
