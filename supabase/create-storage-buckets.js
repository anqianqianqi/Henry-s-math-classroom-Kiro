/**
 * Create Storage Buckets for Class Occurrences System
 * 
 * This script creates the required storage buckets using Supabase API
 * Run with: node supabase/create-storage-buckets.js
 * 
 * Prerequisites:
 * - SUPABASE_URL in .env.local
 * - SUPABASE_SERVICE_ROLE_KEY in .env.local (service role key, not anon key!)
 */

const fs = require('fs');
const path = require('path');

// Load environment variables
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env.local file not found!');
    console.error('Please create .env.local with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      env[key.trim()] = valueParts.join('=').trim();
    }
  });

  return env;
}

async function createBucket(supabaseUrl, serviceRoleKey, bucketConfig) {
  const url = `${supabaseUrl}/storage/v1/bucket`;
  
  console.log(`\n📦 Creating bucket: ${bucketConfig.name}`);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      'apikey': serviceRoleKey
    },
    body: JSON.stringify(bucketConfig)
  });

  if (response.ok) {
    const data = await response.json();
    console.log(`✅ Bucket "${bucketConfig.name}" created successfully!`);
    return { success: true, data };
  } else if (response.status === 409) {
    console.log(`ℹ️  Bucket "${bucketConfig.name}" already exists`);
    return { success: true, exists: true };
  } else {
    const error = await response.text();
    console.error(`❌ Failed to create bucket "${bucketConfig.name}":`, error);
    return { success: false, error };
  }
}

async function main() {
  console.log('🚀 Creating Storage Buckets for Class Occurrences System\n');

  // Load environment variables
  const env = loadEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing required environment variables:');
    console.error('   - NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL');
    console.error('   - SUPABASE_SERVICE_ROLE_KEY');
    console.error('\nMake sure these are set in .env.local');
    process.exit(1);
  }

  console.log(`📍 Supabase URL: ${supabaseUrl}`);
  console.log(`🔑 Service Role Key: ${serviceRoleKey.substring(0, 20)}...`);

  // Define bucket configurations
  const buckets = [
    {
      name: 'session-materials',
      id: 'session-materials',
      public: false,
      file_size_limit: 52428800, // 50MB
      allowed_mime_types: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'image/*',
        'video/*'
      ]
    },
    {
      name: 'homework-submissions',
      id: 'homework-submissions',
      public: false,
      file_size_limit: 52428800, // 50MB
      allowed_mime_types: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/*',
        'text/plain'
      ]
    }
  ];

  // Create buckets
  const results = [];
  for (const bucket of buckets) {
    const result = await createBucket(supabaseUrl, serviceRoleKey, bucket);
    results.push({ bucket: bucket.name, ...result });
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`✅ Successful: ${successful}/${results.length}`);
  if (failed > 0) {
    console.log(`❌ Failed: ${failed}/${results.length}`);
  }

  console.log('\n📋 Next Steps:');
  console.log('1. Run the storage policies SQL:');
  console.log('   supabase/setup-storage-buckets.sql');
  console.log('2. Verify buckets in Supabase Dashboard → Storage');
  console.log('3. Test file upload with a teacher account\n');

  if (failed > 0) {
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('\n❌ Unexpected error:', error);
  process.exit(1);
});
