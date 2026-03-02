# TODO Checklist

## 🚀 Getting Started (Do These First)

### Setup Supabase
- [x] Create dev Supabase project (`henry-math-dev`) - ✅ DONE
- [x] Run schema.sql - ✅ DONE
- [x] Run seed.sql - ✅ DONE
- [ ] Create storage buckets (`class-materials`, `avatars`) - **NEXT**
- [ ] Get API keys - **NEXT**
- [ ] Configure `.env.local` - **NEXT**

### Configure Environment
- [ ] Copy `.env.example` to `.env.local`
- [ ] Paste Supabase URL into `.env.local`
- [ ] Paste anon key into `.env.local`
- [ ] Paste service role key into `.env.local`
- [ ] Save `.env.local`

### Install and Run
- [ ] Ensure Node.js 18+ is installed (`node --version`)
- [ ] Run `npm install`
- [ ] Run `npm run dev`
- [ ] Open http://localhost:3000
- [ ] Test sign up flow
- [ ] Test login flow
- [ ] Verify dashboard loads

### Assign Teacher Role
- [ ] Go to Supabase SQL Editor
- [ ] Run: `SELECT id, email FROM auth.users;`
- [ ] Copy your user ID
- [ ] Run the INSERT query from QUICKSTART.md (replace YOUR_USER_ID)
- [ ] Verify role assigned in `user_roles` table

---

## 📝 Phase 1 Completion (Optional)

### Git Setup
- [ ] Run `git init`
- [ ] Run `git add .`
- [ ] Run `git commit -m "Initial commit: Phase 1 foundation"`
- [ ] Create GitHub repository
- [ ] Add remote: `git remote add origin <your-repo-url>`
- [ ] Push: `git push -u origin main`
- [ ] Create `dev` branch: `git checkout -b dev`
- [ ] Push dev: `git push -u origin dev`

### Deployment (Optional)
- [ ] Create Vercel account
- [ ] Import GitHub repository
- [ ] Create dev app (production branch: `dev`)
- [ ] Add environment variables to dev app
- [ ] Create prod app (production branch: `main`)
- [ ] Add environment variables to prod app
- [ ] Test deployments

---

## 🏗️ Phase 2: Class Management (Next Development)

### Class CRUD
- [ ] Create `/app/classes/page.tsx` (list classes)
- [ ] Create `/app/classes/new/page.tsx` (create class)
- [ ] Create `/app/classes/[id]/page.tsx` (view class)
- [ ] Create `/app/classes/[id]/edit/page.tsx` (edit class)
- [ ] Add delete functionality
- [ ] Test with teacher role

### Class Members
- [ ] Create member list component
- [ ] Add student enrollment form
- [ ] Implement invite link generation
- [ ] Add remove member functionality
- [ ] Test RLS policies

### Class Introduction
- [ ] Create public class page
- [ ] Display class schedule
- [ ] Show teacher information
- [ ] Add enrollment button

---

## 🎯 Phase 3: Daily Challenge (Priority Feature)

### Challenge Creation (Teacher)
- [x] Create `/app/challenges/page.tsx` (list challenges)
- [x] Create `/app/challenges/new/page.tsx` (create challenge)
- [x] Add challenge assignment to classes
- [x] Implement edit/delete

### Challenge Management (Teacher)
- [x] Edit existing challenges (`/challenges/[id]/edit`)
- [x] Delete challenges with confirmation
- [ ] Enhanced challenge list with stats preview
- [ ] Filter challenges by class/date
- [ ] Search challenges by title
- [ ] Duplicate challenge feature

### Challenge View (Student)
- [ ] Create student challenge view
- [ ] Show today's challenge
- [ ] Display challenge details
- [ ] Add submission form

### Submission System
- [ ] Implement submission creation
- [ ] Add edit submission (before viewing others)
- [ ] Show "Post to see others" message
- [ ] Implement "post to unlock" logic
- [ ] Display submission feed after posting

### Discussion View
- [ ] Create submission list component
- [ ] Show all student submissions
- [ ] Display user avatars and names
- [ ] Add timestamps
- [ ] Teacher can see all immediately

---

## 📚 Phase 4: Materials & Polish

### Material Upload
- [ ] Create `/app/materials/page.tsx`
- [ ] Implement file upload to Supabase Storage
- [ ] Add material type selection
- [ ] Create material list view
- [ ] Add download functionality
- [ ] Implement delete (teacher only)

### Notifications
- [ ] Set up email service (SendGrid/Resend)
- [ ] Implement class start alerts
- [ ] Add new challenge notifications
- [ ] Create in-app notification system

### UI/UX Polish
- [ ] Add loading skeletons
- [ ] Improve error messages
- [ ] Add empty states
- [ ] Test responsive design
- [ ] Accessibility audit
- [ ] Add animations/transitions

### Testing
- [ ] Write unit tests for permission logic
- [ ] Test RLS policies with different roles
- [ ] End-to-end tests for critical flows
- [ ] Cross-browser testing
- [ ] Performance optimization

---

## 🔮 Future Enhancements (Post-MVP)

### Payment Integration
- [ ] Research payment providers (Stripe)
- [ ] Design pricing model
- [ ] Implement subscription system
- [ ] Add payment pages

### Course Marketplace
- [ ] Design course structure
- [ ] Create course creation flow
- [ ] Implement course discovery
- [ ] Add course enrollment

### AI Features
- [ ] Research AI grading options
- [ ] Implement automated feedback
- [ ] Add AI-powered hints
- [ ] Create personalized recommendations

### Advanced Features
- [ ] Real-time collaboration
- [ ] Video conferencing integration
- [ ] Advanced analytics
- [ ] Mobile app

---

## 📊 Progress Tracking

### Phase 1: Foundation
- [x] Database schema - 100%
- [x] Base UI components - 100%
- [x] Authentication - 100%
- [x] Supabase project & schema - 100%
- [ ] Storage buckets - 0%
- [ ] Environment config - 0%
- [ ] Local testing - 0%
- [ ] Git setup - 0%
- [ ] Deployment - 0%
- **Overall: 75%**

### Phase 2: Core Features
- [ ] Class management - 0%
- [ ] Student enrollment - 0%
- [ ] Materials - 0%
- **Overall: 0%**

### Phase 3: Daily Challenge
- [x] Challenge creation - 100%
- [x] Submission system - 100%
- [x] Discussion view - 100%
- [x] Edit challenge - 100%
- [x] Delete challenge - 100%
- [ ] Enhanced list view - 0%
- **Overall: 83%**

### Phase 4: Polish
- [ ] Notifications - 0%
- [ ] UI/UX - 0%
- [ ] Testing - 0%
- **Overall: 0%**

---

## 🆘 If You Get Stuck

### Resources
- [QUICKSTART.md](QUICKSTART.md) - Fast setup guide
- [SETUP.md](SETUP.md) - Detailed setup
- [.kiro/](/.kiro) - All documentation
- [supabase/README.md](supabase/README.md) - Database help

### Common Issues
- **Can't connect to Supabase**: Check `.env.local` values
- **Sign up fails**: Verify schema.sql ran successfully
- **Permission denied**: Check RLS policies and role assignments
- **Build errors**: Run `rm -rf .next && npm run dev`

### Get Help
- Check browser console for errors
- Review Supabase dashboard logs
- Verify environment variables
- Test with different user roles

---

## ✅ Quick Wins

Want to see progress fast? Do these:

1. **Get it running** (15 min)
   - Follow QUICKSTART.md
   - See authentication working

2. **Create first class** (30 min)
   - Build class creation page
   - Test with your teacher account

3. **Add first challenge** (1 hour)
   - Build challenge creation
   - Test submission flow

4. **Deploy to Vercel** (30 min)
   - Push to GitHub
   - Connect to Vercel
   - Share with others

---

**Remember**: Start with the "Getting Started" section. Everything else can wait!
