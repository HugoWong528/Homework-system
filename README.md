# 帙雲 (ZhiYun) — Homework Management System

> A Hong Kong school homework management platform built on **Google Apps Script** + **Google Drive** + **Microsoft Power Automate**.

---

## 📖 Introduction

**帙雲** (ZhiYun) is a teacher-facing homework management system for Hong Kong secondary schools. It automates the entire homework lifecycle — from collection and sorting, to tracking submissions and chasing overdue work — so teachers can focus on teaching rather than administration.

### ✨ Features

1. **一鍵下載全班課業** — One-click access to download all homework submitted by the whole class.
2. **一鍵發還批改課業** — One-click return of marked homework to students' personal Google Drive folders.
3. **實時繳交狀態追蹤** — Real-time colour-coded tracking of each student's submission status (已繳交 ✅ / 未繳交 🔴 / 遲交 🟡).
4. **自動歸類文件夾** — Auto-categorise files by class → category → assignment, and by student → category → assignment.
5. **自動追收逾期功課** — Auto-chase overdue homework via Microsoft Teams (morning, noon, and evening reminders) using Power Automate.

---

## 🏗️ Architecture

```
Google Drive (Root Folder)
├── 01_學生上傳區          ← Students upload homework here
├── 02_待批改課業          ← Auto-sorted by class/category/assignment
│   └── 1C/
│       ├── 閱讀/
│       ├── 寫作（長文）/
│       │   └── 藏在泥土的【寶物】/
│       └── 寫作（實用文）/
├── 03_老師回饋區          ← Teacher places marked work here
└── 04_已發還課業          ← Auto-sorted by class/student/category/assignment
    └── 【1C】/
        └── 【陳大文】/
            ├── 閱讀/
            ├── 寫作（長文）/
            └── 寫作（實用文）/

Google Sheets (inside root folder)
├── 自動共用、收集位址     ← Student ID → personal folder URL
├── 繳交紀錄及課業佈置     ← Submission records per class (multi-sheet)
└── OverdueAssignments     ← Overdue list for Power Automate

Google Apps Script Project (single project, all files at root)
├── Setup.gs               ← Run ONCE to create all folders & sheets
├── CollectHomework.gs     ← Sorts uploaded files (1-min trigger)
├── AutoReturn.gs          ← Returns marked files (15-min trigger)
├── AutoShare.gs           ← Shares student folders & collects URLs (manual)
├── SubmissionRecord.gs    ← Creates folders & tracks submission (5-min trigger)
├── WebInterface.gs        ← Web App backend
├── Index.html             ← Control panel
├── record.html            ← Submission records viewer
└── homework.html          ← Homework assignment form
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

### Step 2 — Run the Setup Script

1. Go to [script.google.com](https://script.google.com) and create a new **standalone** project named `帙雲`.
2. In the project, create a new script file named `Setup` (`.gs` is added automatically).
3. Paste the contents of `Setup.gs` from this repository into it.
4. Replace `YOUR_ROOT_FOLDER_ID_HERE` with your root folder ID:
   ```javascript
   const ROOT_FOLDER_ID = 'your_actual_folder_id_here';
   ```
5. Click **Run** → `setup`.
6. Check **View → Logs**. All created folder IDs, spreadsheet IDs, and URLs will be printed — **keep this for reference**.

> ✅ After this step, four folders and three spreadsheets will have been automatically created inside your root folder.

### Step 3 — Add All Scripts to the Apps Script Project

In the **same** `帙雲` Apps Script project, add the following files. Use the **+** button (Add a file) to create each one. Google Apps Script does not support subfolders — all files must be at the project root.

**Server-side scripts (`.gs`):**

| File | Description | Trigger |
|---|---|---|
| `Setup.gs` | One-time setup | Run once manually |
| `CollectHomework.gs` | Collect & sort student homework | `createTrigger()` → every 1 min |
| `AutoReturn.gs` | Auto-return marked homework | `createTrigger()` → every 15 min |
| `AutoShare.gs` | Share student folders & collect URLs | No trigger (manual) |
| `SubmissionRecord.gs` | Submission tracking & folder creation | `createTrigger()` → every 5 min |
| `WebInterface.gs` | Web App backend | Web App deployment |

**HTML templates (`.html`):**

| File | Description |
|---|---|
| `Index.html` | Control panel |
| `record.html` | Submission records viewer |
| `homework.html` | Homework assignment form |

**For the OverdueAssignments script:**
1. Create a **second, separate** Apps Script project named `帙雲_OverdueAssignments`.
2. Add `OverdueAssignments.gs` (rename to `Code` in the editor).
3. Set `ROOT_FOLDER_ID` and `STUDENT_EMAIL_DOMAIN`.
4. Run `createTrigger()` to set up the 1-min trigger.

**For all scripts:**
1. Set `ROOT_FOLDER_ID` at the top of each `.gs` file.
2. For `CollectHomework`, `AutoReturn`, `SubmissionRecord`: run `createTrigger()` once.
3. For `AutoShare`: run `shareAllClasses()` manually when needed.
4. For `AutoShare`: also set `SCHOOL_EMAIL_DOMAIN` to your school's Google email domain.
5. For `OverdueAssignments`: also set `STUDENT_EMAIL_DOMAIN` to your school's Teams email domain.

### Step 4 — Deploy the Web Interface

1. In the `帙雲` Apps Script project, click **Deploy** → **New deployment**.
2. Select **Web app**.
3. Set **Execute as**: Me (your account).
4. Set **Who has access**: Anyone within your organization (or Anyone if needed).
5. Click **Deploy** and copy the **Web app URL**.

---

## 📊 Spreadsheet Setup

### 繳交紀錄及課業佈置

Each **sheet tab** = one class. Add tabs manually, one per class.

| Cell | Content |
|---|---|
| A1 | Class name (e.g. `1C`) |
| A2 | Leave blank initially — auto-filled with `created` after folders are built |
| B1, C1 … | Homework name in format: `「寫作（長文）」藏在泥土的【寶物】` |
| B2, C2 … | Deadline in format: `2025-04-29 23:59` |
| B3, C3 … | Folder ID — **auto-filled**, do not edit |
| A4 onwards | Student names (one per row) |
| B4 onwards | Submission status — **auto-updated**: 已繳交 / 未繳交 / 遲交 |

**Homework name format explained:**
- `「寫作（長文）」` — category in `「」` brackets (used to sort files into correct category subfolder)
- `【寶物】` — keyword in `【】` brackets (used to match uploaded filenames to the correct assignment folder)

### 自動共用、收集位址

| Column | Content |
|---|---|
| A | Student ID (學號) |
| B | Student name (姓名) |
| C | Personal folder URL — auto-filled by `03_AutoShare` |

After entering student IDs and names, run `shareAllClasses()` in `AutoShare.gs` to share folders and populate column C.

---

## 🌐 Web Interface Pages

| URL parameter | Page | Purpose |
|---|---|---|
| (none) | `Index.html` | Control panel with links to all folders and tools |
| `?page=record` | `record.html` | View colour-coded submission records by class |
| `?page=homework` | `homework.html` | Assign new homework (updates the spreadsheet) |

---

## ⚙️ Microsoft Power Automate Setup

Set up a **Scheduled cloud flow** to send Teams messages to overdue students:

1. **Recurrence** — Set your schedule (e.g. daily at 08:00, 12:00, 20:00).
2. **Get worksheet** — Connect to the `OverdueAssignments` Google Sheets file.
   > ⚠️ The spreadsheet **file** is named `OverdueAssignments` (no space); the **sheet tab** inside it is named `Overdue Assignments` (with a space).
3. **List rows present in a table** — Select the `Overdue Assignments` sheet tab. Read all rows.
4. **Apply to each** — Loop over each row.
5. **Post message in a chat or channel** — Send a Teams message to the student's email address from the `學生電郵` column, mentioning the homework name and deadline.

> **Tip:** In the Power Automate editor, type `/` to insert dynamic content from the spreadsheet columns.

---

## 📁 File / Folder Naming Conventions

| Format | Example | Meaning |
|---|---|---|
| Class code in filename | `1C 陳大文 寶物.pdf` | Used by scripts to identify class |
| `【keyword】` in filename | `1C 陳大文 【寶物】.pdf` | Used for assignment folder matching |
| `【ClassName】` folder | `【1C】` | Class folder inside 04_已發還課業 |
| `【StudentName】` folder | `【陳大文】` | Student folder inside class folder |
| `「Category」` in homework name | `「寫作（長文）」` | Category prefix in spreadsheet cell |

---

## 🔧 Troubleshooting

| Problem | Solution |
|---|---|
| `ROOT_FOLDER_ID` error on `setup()` | Ensure you replaced `YOUR_ROOT_FOLDER_ID_HERE` with your actual folder ID |
| Files not moving to `02_待批改課業` | Check the filename contains a valid class code (e.g. `1C`, `4A`) |
| Submission status not updating | Ensure `SubmissionRecord.gs` trigger is running; check folder IDs in row 3 of the sheet |
| Student folder not shared | Ensure student names in the spreadsheet exactly match the `【name】` folder names |
| Overdue list empty | Check that `OverdueAssignments.gs` trigger is running and `STUDENT_EMAIL_DOMAIN` is correct |
| Web App not loading | Re-deploy the Web App after code changes; check execution permissions |

---

## 🗂️ Repository Structure

> ⚠️ Google Apps Script **does not support subfolders**. All files must be at the root of the Apps Script project. This repository mirrors that flat structure exactly.

```
/
├── Setup.gs               ← One-time setup (creates Drive folders + Sheets)
├── CollectHomework.gs     ← Collect & sort student homework (1-min trigger)
├── AutoReturn.gs          ← Auto-return marked homework (15-min trigger)
├── AutoShare.gs           ← Share student folders & collect URLs (manual)
├── SubmissionRecord.gs    ← Submission tracking & folder creation (5-min trigger)
├── WebInterface.gs        ← Web App backend (doGet, data helpers)
├── OverdueAssignments.gs  ← Generate overdue list for Power Automate (1-min trigger)
├── Index.html             ← Control panel (Web App page)
├── record.html            ← Submission records viewer (Web App page)
├── homework.html          ← Homework assignment form (Web App page)
├── Draft.md               ← Original design draft (for reference)
└── README.md              ← This file
```
