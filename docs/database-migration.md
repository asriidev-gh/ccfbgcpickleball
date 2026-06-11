# Database migration guide

This project includes local **export** and **restore** commands for moving MongoDB data between Atlas clusters (for example M10 → Flex → Free) without installing `mongodump` / `mongorestore`.

Exports are saved under `migrations/` as JSON files. That folder is gitignored because backups can contain user emails and password hashes.

---

## Quick reference

| Task | Command |
|------|---------|
| Export app data (10 collections) | `npm run db:export [label] [--db <name>]` |
| Restore app data | `npm run db:restore -- <folder-name> --force [--db <name>]` |
| Export **every** collection in a DB | `npm run db:export:database -- <database-name> [label]` |
| Restore raw database export | `npm run db:restore:database -- <folder-name> --force [--db <name>]` |
| Export one collection | `npm run db:export:collection -- <collection> [label]` |
| Restore one collection | `npm run db:restore:collection -- <folder-name> --force` |
| List backups | `npm run db:restore` or `npm run db:restore:collection` |
| Create demo data only | `npm run seed` |

**`npm run seed` is not a full restore.** It only creates demo open-play data. Use `db:restore` to rebuild from a backup.

---

## Export a backup

1. Make sure `.env.local` points at the **source** cluster (the one you want to copy *from*).

```env
MONGODB_URI=mongodb+srv://...
MONGODB_DB=ccf_pickleball
```

2. Run export with an optional label:

```bash
npm run db:export ccf
```

3. A folder is created:

```text
migrations/ccf_2026-06-11_22-30-45/
  manifest.json
  users.json
  players.json
  picklegames.json
  queueentries.json
  courts.json
  matchhistories.json
  leaderboardstats.json
  volunteers.json
  organizernotifications.json
  organizerblockedplayers.json
```

Folder name format: `{label}_{YYYY-MM-DD_HH-MM-SS}`

If you omit the label, the default is `backup`:

```bash
npm run db:export
# → migrations/backup_2026-06-11_22-30-45/
```

The command prints document counts and the exact restore command to use later.

---

## Export another MongoDB database (all collections)

Use this when the database name is **not** `ccfpickleball` / `ccf_pickleball`, or when you want **every** collection MongoDB knows about (not only the 10 app collections).

Same Atlas cluster, different database name:

```bash
npm run db:export:database -- analytics_db
npm run db:export:database -- staging_db nightly-backup
```

By default, **only collections with data** are exported. Empty collections (for example unused `picklegames` / `players` shells) are skipped. To include empty collections too:

```bash
npm run db:export:database -- 2xu backup --include-empty
```

Creates:

```text
migrations/db_analytics_db_backup_2026-06-11_22-30-45/
  manifest.json
  users.json
  players.json
  ...every collection in that database...
```

Restore:

```bash
npm run db:restore:database -- db_analytics_db_backup_2026-06-11_22-30-45 --force
```

Restore into a **different** database name on the same cluster:

```bash
npm run db:restore:database -- db_analytics_db_backup_2026-06-11_22-30-45 --force --db new_database_name
```

### App export with `--db` (same 10 collections)

If the other database uses the **same app schema** (users, players, picklegames, etc.):

```bash
npm run db:export -- staging-backup --db staging_db
npm run db:restore -- staging-backup_2026-06-11_22-30-45 --force --db flex_db
```

You can also set `MONGODB_DB` in `.env.local` instead of passing `--db`.

| Command | What it exports |
|---------|-----------------|
| `db:export` | App's 10 collections only |
| `db:export:database` | **All** collections in the named database |
| `db:export:collection` | One collection only |

---

## Export / restore a single collection

Use this when you only need one collection (for example `players` for a spreadsheet review), not a full cluster migration.

### Valid collection names

- `users`
- `players`
- `picklegames`
- `queueentries`
- `courts`
- `matchhistories`
- `leaderboardstats`
- `volunteers`
- `organizernotifications`
- `organizerblockedplayers`

### Export one collection

```bash
npm run db:export:collection -- players
npm run db:export:collection -- players roster-backup
```

Creates a folder like:

```text
migrations/players_roster-backup_2026-06-11_22-30-45/
  manifest.json
  players.json
```

Folder format: `{collection}_{label}_{date_time}`

### Restore one collection

```bash
npm run db:restore:collection -- players_roster-backup_2026-06-11_22-30-45 --force
```

This **only replaces that one collection**. Other collections in the database are left unchanged.

**Warning:** Restoring a single collection into a live database can break relationships. For example, restoring `players` without related `queueentries` can cause missing queue rows. Prefer full `db:export` / `db:restore` for cluster moves.

---

## Restore a backup

1. Point `.env.local` at the **target** cluster (the one you want to copy *to*).

2. Restore using the **full folder name** from the export:

```bash
npm run db:restore -- ccf_2026-06-11_22-30-45 --force
```

The `--` after `db:restore` is **required** so npm forwards `--force` to the script (without it, npm treats `--force` as its own flag).

`--force` is required when the target database already has data. Restore **deletes all documents** in the app collections, then re-imports from the backup.

3. Verify locally:

```bash
npm run dev
```

Open `http://localhost:3000/api/health/db` — should return `"ok": true`.

4. Update **Vercel** environment variables (`MONGODB_URI`, `MONGODB_DB`) and redeploy.

---

## Move between Atlas tiers (M10 → Flex / Free)

Atlas does **not** let you downgrade M10 to Flex or Free on the same cluster. Create a **new** cluster and migrate data.

### Checklist

1. **Export from old cluster** (M10)
   ```bash
   npm run db:export ccf
   ```

2. **Create new cluster** in Atlas (Flex or Free)

3. **Network Access** on the new cluster
   - `0.0.0.0/0` for Vercel
   - Your current IP for local dev

4. **Database Access** — create or reuse a DB user

5. **Update `.env.local`** with the new connection string

6. **Restore**
   ```bash
   npm run db:restore -- ccf_2026-06-11_22-30-45 --force
   ```

7. **Test** the app locally

8. **Update Vercel** `MONGODB_URI` and redeploy

9. **Delete the old cluster** in Atlas to stop billing

---

## What gets exported

All main application collections:

- `users`
- `players`
- `picklegames`
- `queueentries`
- `courts`
- `matchhistories`
- `leaderboardstats`
- `volunteers`
- `organizernotifications`
- `organizerblockedplayers`

`manifest.json` records export time, database name, and document counts.

---

## Safety notes

- **Backups are sensitive.** Do not commit `migrations/` to git or share exports publicly.
- **Restore replaces data.** Always export before restoring if you might need to roll back.
- **Empty target without `--force`:** If the database already has documents, restore fails until you pass `--force`.
- **Partial folder names:** You can pass a short prefix if it matches exactly one folder (e.g. `ccf_2026-06-11`). If multiple match, use the full folder name.

---

## Troubleshooting

### `Please set MONGODB_URI`

Add `MONGODB_URI` to `.env.local` and ensure it points at the correct cluster.

### Connection / SSL errors

In Atlas → **Network Access**, allow your IP and `0.0.0.0/0` for cloud deploys. Confirm the cluster is **Active**, not paused.

### `Migration folder not found`

List available backups:

```bash
npm run db:restore
```

Use the exact folder name printed during export.

### `Target database is not empty`

Add `--force` to replace existing data:

```bash
npm run db:restore -- ccf_2026-06-11_22-30-45 --force
```

### `PickleGame validation failed: ownerId is required`

Usually means a legacy game in the backup has no `ownerId`. Restore now skips invalid records and continues. Re-run restore with `--force`; check the "Skipped invalid records" list in the output.

### Restore works locally but not on Vercel

Update Vercel environment variables and trigger a new deployment after changing `MONGODB_URI`.

---

## Related app settings

For production on Atlas Free / Flex, the app uses serverless-friendly DB pooling (`maxPoolSize: 1` in `lib/db.ts`) and lighter spectator polling to stay under connection limits during events.

See `lib/db-migration.ts` for the implementation.
