# Database Migration Guide (Old Supabase -> New Supabase)

## Overview
This folder contains the complete migration toolkit to move all schema, tables, relationships, and data from the old Supabase project (`zrlonpwblvgovgwweajy`) to the new Supabase project (`nqjhcopbxroxabithxpm`).

### Backup Summary
- **roles**: 4 records
- **departments**: 4 records
- **rank**: 0 records
- **hub**: 0 records
- **users**: 76 records
- **events**: 205 records
- **event_assignments**: 226 records
- **event_signatures**: 1,483 records
- **Total records backed up**: 1,998 records

---

## Step 1: Create Schema in New Supabase
1. Open the [Supabase Dashboard](https://supabase.com/dashboard) and select your new project (`nqjhcopbxroxabithxpm`).
2. Go to the **SQL Editor** in the left sidebar.
3. Click **New Query**.
4. Open [01_schema.sql](file:///d:/FOP%20Things/Attendance%20List%20Web%20App/database_migration/01_schema.sql), copy its entire contents, and paste it into the SQL Editor.
5. Click **Run**.
6. You will see `Success. No rows returned` — all tables, foreign keys, indexes, and RLS policies are now created!

---

## Step 2: Import All Data into New Supabase
Once Step 1 is completed, simply run the import script in your terminal:

```bash
node database_migration/import_to_new_supabase.js
```

This will automatically:
1. Connect to `https://nqjhcopbxroxabithxpm.supabase.co`.
2. Insert all roles, departments, users, events, event assignments, and 1,483 signatures in batches.
3. Verify and print a summary table confirming 100% of rows match the backup.

*(Alternative: You can also run `02_all_data.sql` directly in the Supabase SQL Editor if you prefer pure SQL).*

---

## Step 3: Google SSO Configuration (If using Google Login)
In your new Supabase project:
1. Go to **Authentication** -> **Providers**.
2. Enable **Google**.
3. Add your Google OAuth Client ID and Secret (from Google Cloud Console).
4. In **Authentication** -> **URL Configuration**, add your new Vercel app URL (e.g., `https://attend-sync.vercel.app/` or your production domain) under **Redirect URLs**.
