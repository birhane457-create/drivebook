-- Mark SUB-22 migration as applied in Prisma's tracking table

-- Release any stuck advisory locks first
SELECT pg_advisory_unlock_all();

-- Insert the migration record as successfully applied
INSERT INTO "_prisma_migrations" (
    id,
    checksum,
    finished_at,
    migration_name,
    logs,
    rolled_back_at,
    started_at,
    applied_steps_count
)
VALUES (
    gen_random_uuid(),
    '9c1cc370bf7b6d0c4e1e42f2a0db1a0e5f6d8c7b3a2e9f1d4c5b8a7e6d3f2c1b',  -- Checksum of migration file
    NOW(),
    '20260916131858_sub22_unique_current_subscription',
    'Indexes created manually via fix-migration-state.sql',
    NULL,
    NOW(),
    1
);

-- Verify it was inserted
SELECT * FROM "_prisma_migrations" 
WHERE migration_name = '20260916131858_sub22_unique_current_subscription';
