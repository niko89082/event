// scripts/backupDatabase.js - MongoDB backup script for Phase 1 migration
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
console.log(process.env.MONGODB_URI)
class DatabaseBackup {
  constructor() {
    this.backupDir = path.join(__dirname, '..', 'backups');
    this.mongoUri = process.env.MONGODB_URI || 'mongodb+srv://niko8908:Nikolas29@social.olbmsfm.mongodb.net/?retryWrites=true&w=majority&appName=social';
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  }

  /**
   * Ensure backup directory exists
   */
  ensureBackupDir() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
      console.log('📁 Created backup directory');
    }
  }

  /**
   * Extract database name from MongoDB URI
   */
  getDatabaseName() {
    try {
      // Handle different MongoDB URI formats
      const url = new URL(this.mongoUri);
      const dbName = url.pathname.slice(1); // Remove leading '/'
      return dbName || 'social-app';
    } catch (error) {
      console.log('Using default database name: social-app');
      return 'social-app';
    }
  }

  /**
   * Create full database backup using mongodump
   */
  async createFullBackup() {
    return new Promise((resolve, reject) => {
      this.ensureBackupDir();
      
      const dbName = this.getDatabaseName();
      const backupPath = path.join(this.backupDir, `full-backup-${this.timestamp}`);
      
      console.log('🔄 Creating full database backup...');
      console.log(`📊 Database: ${dbName}`);
      console.log(`📁 Backup path: ${backupPath}`);
      
      const command = `mongodump --uri="${this.mongoUri}" --out="${backupPath}"`;
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error('❌ Backup failed:', error.message);
          reject(error);
          return;
        }
        
        if (stderr) {
          console.log('⚠️ Backup warnings:', stderr);
        }
        
        console.log('✅ Full backup completed successfully');
        console.log(`📁 Backup location: ${backupPath}`);
        
        resolve({
          success: true,
          backupPath,
          timestamp: this.timestamp,
          dbName
        });
      });
    });
  }

  /**
   * Create collection-specific backup (for critical collections only)
   */
  async createCollectionBackup(collections = ['photos', 'events', 'users']) {
    return new Promise((resolve, reject) => {
      this.ensureBackupDir();
      
      const dbName = this.getDatabaseName();
      const backupPath = path.join(this.backupDir, `collections-backup-${this.timestamp}`);
      
      console.log('🔄 Creating collection-specific backup...');
      console.log(`📊 Collections: ${collections.join(', ')}`);
      
      // Create backup directory
      if (!fs.existsSync(backupPath)) {
        fs.mkdirSync(backupPath, { recursive: true });
      }
      
      let completedCollections = 0;
      const results = [];
      
      collections.forEach(collection => {
        const collectionBackupPath = path.join(backupPath, collection);
        const command = `mongodump --uri="${this.mongoUri}" --collection="${collection}" --out="${collectionBackupPath}"`;
        
        exec(command, (error, stdout, stderr) => {
          completedCollections++;
          
          if (error) {
            console.error(`❌ Failed to backup ${collection}:`, error.message);
            results.push({ collection, success: false, error: error.message });
          } else {
            console.log(`✅ Backed up ${collection} collection`);
            results.push({ collection, success: true });
          }
          
          // Check if all collections are done
          if (completedCollections === collections.length) {
            const allSuccessful = results.every(r => r.success);
            
            if (allSuccessful) {
              console.log('✅ Collection backup completed successfully');
              resolve({
                success: true,
                backupPath,
                timestamp: this.timestamp,
                collections: results
              });
            } else {
              console.error('❌ Some collections failed to backup');
              reject(new Error('Collection backup partially failed'));
            }
          }
        });
      });
    });
  }

  /**
   * Export specific data as JSON (human-readable format)
   */
  async exportAsJSON() {
    const mongoose = require('mongoose');
    const Photo = require('../models/Photo');
    const Event = require('../models/Event');
    const User = require('../models/User');
    
    try {
      // Connect to database
      await mongoose.connect(this.mongoUri);
      console.log('🔗 Connected to database for JSON export');
      
      this.ensureBackupDir();
      const exportDir = path.join(this.backupDir, `json-export-${this.timestamp}`);
      
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }
      
      console.log('🔄 Exporting data as JSON...');
      
      // Export Photos (last 1000 for manageable size)
      const photos = await Photo.find().sort({ createdAt: -1 }).limit(1000).lean();
      fs.writeFileSync(
        path.join(exportDir, 'photos.json'), 
        JSON.stringify(photos, null, 2)
      );
      console.log(`✅ Exported ${photos.length} photos`);
      
      // Export Events (last 500)
      const events = await Event.find().sort({ createdAt: -1 }).limit(500).lean();
      fs.writeFileSync(
        path.join(exportDir, 'events.json'), 
        JSON.stringify(events, null, 2)
      );
      console.log(`✅ Exported ${events.length} events`);
      
      // Export Users (last 1000)
      const users = await User.find().sort({ createdAt: -1 }).limit(1000).select('-password').lean();
      fs.writeFileSync(
        path.join(exportDir, 'users.json'), 
        JSON.stringify(users, null, 2)
      );
      console.log(`✅ Exported ${users.length} users`);
      
      // Export metadata
      const metadata = {
        exportDate: new Date().toISOString(),
        exportType: 'json',
        collections: {
          photos: photos.length,
          events: events.length,
          users: users.length
        },
        mongoUri: this.mongoUri.replace(/:[^:@]*@/, ':***@'), // Hide password
        note: 'Pre-Phase-1-migration backup'
      };
      
      fs.writeFileSync(
        path.join(exportDir, 'metadata.json'), 
        JSON.stringify(metadata, null, 2)
      );
      
      console.log('✅ JSON export completed successfully');
      console.log(`📁 Export location: ${exportDir}`);
      
      return {
        success: true,
        exportPath: exportDir,
        timestamp: this.timestamp,
        metadata
      };
      
    } catch (error) {
      console.error('❌ JSON export failed:', error);
      throw error;
    } finally {
      await mongoose.disconnect();
    }
  }

  /**
   * Quick backup (optimized for speed)
   */
  async quickBackup() {
    console.log('⚡ Running quick backup (critical collections only)...');
    
    try {
      const result = await this.createCollectionBackup(['photos', 'events', 'users']);
      
      // Also create a small JSON export for easy inspection
      const jsonResult = await this.exportAsJSON();
      
      return {
        success: true,
        binary: result,
        json: jsonResult,
        message: 'Quick backup completed - both binary and JSON formats created'
      };
      
    } catch (error) {
      console.error('❌ Quick backup failed:', error);
      throw error;
    }
  }

  /**
   * Get backup recommendations based on database size
   */
  async getBackupRecommendations() {
    const mongoose = require('mongoose');
    
    try {
      await mongoose.connect(this.mongoUri);
      
      const stats = await mongoose.connection.db.stats();
      const sizeMB = Math.round(stats.dataSize / (1024 * 1024));
      
      console.log(`📊 Database size: ${sizeMB} MB`);
      
      let recommendation;
      if (sizeMB < 100) {
        recommendation = 'full';
        console.log('💡 Recommendation: Full backup (database is small)');
      } else if (sizeMB < 1000) {
        recommendation = 'collections';
        console.log('💡 Recommendation: Collection backup (moderate size)');
      } else {
        recommendation = 'quick';
        console.log('💡 Recommendation: Quick backup (large database)');
      }
      
      return {
        sizeMB,
        recommendation,
        estimatedBackupTime: this.estimateBackupTime(sizeMB)
      };
      
    } catch (error) {
      console.error('❌ Failed to get recommendations:', error);
      return { recommendation: 'quick', sizeMB: 0 };
    } finally {
      await mongoose.disconnect();
    }
  }

  /**
   * Estimate backup time based on database size
   */
  estimateBackupTime(sizeMB) {
    if (sizeMB < 50) return '< 1 minute';
    if (sizeMB < 200) return '1-3 minutes';
    if (sizeMB < 1000) return '3-10 minutes';
    return '10+ minutes';
  }

  /**
   * List existing backups
   */
  listBackups() {
    this.ensureBackupDir();
    
    try {
      const backups = fs.readdirSync(this.backupDir)
        .filter(name => fs.statSync(path.join(this.backupDir, name)).isDirectory())
        .map(name => {
          const backupPath = path.join(this.backupDir, name);
          const stats = fs.statSync(backupPath);
          
          return {
            name,
            path: backupPath,
            created: stats.birthtime,
            size: this.getDirectorySize(backupPath),
            type: name.includes('full') ? 'full' : 
                  name.includes('collections') ? 'collections' : 
                  name.includes('json') ? 'json' : 'unknown'
          };
        })
        .sort((a, b) => b.created - a.created);
      
      return backups;
    } catch (error) {
      console.error('❌ Failed to list backups:', error);
      return [];
    }
  }

  /**
   * Get directory size recursively
   */
  getDirectorySize(dirPath) {
    let totalSize = 0;
    
    try {
      const files = fs.readdirSync(dirPath);
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isDirectory()) {
          totalSize += this.getDirectorySize(filePath);
        } else {
          totalSize += stats.size;
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dirPath}:`, error);
    }
    
    return Math.round(totalSize / (1024 * 1024)); // Return size in MB
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'quick';
  
  const backup = new DatabaseBackup();
  
  try {
    console.log('🛡️ MongoDB Backup Tool');
    console.log('📅 Timestamp:', backup.timestamp);
    
    switch (command) {
      case 'full':
        await backup.createFullBackup();
        break;
        
      case 'collections':
        await backup.createCollectionBackup();
        break;
        
      case 'json':
        await backup.exportAsJSON();
        break;
        
      case 'quick':
        await backup.quickBackup();
        break;
        
      case 'list':
        const backups = backup.listBackups();
        console.log(`\n📋 Found ${backups.length} existing backups:`);
        backups.forEach(b => {
          console.log(`   📁 ${b.name} (${b.size}MB, ${b.type}) - ${b.created.toLocaleDateString()}`);
        });
        break;
        
      case 'recommend':
        const rec = await backup.getBackupRecommendations();
        console.log(`\n💡 Recommended backup type: ${rec.recommendation}`);
        console.log(`⏱️ Estimated time: ${rec.estimatedBackupTime}`);
        break;
        
      default:
        console.log('\nAvailable commands:');
        console.log('  quick       - Quick backup (recommended)');
        console.log('  full        - Full database backup');
        console.log('  collections - Backup specific collections');
        console.log('  json        - Export as JSON');
        console.log('  list        - List existing backups');
        console.log('  recommend   - Get backup recommendations');
        break;
    }
    
  } catch (error) {
    console.error('❌ Backup failed:', error);
    process.exit(1);
  }
}

// Export for programmatic use
module.exports = { DatabaseBackup };

// Run CLI if called directly
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✅ Backup operation completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Backup operation failed:', error);
      process.exit(1);
    });
}