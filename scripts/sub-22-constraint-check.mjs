#!/usr/bin/env node
/**
 * SUB-22 Step 2: Database Constraint Check
 * 
 * Inspects PostgreSQL database constraints on the Subscription table,
 * specifically looking for:
 * 1. UNIQUE constraints on stripeSubscriptionId
 * 2. Other relevant constraints
 * 3. Indexes that might enforce uniqueness
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDatabaseConstraints() {
  console.log('='.repeat(80));
  console.log('SUB-22 STEP 2: DATABASE CONSTRAINT CHECK');
  console.log('='.repeat(80));
  console.log();

  try {
    // 1. Check for constraints on Subscription table
    console.log('1. SUBSCRIPTION TABLE CONSTRAINTS');
    console.log('-'.repeat(80));

    const constraints = await prisma.$queryRaw`
      SELECT 
        con.conname AS constraint_name,
        con.contype AS constraint_type,
        CASE con.contype
          WHEN 'p' THEN 'PRIMARY KEY'
          WHEN 'u' THEN 'UNIQUE'
          WHEN 'f' THEN 'FOREIGN KEY'
          WHEN 'c' THEN 'CHECK'
          ELSE con.contype::text
        END AS constraint_type_name,
        pg_get_constraintdef(con.oid) AS constraint_definition,
        a.attname AS column_name
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      LEFT JOIN pg_attribute a ON a.attnum = ANY(con.conkey) AND a.attrelid = con.conrelid
      WHERE rel.relname = 'Subscription'
        AND nsp.nspname = 'public'
      ORDER BY con.contype, con.conname;
    `;

    if (constraints.length === 0) {
      console.log('⚠️  No constraints found on Subscription table');
    } else {
      console.log(`Found ${constraints.length} constraint(s):\n`);
      
      const grouped = constraints.reduce((acc, row) => {
        if (!acc[row.constraint_name]) {
          acc[row.constraint_name] = {
            type: row.constraint_type_name,
            definition: row.constraint_definition,
            columns: []
          };
        }
        if (row.column_name) {
          acc[row.constraint_name].columns.push(row.column_name);
        }
        return acc;
      }, {});

      Object.entries(grouped).forEach(([name, info]) => {
        console.log(`  ${name}:`);
        console.log(`    Type: ${info.type}`);
        console.log(`    Definition: ${info.definition}`);
        if (info.columns.length > 0) {
          console.log(`    Column(s): ${info.columns.join(', ')}`);
        }
        console.log();
      });
    }

    console.log();

    // 2. Check for indexes on Subscription table
    console.log('2. SUBSCRIPTION TABLE INDEXES');
    console.log('-'.repeat(80));

    const indexes = await prisma.$queryRaw`
      SELECT 
        i.relname AS index_name,
        a.attname AS column_name,
        ix.indisunique AS is_unique,
        ix.indisprimary AS is_primary,
        am.amname AS index_type,
        pg_get_indexdef(ix.indexrelid) AS index_definition
      FROM pg_index ix
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_am am ON am.oid = i.relam
      LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
      WHERE t.relname = 'Subscription'
        AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      ORDER BY i.relname, a.attnum;
    `;

    if (indexes.length === 0) {
      console.log('⚠️  No indexes found on Subscription table');
    } else {
      console.log(`Found ${indexes.length} index entry/entries:\n`);
      
      const groupedIndexes = indexes.reduce((acc, row) => {
        if (!acc[row.index_name]) {
          acc[row.index_name] = {
            columns: [],
            unique: row.is_unique,
            primary: row.is_primary,
            type: row.index_type,
            definition: row.index_definition
          };
        }
        if (row.column_name) {
          acc[row.index_name].columns.push(row.column_name);
        }
        return acc;
      }, {});

      Object.entries(groupedIndexes).forEach(([name, info]) => {
        console.log(`  ${name}:`);
        console.log(`    Unique: ${info.unique ? 'YES ✓' : 'NO'}`);
        console.log(`    Primary: ${info.primary ? 'YES' : 'NO'}`);
        console.log(`    Type: ${info.type}`);
        console.log(`    Column(s): ${info.columns.join(', ')}`);
        console.log(`    Definition: ${info.definition}`);
        console.log();
      });
    }

    console.log();

    // 3. Specifically check for stripeSubscriptionId uniqueness
    console.log('3. stripeSubscriptionId UNIQUENESS CHECK');
    console.log('-'.repeat(80));

    const stripeIdConstraints = constraints.filter(c => 
      (c.constraint_type === 'u' || c.constraint_type_name === 'UNIQUE') &&
      c.column_name === 'stripeSubscriptionId'
    );

    const stripeIdIndexes = indexes.filter(i =>
      i.is_unique && i.column_name === 'stripeSubscriptionId'
    );

    if (stripeIdConstraints.length === 0 && stripeIdIndexes.length === 0) {
      console.log('❌ NO UNIQUE CONSTRAINT OR INDEX on stripeSubscriptionId');
      console.log('   ⚠️  This means duplicate Stripe subscription IDs are NOT prevented at the database level');
    } else {
      if (stripeIdConstraints.length > 0) {
        console.log('✅ UNIQUE CONSTRAINT found on stripeSubscriptionId:');
        stripeIdConstraints.forEach(c => {
          console.log(`   ${c.constraint_name}: ${c.constraint_definition}`);
        });
      }
      if (stripeIdIndexes.length > 0) {
        console.log('✅ UNIQUE INDEX found on stripeSubscriptionId:');
        stripeIdIndexes.forEach(i => {
          console.log(`   ${i.index_name}: ${i.index_definition}`);
        });
      }
    }

    console.log();
    console.log();

    // 4. Check Provider table for stripeCustomerId uniqueness
    console.log('4. PROVIDER stripeCustomerId UNIQUENESS CHECK');
    console.log('-'.repeat(80));

    const providerConstraints = await prisma.$queryRaw`
      SELECT 
        con.conname AS constraint_name,
        con.contype AS constraint_type,
        CASE con.contype
          WHEN 'u' THEN 'UNIQUE'
          ELSE con.contype::text
        END AS constraint_type_name,
        pg_get_constraintdef(con.oid) AS constraint_definition,
        a.attname AS column_name
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      LEFT JOIN pg_attribute a ON a.attnum = ANY(con.conkey) AND a.attrelid = con.conrelid
      WHERE rel.relname = 'Provider'
        AND nsp.nspname = 'public'
        AND con.contype = 'u'
        AND a.attname = 'stripeCustomerId';
    `;

    if (providerConstraints.length === 0) {
      console.log('⚠️  No UNIQUE constraint found on Provider.stripeCustomerId');
    } else {
      console.log('✅ UNIQUE constraint found on Provider.stripeCustomerId:');
      providerConstraints.forEach(c => {
        console.log(`   ${c.constraint_name}: ${c.constraint_definition}`);
      });
    }

    console.log();
    console.log('='.repeat(80));
    console.log('CONSTRAINT CHECK COMPLETE');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('Error during constraint check:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
checkDatabaseConstraints()
  .then(() => {
    console.log('\n✅ Check completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Check failed:', error.message);
    process.exit(1);
  });
