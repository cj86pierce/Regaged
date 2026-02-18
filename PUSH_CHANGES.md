# After code changes – repush and deploy

Run these from the **project root**. If your repo is only the app, use `c:\dev\regaged\tengaged-mvp`. If the repo is the whole folder, use `c:\dev\regaged`.

---

## First time only: no git yet

If you get `fatal: not a git repository`, init and make a first commit:

```powershell
cd c:\dev\regaged\tengaged-mvp
git init
git add -A
git commit -m "Initial commit"
```

To push to GitHub/GitLab later, create a new repo there (empty, no README), then:

```powershell
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

(Replace the URL with your real repo URL.)

---

## Every time you change something

### 1. Stage and commit

```powershell
cd c:\dev\regaged\tengaged-mvp
git add -A
git status
git commit -m "Your short description of the change"
```

### 2. Push

```powershell
git push
```

(If first push after adding remote: `git push -u origin main`.)

### 3. Deploy (Vercel)

- If Vercel is connected to this repo, `git push` usually triggers a deploy.
- Otherwise: `vercel` or `vercel --prod` from the repo, or deploy from the Vercel dashboard.

---

**One-liner:**

```powershell
cd c:\dev\regaged\tengaged-mvp
git add -A
git commit -m "Describe your change here"
git push
```
