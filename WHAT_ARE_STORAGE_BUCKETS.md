# What Are Storage Buckets? (Simple Explanation)

## The Simple Answer

**Storage buckets are cloud folders for storing files.**

Just like you have folders on your computer to organize files, storage buckets are folders in the cloud (on Supabase's servers) where you can store files like:
- PDFs
- Word documents
- Images
- Videos

## Real-World Analogy

Think of storage buckets like:
- **Dropbox folders** - You upload files, others can download them
- **Google Drive folders** - Organized storage with permissions
- **Email attachments** - Files stored separately from your database

## Why Do We Need Them?

In our app, we need to store:
1. **Class materials** - PDFs, slides, worksheets that teachers upload
2. **Homework submissions** - Files that students submit

We can't store these files directly in the database (too big, not efficient). Instead:
- Database stores: "Here's a link to the file"
- Storage bucket stores: The actual file

## Our Two Buckets

### 1. session-materials
**What it stores:** Class materials uploaded by teachers
- Lecture notes (PDF)
- Presentation slides (PowerPoint)
- Worksheets (Word docs)
- Video recordings

**Example:**
```
Teacher uploads "Algebra Lesson 1.pdf"
  ↓
File saved to: session-materials/class-123/session-456/Algebra-Lesson-1.pdf
  ↓
Database saves: "File URL: https://...../Algebra-Lesson-1.pdf"
  ↓
Students click download → File retrieved from bucket
```

### 2. homework-submissions
**What it stores:** Homework files submitted by students
- Student homework PDFs
- Scanned worksheets
- Text files

**Example:**
```
Student submits "My Homework.pdf"
  ↓
File saved to: homework-submissions/assignment-789/student-abc/v1_My-Homework.pdf
  ↓
Database saves: "Submission URL: https://...../v1_My-Homework.pdf"
  ↓
Teacher views submissions → File retrieved from bucket
```

## How It Works

### Upload Flow
```
1. User selects file in browser
2. JavaScript sends file to Supabase Storage
3. Supabase saves file in bucket
4. Supabase returns file URL
5. App saves URL in database
```

### Download Flow
```
1. User clicks "Download"
2. App gets file URL from database
3. Browser downloads file from Supabase Storage
4. File opens/saves on user's computer
```

## Security

Buckets have **access policies** (like permissions):
- **Teachers** can upload materials to their classes
- **Students** can download materials from their classes
- **Students** can upload their own homework
- **Teachers** can view all homework for their classes
- **Nobody** can access files from classes they're not in

This is controlled by RLS (Row Level Security) policies.

## Why "Buckets"?

The term comes from AWS S3 (Amazon's storage service), which calls them "buckets". Other services use different names:
- AWS: Buckets
- Google Cloud: Buckets
- Azure: Containers
- Supabase: Buckets

They all mean the same thing: **a container for storing files in the cloud**.

## Database vs Storage

**Database (PostgreSQL):**
- Stores: Text, numbers, dates, relationships
- Good for: User info, class schedules, grades
- Example: "Class name: Algebra 1, Teacher: John Smith"

**Storage (Buckets):**
- Stores: Files (binary data)
- Good for: PDFs, images, videos
- Example: "Algebra-Lesson-1.pdf" (5MB file)

**Together:**
```
Database record:
{
  id: "material-123",
  title: "Algebra Lesson 1",
  file_url: "https://storage.supabase.co/.../Algebra-Lesson-1.pdf"
}

Storage bucket:
session-materials/
  class-123/
    session-456/
      Algebra-Lesson-1.pdf  ← The actual file
```

## Creating Buckets

Buckets can't be created with SQL (database commands). They must be created through:

1. **Supabase Dashboard** (web interface) - Click buttons to create
2. **Supabase API** (programmatic) - Send HTTP requests
3. **Supabase CLI** (command line) - Run terminal commands

We provide two options:
- **Automated script** - Run `node supabase/create-storage-buckets.js`
- **Manual creation** - Follow guide in `MANUAL_BUCKET_CREATION.md`

## File Size Limits

We set a 50MB limit per file because:
- Most PDFs are 1-10MB
- Most images are < 5MB
- Videos should be linked (YouTube, Vimeo) not uploaded
- Prevents abuse (someone uploading huge files)

50MB = 52,428,800 bytes (that's what you see in settings)

## Public vs Private

**Public buckets:**
- Anyone with the URL can access files
- Good for: Profile pictures, public images
- Example: `class-covers` bucket (class cover images)

**Private buckets:**
- Need permission to access files
- Good for: Student homework, class materials
- Example: `session-materials`, `homework-submissions`

Our buckets are **private** for security.

## Cost

Supabase storage pricing (as of 2024):
- Free tier: 1GB storage, 2GB bandwidth
- Pro tier: 100GB storage, 200GB bandwidth
- Additional: $0.021/GB storage, $0.09/GB bandwidth

For a typical class:
- 100 students × 10 assignments × 2MB per file = 2GB
- Well within free/pro tier limits

## Summary

**What:** Cloud folders for storing files
**Why:** Can't store large files in database
**How:** Upload via API, download via URL
**Security:** Access controlled by RLS policies
**Cost:** Free tier covers most use cases

**In our app:**
- Teachers upload class materials → `session-materials` bucket
- Students submit homework → `homework-submissions` bucket
- Database stores file URLs
- RLS policies control who can access what

That's it! Storage buckets are just organized cloud storage with security. 📦
