# 🚀 Quick Deployment Checklist

Use this checklist to ensure everything is configured correctly before deploying.

## ✅ Pre-Deployment Checks

### Code Side
- [x] Supabase client uses environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- [x] `.gitignore` excludes `.env` files
- [x] `.env.example` file created for team reference
- [x] Build command works: `npm run build` ✅

### Security
- [x] No hardcoded API keys in source code
- [x] Environment variables properly configured
- [ ] Test that `.env` file is not tracked by git: `git ls-files | grep .env`

## 📋 Deployment Steps

### Step 1: GitHub Setup
```bash
# Initialize git (if not done)
git init
git add .
git commit -m "Prepare for deployment"

# Add remote and push
git remote add origin https://github.com/your-username/your-repo.git
git branch -M main
git push -u origin main
```

### Step 2: Vercel Configuration
1. [ ] Import repository from GitHub
2. [ ] Framework: Auto-detect should select "Vite"
3. [ ] Add Environment Variables:
   - [ ] `VITE_SUPABASE_URL` = `https://frdyixpjtunzllewusfp.supabase.co`
   - [ ] `VITE_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - [ ] Select all environments (Production, Preview, Development)
4. [ ] Deploy

### Step 3: Supabase Configuration
1. [ ] Go to **Authentication** → **URL Configuration**
2. [ ] Set **Site URL**: `https://your-project.vercel.app`
3. [ ] Add **Redirect URLs**:
   - [ ] `https://your-project.vercel.app/**`
   - [ ] `http://localhost:8080/**` (for local dev)
4. [ ] Go to **Settings** → **API** → **CORS**
5. [ ] Add domain: `https://your-project.vercel.app`

### Step 4: Post-Deployment
- [ ] Test authentication (sign up/login)
- [ ] Test project creation
- [ ] Test all major features
- [ ] Check browser console for errors
- [ ] Verify HTTPS is working
- [ ] Check Vercel logs for any issues
- [ ] Check Supabase logs for security alerts

## 🔐 Security Verification

Run these checks after deployment:

```bash
# 1. Verify .env is not committed
git ls-files | grep .env
# Should return nothing

# 2. Check Supabase RLS is enabled (in Supabase SQL Editor)
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

## 📝 Environment Variables Reference

**For Vercel:**
```
VITE_SUPABASE_URL=https://frdyixpjtunzllewusfp.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyZHlpeHBqdHVuemxsZXd1c2ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1MzcyODAsImV4cCI6MjA3NDExMzI4MH0.RAObK79xc4yetIgnyHVmbJjtKofjk921CfTeYIJbQZ8
```

**For Local Development (.env file):**
```
VITE_SUPABASE_URL=https://frdyixpjtunzllewusfp.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyZHlpeHBqdHVuemxsZXd1c2ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1MzcyODAsImV4cCI6MjA3NDExMzI4MH0.RAObK79xc4yetIgnyHVmbJjtKofjk921CfTeYIJbQZ8
```

## 🆘 Common Issues

| Issue | Solution |
|-------|----------|
| Build fails with "Missing env vars" | Add variables in Vercel before deploying |
| Auth redirect errors | Update Supabase URL Configuration |
| CORS errors | Add domain to Supabase CORS settings |
| RLS blocking requests | Check Supabase Advisors → Security |

## 📚 Full Guide

See `DEPLOYMENT_GUIDE.md` for detailed step-by-step instructions.

---

**Ready to deploy?** Follow the steps above and you'll be live in minutes! 🎉
