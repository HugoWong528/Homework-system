# 帙雲 (ZhiYun) — Homework Management System

> A Hong Kong school homework management platform built on **Google Apps Script** + **Google Drive** + **Microsoft Power Automate**.

---

## 📖 Introduction

**帙雲** (ZhiYun) is a homework management system for Hong Kong secondary schools. It automates the entire homework lifecycle — from collection and sorting, to tracking submissions and chasing overdue work — so teachers can focus on teaching.

### ✨ Features

1. **學生自助上傳課業** — Student portal: students upload homework directly in the browser without renaming files, and can see their own submission status in real time.
2. **一鍵發還批改課業** — One-click return of marked homework to students' personal Google Drive folders.
3. **實時繳交狀態追蹤** — Real-time colour-coded tracking of each student's submission status (已繳交 ✅ / 未繳交 🔴 / 遲交 🟡).
4. **自動歸類文件夾** — Auto-categorise files by class → category → assignment, and by student → category → assignment.
5. **自動追收逾期功課** — Auto-chase overdue homework via Microsoft Teams using Power Automate.
6. **動態課業類別** — Teachers can add/remove homework categories through the admin panel; no code changes needed.
7. **存取控制（Google 登入驗證）** — Teacher panel is protected by a teacher whitelist; student portal requires a school-domain Google account or pre-approved email.
8. **支援所有檔案格式** — Accepts PDF, Office documents (Word/Excel/PowerPoint), images, plain text, code files, and any other format.

---

## 🏗️ Architecture

```
Google Drive (Root Folder)
├── 01_學生上傳區          ← Students upload homework here (via Drive link or student portal)
├── 02_待批改課業          ← Auto-sorted by class/category/assignment
│   └── 1C/
│       ├── 閱讀/
│       └── 寫作（長文）/
│           └── 藏在泥土的【寶物】/
├── 03_老師回饋區          ← Teacher places marked work here
└── 04_已發還課業          ← Auto-sorted by class/student/category
    └── 【1C】/
        └── 【陳大文】/
            ├── 閱讀/
            └── 寫作（長文）/

Google Sheets (inside root folder)
├── 自動共用、收集位址     ← Student ID → personal folder URL
├── 繳交紀錄及課業佈置     ← Submission records per class (multi-sheet)
└── OverdueAssignments     ← Overdue list for Power Automate

Google Apps Script Project (single project, all files at root)
├── Shared.gs              ← Shared constants & utilities
├── Setup.gs               ← Run ONCE to create all folders & sheets
├── CollectHomework.gs     ← Sorts uploaded files (1-min trigger)
├── AutoReturn.gs          ← Returns marked files (15-min trigger)
├── AutoShare.gs           ← Shares student folders & collects URLs
├── SubmissionRecord.gs    ← Creates folders & tracks submission (5-min trigger)
├── WebInterface.gs        ← Teacher panel Web App backend (with auth)
├── StudentPortal.gs       ← Student portal backend (for separate deployment)
├── ErrorLogger.gs         ← System log to spreadsheet
├── Index.html             ← Teacher control panel
├── record.html            ← Submission records viewer
├── homework.html          ← Homework assignment form
├── setup.html             ← Class, student & access control management
└── student.html           ← Student homework upload portal
(OverdueAssignments.gs is deployed in a second project bound to the OverdueAssignments sheet)
```

> ⚠️ **Google Apps Script does not support subfolders.** All `.gs` and `.html` files must be at the root level of the Apps Script project.

---

## ✅ Prerequisites

| Requirement | Details |
|---|---|
| Google Account | With Google Drive and Google Sheets access |
| Google Apps Script | [script.google.com](https://script.google.com) |
| Microsoft Account | With Power Automate (Flow) access |
| School domains | Google email: e.g. `ccckyc.edu.hk` / Teams email: e.g. `ms.ccckyc.edu.hk` |

---

## 🚀 Quick Start

### Step 1 — Create the Root Folder

1. Open [Google Drive](https://drive.google.com).
2. Create a new folder (e.g. `帙雲`).
3. Open the folder and copy its **ID** from the URL:
   ```
   https://drive.google.com/drive/folders/<<THIS_IS_THE_FOLDER_ID>>
   ```

### Step 2 — Create the Apps Script Project

1. Go to [script.google.com](https://script.google.com) and create a new **standalone** project named `帙雲`.
2. Add all `.gs` and `.html` files from this repository (using the **+** button).
3. In `Shared.gs`, replace `YOUR_ROOT_FOLDER_ID_HERE` with your root folder ID and update `SCHOOL_EMAIL_DOMAIN`.

### Step 3 — Run Initial Setup

Run `setup()` once to create all Drive folders and spreadsheets, or use the **系統設定** tab in the web panel after deploying.

### Step 4 — Deploy the Web App

1. Click **Deploy** → **New deployment** → **Web app**.
2. Set **Execute as**: Me.
3. Set **Who has access**: **Anyone with a Google Account** (required for email-based authentication).
4. Click **Deploy** and copy the URL.

> ⚠️ **Access control**: After deploying, open `?page=setup` → **存取控制** tab and add your email to the **教師白名單** (teacher whitelist). Once any teacher is added, the whitelist is enforced.

---

## 🔐 Access Control

### Teacher Panel (WebInterface.gs)

- Requires a Google Account (login enforced by "Anyone with a Google Account" deployment setting).
- Uses a **teacher whitelist** stored in Script Properties (`TEACHER_WHITELIST`).
- While the whitelist is **empty**, all logged-in users can access (for initial setup). Add your email immediately after setup.
- Manage the whitelist via `?page=setup` → **存取控制** tab.

### Student Portal (student.html / StudentPortal.gs)

- Students must be logged into a Google Account.
- Access is granted if the email:
  - Has a domain listed in **允許的學生域名** (e.g. `ccckyc.edu.hk`), **or**
  - Is individually listed in **特殊電郵** (for non-school accounts).
- Manage student auth settings via `?page=setup` → **存取控制** tab.

### Separate Student Portal Deployment (Recommended)

For maximum security isolation, deploy the student portal as a **separate GAS project**:

1. Create a new GAS project named `帙雲_學生入口`.
2. Add: `StudentPortal.gs`, `Shared.gs`, `ErrorLogger.gs`, and `student.html`.
3. Copy the same Script Properties from the teacher panel project.
4. Deploy as Web App: **Execute as: Me** / **Anyone with a Google Account**.
5. Share the student portal URL with students, keep the teacher panel URL private.

---

## 📂 File Upload

### Via Student Portal (Recommended)

Students open `?page=student`, log in with their school Google account, select their class and name, and upload any file directly. The system automatically renames it to `班別_姓名_關鍵詞.副檔名`.

**Accepted formats**: All file types — PDF, Word, Excel, PowerPoint, images (JPEG/PNG/GIF/BMP/WEBP), plain text, code files, ZIP, and more.

### Via Google Drive (Direct)

Students can also upload directly to `01_學生上傳區` using the Drive link. Name the file:
```
班別_姓名_關鍵詞.副檔名
```
Example: `1C_陳大文_寶物.pdf`

---

## �� Web Interface Pages

| URL parameter | Page | Auth required |
|---|---|---|
| (none) | `Index.html` — Control panel | Teacher whitelist |
| `?page=record` | `record.html` — Submission records | Teacher whitelist |
| `?page=homework` | `homework.html` — Assign homework | Teacher whitelist |
| `?page=setup` | `setup.html` — Class, student & access control management | Teacher whitelist |
| `?page=student` | `student.html` — Student homework upload portal | School email (student auth) |

---

## 📊 Spreadsheet Setup

### 繳交紀錄及課業佈置

Managed automatically via the web panel. Each sheet tab = one class.

| Cell | Content |
|---|---|
| A1 | Class name (e.g. `1C`) |
| A2 | `created` after folders are built (auto-filled) |
| B1, C1 … | Homework name — set via `homework.html` |
| B2, C2 … | Deadline |
| B3, C3 … | Folder ID — auto-filled, do not edit |
| A4 onwards | Student names |
| B4 onwards | Submission status — auto-updated |

---

## 🗂️ Repository Structure

```
/
├── Shared.gs              ← Shared constants & utilities
├── Setup.gs               ← One-time setup
├── CollectHomework.gs     ← Collect & sort homework (1-min trigger, all file types)
├── AutoReturn.gs          ← Auto-return marked homework (15-min trigger)
├── AutoShare.gs           ← Share student folders & collect URLs
├── SubmissionRecord.gs    ← Submission tracking & folder creation (5-min trigger)
├── WebInterface.gs        ← Teacher panel backend (auth + all API functions)
├── StudentPortal.gs       ← Student portal backend (for separate deployment)
├── ErrorLogger.gs         ← System log
├── OverdueAssignments.gs  ← Overdue list for Power Automate (separate project)
├── Index.html             ← Teacher control panel
├── record.html            ← Submission records viewer
├── homework.html          ← Homework assignment form
├── setup.html             ← Class, student & access control management
├── student.html           ← Student homework upload portal
├── GUIDE.md               ← Detailed usage guide (Chinese)
└── README.md              ← This file
```

---

## 🔧 Troubleshooting

| Problem | Solution |
|---|---|
| "存取被拒絕" on teacher pages | Add your email to the teacher whitelist via `?page=setup` → 存取控制 |
| "存取被拒絕" on student portal | Ensure student domain is in allowed list via `?page=setup` → 存取控制 |
| Empty email returned | Ensure Web App is deployed as "Anyone with a Google Account" (not anonymous) |
| Files not sorting | The upload area accepts all formats; check the filename includes a valid class code |
| Submission status not updating | Ensure `SubmissionRecord.gs` trigger is running; check folder IDs in row 3 |
| Marked work not distributed | `AutoReturn.gs` now searches all category folders (not limited to one category) |
| Web App not updating after code change | Re-deploy with a new version in Manage Deployments |
