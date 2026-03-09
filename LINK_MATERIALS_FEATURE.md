# Link Materials Feature - Added March 9, 2026

## What's New
You can now add external links as materials without uploading files!

## How to Use

### Adding a Link Material
1. Login as teacher/admin
2. Navigate to any class → click on a session
3. Click "Upload Material"
4. Select "Link (External URL)" from the Material Type dropdown
5. Enter:
   - Title (e.g., "Khan Academy - Algebra Tutorial")
   - URL (e.g., https://www.khanacademy.org/math/algebra)
   - Description (optional)
6. Click "Add Link"

### Viewing Link Materials
- Link materials show a 🔗 icon
- Display shows "link" badge instead of file size
- Button says "🔗 Open Link" instead of "📥 Download"
- Clicking opens the link in a new tab

## Material Types

### Link (External URL)
- No file upload required
- Just provide a URL
- Perfect for:
  - Online resources
  - YouTube videos
  - Google Docs
  - External websites
  - Online textbooks

### Document (File Upload)
- Upload PDF, DOC, PPT files
- Stored in Supabase storage
- Students download the file

### Note (File Upload)
- Upload text files or notes
- Similar to documents

### Recording (File Upload)
- Upload video/audio files
- For recorded lectures

## Technical Details

### Files Modified
- ✅ `components/MaterialUpload.tsx` - Added link URL input and conditional rendering
- ✅ `components/SessionDetail.tsx` - Updated display and download handling for links

### How It Works
1. When material type is "link", form shows URL input instead of file upload
2. Link materials are saved directly to database with:
   - `file_url`: The external URL
   - `file_type`: 'text/uri-list'
   - `file_size`: 0
   - `material_type`: 'link'
3. No storage bucket upload needed
4. Display shows link icon (🔗) and "Open Link" button
5. Clicking opens URL in new tab with security flags

### Database Schema
No changes needed - existing `session_materials` table supports this:
```sql
CREATE TABLE session_materials (
  id UUID PRIMARY KEY,
  occurrence_id UUID REFERENCES class_occurrences(id),
  uploaded_by UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,        -- Can be storage URL or external URL
  file_type TEXT NOT NULL,       -- 'text/uri-list' for links
  file_size BIGINT NOT NULL,     -- 0 for links
  material_type TEXT NOT NULL,   -- 'link', 'document', 'note', 'recording'
  is_available BOOLEAN DEFAULT true,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Testing

### Test Case 1: Add Link Material
1. Login as admin@test.com / 123456
2. Go to Algebra 1 class
3. Click any upcoming session
4. Click "Upload Material"
5. Select "Link (External URL)"
6. Enter:
   - Title: "Khan Academy Algebra"
   - URL: https://www.khanacademy.org/math/algebra
   - Description: "Great resource for extra practice"
7. Click "Add Link"
8. Verify link appears with 🔗 icon

### Test Case 2: Open Link Material
1. Find the link material you just added
2. Click "🔗 Open Link" button
3. Verify it opens in a new tab
4. Verify the correct URL loads

### Test Case 3: Mix of Materials
1. Add a link material
2. Add a file material (upload a PDF)
3. Verify both display correctly:
   - Link shows 🔗 icon and "Open Link" button
   - File shows 📄 icon and "Download" button

## Benefits
- ✅ No storage space used for external resources
- ✅ Easy to share online content
- ✅ Students can access materials without downloading
- ✅ Perfect for YouTube videos, Google Docs, etc.
- ✅ Faster than uploading large files

## Next Steps
Consider adding:
- URL validation (check if URL is accessible)
- Link preview/thumbnail
- Automatic title extraction from URL
- Link categories (video, article, interactive, etc.)
