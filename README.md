# UpNext

A real React + Supabase version of the UpNext internship/job tracker.

## Replit setup
1. Create a new Replit React/Vite project.
2. Upload these files or import the ZIP.
3. Run `npm install`.
4. Create a free Supabase project.
5. In Supabase SQL Editor, paste and run `supabase-schema.sql`.
6. In Replit Secrets, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
7. Run `npm run dev`.
8. Deploy on Replit when ready.

## What works
- Email/password sign up and login
- Persistent applications in Supabase
- Add/edit/delete applications
- Search/filter applications
- Status dashboard counts
- Public profile page for applications marked Public
- Job discovery link saving
- Rule-based AI helper

LinkedIn and Handshake automatic imports are not included because those APIs are restricted. Use manual saved links first.
