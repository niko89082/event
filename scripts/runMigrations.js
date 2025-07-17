// scripts/runMigrations.js - Migration runner for Phase 1 updates
const mongoose = require('mongoose');
const { migratePhotoEventFields } = require('./migrations/001_consolidate_photo_event_fields');
const { standardizeLikesArrays } = require('./migrations/002_standardize_likes_arrays');

// Migration tracking schema
const MigrationSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  version: { type: String, required: true },
  executedAt: { type: Date, default: Date.now },
  success: { type: Boolean, required: true },
  duration: { type: Number }, // milliseconds
  details: { type: Object },
  rollbackAvailable: { type: Boolean, default: false }
});

const Migration = mongoose.model('Migration', MigrationSchema);

// Migration definitions
const MIGRATIONS = [
  {
    name: '001_consolidate_photo_event_fields',
    version: '1.0.0',
    description: 'Consolidate event/taggedEvent fields in Photo model',
    execute: migratePhotoEventFields,
    rollback: null // TODO: Implement rollback functions
  },
  {
    name: '002_standardize_likes_arrays',
    version: '1.0.0',
    description: 'Standardize likes arrays across all models',
    execute: standardizeLikesArrays,
    rollback: null
  }
];

class MigrationRunner {
  constructor() {
    this.executed = [];
    this.failed = [];
  }

  /**
   * Connect to database
   */
  async connect() {
    if (mongoose.connection.readyState === 0) {
      const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/social-app';
      await mongoose.connect(uri);
      console.log('✅ Connected to MongoDB for migrations');
    }
  }

  /**
   * Get executed migrations from database
   */
  async getExecutedMigrations() {
    try {
      const executed = await Migration.find({ success: true }).select('name version');
      return executed.map(m => `${m.name}@${m.version}`);
    } catch (error) {
      console.log('📋 No migration history found (first run)');
      return [];
    }
  }

  /**
   * Check if migration has been executed
   */
  async hasBeenExecuted(migration) {
    const executed = await this.getExecutedMigrations();
    return executed.includes(`${migration.name}@${migration.version}`);
  }

  /**
   * Execute a single migration
   */
  async executeMigration(migration) {
    const startTime = Date.now();
    console.log(`\n🔄 Executing migration: ${migration.name} v${migration.version}`);
    console.log(`📝 Description: ${migration.description}`);

    try {
      // Check if already executed
      if (await this.hasBeenExecuted(migration)) {
        console.log(`⏭️  Migration ${migration.name} already executed, skipping...`);
        return { success: true, skipped: true };
      }

      // Create migration record (pending)
      const migrationRecord = new Migration({
        name: migration.name,
        version: migration.version,
        success: false,
        details: { status: 'executing' }
      });
      await migrationRecord.save();

      // Execute migration
      const result = await migration.execute();
      const duration = Date.now() - startTime;

      // Update migration record (success)
      migrationRecord.success = true;
      migrationRecord.duration = duration;
      migrationRecord.details = { 
        status: 'completed',
        result,
        executedAt: new Date()
      };
      migrationRecord.rollbackAvailable = !!migration.rollback;
      await migrationRecord.save();

      console.log(`✅ Migration ${migration.name} completed successfully in ${duration}ms`);
      this.executed.push(migration.name);
      
      return { success: true, duration, result };

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ Migration ${migration.name} failed after ${duration}ms:`, error);

      // Update migration record (failure)
      try {
        await Migration.findOneAndUpdate(
          { name: migration.name, version: migration.version },
          {
            success: false,
            duration,
            details: {
              status: 'failed',
              error: error.message,
              stack: error.stack,
              failedAt: new Date()
            }
          }
        );
      } catch (updateError) {
        console.error('Failed to update migration record:', updateError);
      }

      this.failed.push({ name: migration.name, error: error.message });
      throw error;
    }
  }

  /**
   * Run all pending migrations
   */
  async runAll(options = {}) {
    const { dryRun = false, force = false } = options;

    try {
      await this.connect();

      console.log('🚀 Starting Phase 1 Migration Runner');
      console.log(`📊 Total migrations to check: ${MIGRATIONS.length}`);
      
      if (dryRun) {
        console.log('🔍 DRY RUN MODE - No changes will be made');
      }

      // Create database backup recommendation
      console.log('\n⚠️  IMPORTANT: It is recommended to backup your database before running migrations!');
      
      if (!force && !dryRun) {
        console.log('💡 Run with --force flag to proceed without this warning');
        console.log('💡 Run with --dry-run flag to see what would be executed');
        return;
      }

      let pendingMigrations = [];
      
      // Check which migrations need to be executed
      for (const migration of MIGRATIONS) {
        if (force || !(await this.hasBeenExecuted(migration))) {
          pendingMigrations.push(migration);
        }
      }

      console.log(`\n📋 Pending migrations: ${pendingMigrations.length}`);
      
      if (pendingMigrations.length === 0) {
        console.log('✅ All migrations are up to date!');
        return { success: true, executed: 0, failed: 0 };
      }

      // List pending migrations
      pendingMigrations.forEach((migration, index) => {
        console.log(`   ${index + 1}. ${migration.name} v${migration.version} - ${migration.description}`);
      });

      if (dryRun) {
        console.log('\n🔍 DRY RUN completed - no migrations executed');
        return { success: true, executed: 0, failed: 0, dryRun: true };
      }

      console.log('\n🔄 Executing migrations...');

      // Execute migrations in order
      for (const migration of pendingMigrations) {
        try {
          const result = await this.executeMigration(migration);
          if (result.skipped) continue;
        } catch (error) {
          console.error(`💥 Migration failed: ${migration.name}`);
          console.error('🛑 Stopping migration execution due to failure');
          break;
        }
      }

      // Summary
      console.log('\n📊 Migration Summary:');
      console.log(`   ✅ Successfully executed: ${this.executed.length}`);
      console.log(`   ❌ Failed: ${this.failed.length}`);
      
      if (this.executed.length > 0) {
        console.log('\n🎉 Executed migrations:');
        this.executed.forEach(name => console.log(`   - ${name}`));
      }

      if (this.failed.length > 0) {
        console.log('\n💥 Failed migrations:');
        this.failed.forEach(failure => {
          console.log(`   - ${failure.name}: ${failure.error}`);
        });
      }

      const success = this.failed.length === 0;
      return {
        success,
        executed: this.executed.length,
        failed: this.failed.length,
        details: {
          executed: this.executed,
          failed: this.failed
        }
      };

    } catch (error) {
      console.error('💥 Migration runner failed:', error);
      throw error;
    } finally {
      // Keep connection open for now
      console.log('\n✅ Migration runner completed');
    }
  }

  /**
   * Rollback a specific migration
   */
  async rollback(migrationName, version) {
    try {
      await this.connect();

      const migration = MIGRATIONS.find(m => 
        m.name === migrationName && m.version === version
      );

      if (!migration) {
        throw new Error(`Migration ${migrationName}@${version} not found`);
      }

      if (!migration.rollback) {
        throw new Error(`Migration ${migrationName} does not support rollback`);
      }

      console.log(`🔄 Rolling back migration: ${migrationName} v${version}`);

      const result = await migration.rollback();

      // Update migration record
      await Migration.findOneAndUpdate(
        { name: migrationName, version },
        {
          success: false,
          details: {
            status: 'rolled_back',
            rolledBackAt: new Date(),
            rollbackResult: result
          }
        }
      );

      console.log(`✅ Migration ${migrationName} rolled back successfully`);
      return { success: true, result };

    } catch (error) {
      console.error(`❌ Rollback failed for ${migrationName}:`, error);
      throw error;
    }
  }

  /**
   * Get migration status
   */
  async getStatus() {
    try {
      await this.connect();

      const executed = await Migration.find().sort({ executedAt: -1 });
      const pending = MIGRATIONS.filter(m => 
        !executed.some(e => e.name === m.name && e.version === m.version && e.success)
      );

      return {
        total: MIGRATIONS.length,
        executed: executed.filter(m => m.success).length,
        failed: executed.filter(m => !m.success).length,
        pending: pending.length,
        details: {
          executed: executed.filter(m => m.success),
          failed: executed.filter(m => !m.success),
          pending: pending
        }
      };

    } catch (error) {
      console.error('Failed to get migration status:', error);
      throw error;
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'run';
  const runner = new MigrationRunner();

  try {
    switch (command) {
      case 'run':
        const dryRun = args.includes('--dry-run');
        const force = args.includes('--force');
        await runner.runAll({ dryRun, force });
        break;

      case 'status':
        const status = await runner.getStatus();
        console.log('📊 Migration Status:');
        console.log(`   Total: ${status.total}`);
        console.log(`   Executed: ${status.executed}`);
        console.log(`   Failed: ${status.failed}`);
        console.log(`   Pending: ${status.pending}`);
        break;

      case 'rollback':
        const migrationName = args[1];
        const version = args[2] || '1.0.0';
        if (!migrationName) {
          console.error('Usage: npm run migrate rollback <migration-name> [version]');
          process.exit(1);
        }
        await runner.rollback(migrationName, version);
        break;

      default:
        console.log('Available commands:');
        console.log('  run [--dry-run] [--force]  - Run pending migrations');
        console.log('  status                     - Show migration status');
        console.log('  rollback <name> [version]  - Rollback a migration');
        break;
    }

  } catch (error) {
    console.error('Migration command failed:', error);
    process.exit(1);
  }
}

// Export for programmatic use
module.exports = { MigrationRunner };

// Run CLI if called directly
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✅ Migration command completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Migration command failed:', error);
      process.exit(1);
    });
}