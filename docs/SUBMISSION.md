# Submission status

This file distinguishes completed deliverables from external account steps. **The challenge has not been submitted.**

## Application

**Public application:** https://q7m4p2x9.vercel.app/  
**Health endpoint:** https://q7m4p2x9.vercel.app/api/health  
**API documentation:** https://q7m4p2x9.vercel.app/docs

The app is deployed on Vercel with a React frontend and a Python FastAPI backend. The production deployment is publicly accessible. Anonymous HTTP checks returned 200 for the app, health endpoint, daily analysis and monthly analysis. A fresh cloud-browser tab opened the application without a Vercel login and displayed **Python API** as its data mode.

This verification is accurately described as **anonymous access testing**, not as a literal incognito-window test. The evaluator's requested final incognito checks should still be performed on all three final submission URLs.

## Source repository

The complete source is provided in `WindProcure-Source.zip`. Its root folder is `q7m4p2x9`, suitable for the challenge's anonymous repository-name requirement. It includes the real data snapshot, README, Docker configuration, tests and review documentation.

**Public GitHub URL: pending.** The GitHub connection can publish repository content, but does not expose a repository-creation action. The browser creation route required an additional sign-in and was blocked. No public repository URL is invented or claimed.

When an authorized public repository is available, publish this exact source and record its verified URL here. If publishing locally from the extracted source with an authenticated GitHub CLI:

```sh
git init -b main
git add .
git commit -m "Build auditable January wind procurement pilot"
gh repo create q7m4p2x9 --public --source=. --remote=origin --push
```

Review the commands before running them. An existing repository of that name should be reused only if it was intentionally created for this submission.

## Video

**Prepared file:** `WindProcure-Demo.mp4`  
**Captions:** `WindProcure-Demo.srt`  
**Transcript:** `docs/DEMO_SCRIPT.md`  
**Chapters and measured duration:** `docs/VIDEO_CHAPTERS.md`

Measured duration: **7 minutes 46 seconds**. Part 1: **3 minutes 26 seconds**. Part 2: **4 minutes 20 seconds**.

The MP4 includes the requested customer pilot presentation and internal technical review, with each part under five minutes and the total under ten. It uses real application views, code/architecture explanations and a generic synthesized narrator. It does not impersonate the candidate. Review the narration and replace it with your own recording if preferred.

**Unlisted YouTube URL: pending.** An authenticated YouTube upload capability was not available. Upload the prepared video as **Unlisted**, add the chapter list and captions if desired, and test its URL anonymously. A local MP4 alone does not fulfill the assignment's mandatory YouTube-link requirement.

Suggested title: **January wind procurement pilot — product demo and technical review**.

## Submission form

**Form URL: not supplied.** The brief names “Full Stack SWE challenge submission v4 – Fill out form,” but contains no actual link. No form was guessed, opened or submitted.

Before submission, verify:

- [x] React frontend and Python backend are implemented.
- [x] Real Elexon FUELHH/WIND and WINDFOR are used.
- [x] January decision scope includes February 1 delivery.
- [x] Forecast selection avoids later publications.
- [x] Coverage, metrics and limitations are explicit.
- [x] Docker and Vercel configuration are supplied.
- [x] The public Vercel app and Python API work anonymously.
- [x] 15 backend tests and the frontend production build passed.
- [x] README discloses AI assistance.
- [x] A two-part narrated MP4, captions and transcript are prepared.
- [ ] Docker build and CI smoke test have actually run on a Docker-capable host.
- [ ] Public GitHub repository is created and its URL verified.
- [ ] Video is uploaded to YouTube as Unlisted and its URL verified.
- [ ] Every final URL is tested in a private/incognito window.
- [ ] Actual form URL is supplied and submission is completed.
