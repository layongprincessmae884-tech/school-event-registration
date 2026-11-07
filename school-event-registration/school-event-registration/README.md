# School Event Registration System — RSU Cajidiocan Campus

A full-stack web app where students can browse school events and register online,
and admins can manage events, view registered students, and see reports.

Built with: Node.js + Express, MongoDB (Mongoose), JWT auth, vanilla HTML/CSS/JS.

## Pages (matches the wireframes)
1. **Home** (`index.html#home`) — hero + features
2. **Login** (`index.html#login`) — email/student ID + password
3. **Register** (`register.html`) — create student account
4. **Dashboard** — stats + upcoming events
5. **Events** — searchable event grid
6. **Event Details** — event info + one-click registration
7. **Admin Panel** (`admin.html`) — add/edit/delete events, registered students, reports

## Setup
1. Install Node.js and MongoDB (or use a free MongoDB Atlas cluster).
2. In the project folder, run: `npm install`
3. Edit `.env`:
   - `MONGO_URI` — your MongoDB connection string
   - `JWT_SECRET` — a long random string
   - `ADMIN_EMAIL` / `ADMIN_PASSWORD` — default admin account (created automatically)
4. Start the server: `npm start`
5. Open http://localhost:3000

## Default accounts (auto-seeded)
| Role    | Login (email or ID) | Password   |
|---------|---------------------|------------|
| Admin   | admin@rsu.edu.ph    | admin123   |

Students register themselves via the Register page.
Seed events (Intramurals, Digital Skills Seminar, Arts & Culture Fest) are added on first run.

## API summary
- `POST /api/auth/register` — create account
- `POST /api/auth/login` — login (email or student ID)
- `GET  /api/events` — list events (admin sees all; students see Active only)
- `GET  /api/events/:id` — event details (+ registered flag/count)
- `POST /api/events` / `PUT /api/events/:id` / `DELETE /api/events/:id` — admin only
- `POST /api/registrations` — register for an event (duplicate-proof)
- `GET  /api/registrations/mine` — my registrations
- `DELETE /api/registrations/:id` — cancel a registration
- `GET  /api/registrations` — admin: all registrations
