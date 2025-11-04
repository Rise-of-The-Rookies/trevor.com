# 🚀 Complete Deployment Guide - Vercel + GitHub + Supabase

This guide will walk you through deploying your project to Vercel with proper security configuration.

## 📋 Prerequisites

- GitHub account
- Vercel account (free tier works)
- Supabase project already set up
- Git installed locally

---

## 🔒 Step 1: Code-Side Security Configuration

### 1.1 Update Environment Variables Setup

✅ **Already Done**: The Supabase client now uses environment variables (`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`)

### 1.2 Create Local .env File (For Development)

Create a `.env` file in your project root:

```bash
# .env (DO NOT commit this file)
VITE_SUPABASE_URL=https://frdyixpjtunzllewusfp.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyZHlpeHBqdHVuemxsZXd1c2ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1MzcyODAsImV4cCI6MjA3NDExMzI4MH0.RAObK79xc4yetIgnyHVmbJjtKofjk921CfTeYIJbQZ8
```

**⚠️ Important**: 
- The `.env` file is already in `.gitignore`, so it won't be committed
- Use `.env.example` as a template (without actual values) for team members

### 1.3 Verify Build Configuration

The project is already configured for Vite. Verify your build works:

```bash
npm run build
```

If successful, you'll see a `dist` folder created.

---

## 🔐 Step 2: Supabase-Side Security Configuration

### 2.1 Get Your Supabase Credentials

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Settings** → **API**
4. Copy the following values:
   - **Project URL**: `https://frdyixpjtunzllewusfp.supabase.co`
   - **anon/public key**: The `anon` `public` key (starts with `eyJ...`)

### 2.2 Configure Supabase Security Settings

#### A. Enable Row Level Security (RLS)

✅ **Already Configured**: Your migrations have RLS policies set up. Verify in Supabase:

1. Go to **Database** → **Tables**
2. Check that RLS is enabled on sensitive tables:
   - `users`
   - `organizations`
   - `projects`
   - `tasks`
   - `notifications`
   - `organization_members`

#### B. Configure Authentication Settings

1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL** to your production URL (e.g., `https://your-app.vercel.app`)
3. Add **Redirect URLs**:
   - `https://your-app.vercel.app/**`
   - `http://localhost:8080/**` (for local development)

#### C. Configure CORS (if needed)

1. Go to **Settings** → **API**
2. Under **CORS**, add your production domain:
   - `https://your-app.vercel.app`

#### D. Verify API Security

1. Go to **Settings** → **API**
2. Ensure **Enable API** is ON
3. Verify **Enable API Key** is ON (for anon key)
4. **Disable** or restrict **Service Role Key** access (never use in client-side code)

### 2.3 Check Database Security Advisors

1. Go to **Advisors** in Supabase Dashboard
2. Review **Security** advisors:
   - ✅ Check for missing RLS policies
   - ✅ Verify no sensitive data exposure
   - ✅ Check for proper indexing

Run this in your SQL Editor to check RLS status:

```sql
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

All sensitive tables should have `rls_enabled = true`.

---

## 📦 Step 3: GitHub-Side Configuration

### 3.1 Initialize Git Repository (if not already done)

```bash
# Navigate to project directory
cd "c:\Users\bryan\Desktop\APU\WPH hackathon\trevor.com"

# Initialize git (if not already initialized)
git init

# Check current status
git status
```

### 3.2 Create .gitignore (if needed)

✅ **Already Done**: `.gitignore` is configured to exclude `.env` files

Verify it contains:
```
.env
.env.local
.env.*.local
```

### 3.3 Commit and Push to GitHub

```bash
# Stage all files
git add .

# Commit changes
git commit -m "Prepare for deployment: add environment variables and security config"

# Add GitHub remote (replace with your repository URL)
git remote add origin https://github.com/your-username/your-repo-name.git

# Push to GitHub
git branch -M main
git push -u origin main
```

**Alternative**: If using GitHub CLI:
```bash
gh repo create your-repo-name --public --source=. --push
```

### 3.4 Verify .env is NOT Committed

```bash
# Check that .env is not tracked
git ls-files | grep .env

# Should return nothing (empty output)
```

---

## 🚀 Step 4: Vercel Deployment

### 4.1 Connect GitHub Repository to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **Add New Project**
3. Import your GitHub repository
4. Select the repository and click **Import**

### 4.2 Configure Project Settings

**Framework Preset**: Vite (should auto-detect)
**Root Directory**: `./` (default)
**Build Command**: `npm run build` (default)
**Output Directory**: `dist` (default)
**Install Command**: `npm install` (default)

### 4.3 Add Environment Variables

**⚠️ CRITICAL**: Add these before deploying!

In Vercel project settings → **Environment Variables**, add:

```
VITE_SUPABASE_URL = https://frdyixpjtunzllewusfp.supabase.co
VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyZHlpeHBqdHVuemxsZXd1c2ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1MzcyODAsImV4cCI6MjA3NDExMzI4MH0.RAObK79xc4yetIgnyHVmbJjtKofjk921CfTeYIJbQZ8
```

**Important**:
- ✅ Select **Production**, **Preview**, and **Development** environments
- ✅ Click **Save** after adding each variable

### 4.4 Deploy

1. Click **Deploy** button
2. Wait for build to complete (usually 1-2 minutes)
3. Once deployed, you'll get a URL like: `https://your-project.vercel.app`

### 4.5 Update Supabase Authentication URLs

After deployment, update Supabase:

1. Go to **Authentication** → **URL Configuration**
2. Update **Site URL** to: `https://your-project.vercel.app`
3. Add **Redirect URLs**:
   - `https://your-project.vercel.app/**`

---

## ✅ Step 5: Post-Deployment Verification

### 5.1 Test Your Application

1. Visit your Vercel URL
2. Test authentication (sign up/login)
3. Verify all features work:
   - Project creation
   - Task management
   - Notifications
   - File uploads (if applicable)

### 5.2 Check Security

1. **Verify Environment Variables**:
   - Open browser DevTools → Console
   - Check that no sensitive keys are exposed in source code
   - Environment variables should be embedded during build, not visible in source

2. **Test RLS Policies**:
   - Try accessing data as different user roles
   - Verify users can only see their own data

3. **Check HTTPS**:
   - Vercel automatically provides HTTPS
   - Verify your site uses `https://` not `http://`

### 5.3 Monitor Logs

1. **Vercel Logs**:
   - Go to Vercel Dashboard → Your Project → **Deployments**
   - Click on a deployment → **Functions** tab
   - Check for any errors

2. **Supabase Logs**:
   - Go to Supabase Dashboard → **Logs**
   - Check **API Logs** for any unauthorized requests
   - Check **Auth Logs** for authentication issues

---

## 🔧 Step 6: Optional - Custom Domain

### 6.1 Add Custom Domain in Vercel

1. Go to Vercel Project → **Settings** → **Domains**
2. Add your domain (e.g., `trevor.com`)
3. Follow DNS configuration instructions
4. Update Supabase **Site URL** and **Redirect URLs** with your custom domain

---

## 🛠 Troubleshooting

### Issue: Build Fails with "Missing Environment Variables"

**Solution**:
1. Verify environment variables are set in Vercel
2. Ensure variable names start with `VITE_` for Vite projects
3. Redeploy after adding variables

### Issue: Authentication Not Working in Production

**Solution**:
1. Check Supabase **Authentication** → **URL Configuration**
2. Ensure production URL is added to **Redirect URLs**
3. Verify **Site URL** matches your Vercel domain

### Issue: CORS Errors

**Solution**:
1. Go to Supabase **Settings** → **API**
2. Add your Vercel domain to **CORS** settings
3. Restart your Supabase project if needed

### Issue: RLS Blocking Requests

**Solution**:
1. Check Supabase **Advisors** → **Security**
2. Verify RLS policies are correctly configured
3. Test policies in Supabase SQL Editor:
```sql
-- Test as a specific user
SET request.jwt.claim.sub = 'user-uuid-here';
SELECT * FROM your_table;
```

### Issue: Environment Variables Not Working

**Solution**:
1. In Vercel, check that variables are set for all environments
2. Rebuild and redeploy the project
3. Clear browser cache and hard refresh (Ctrl+Shift+R)

---

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/auth/row-level-security)

---

## 🔐 Security Checklist

Before going live, ensure:

- ✅ Environment variables are set in Vercel (not hardcoded)
- ✅ `.env` file is in `.gitignore`
- ✅ RLS is enabled on all sensitive tables
- ✅ Supabase authentication URLs are configured
- ✅ HTTPS is enabled (automatic with Vercel)
- ✅ No service role keys in client-side code
- ✅ CORS is properly configured
- ✅ All migrations are applied to production database

---

## 🎉 You're All Set!

Your application should now be live at `https://your-project.vercel.app`

**Next Steps**:
1. Share the URL with your team
2. Monitor logs for any issues
3. Set up error tracking (e.g., Sentry) if needed
4. Configure backups for your Supabase database

---

## 📝 Quick Reference

**Environment Variables Needed**:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Build Command**: `npm run build`
**Output Directory**: `dist`
**Node Version**: Check your `package.json` engines or use latest LTS

**Supabase Settings**:
- Authentication → URL Configuration → Site URL
- Settings → API → CORS

**Vercel Settings**:
- Project Settings → Environment Variables
- Settings → Domains (for custom domain)
