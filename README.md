# LearnHub — Online Learning Platform

A polished full-stack learning management web application for a BCA internship portfolio.

**Stack:** React 19, Vite 6, Flask, Flask-SQLAlchemy, Flask-Login, SQLite (default) / PostgreSQL (optional), Lucide icons, HTML and CSS.

## Features

- Register and log in as a **student** or **instructor** (passwords are hashed).
- Explore and filter published courses by category and title.
- Enroll in courses for free and unlock lesson material.
- Read lessons and optionally watch instructor-provided YouTube videos.
- Complete lessons and see progress across each enrolled course.
- Answer multiple-choice quizzes and see your score.
- Instructor studio: create and publish/unpublish courses, add lessons, and create quiz questions.
- Separate dashboards for students and instructors.
- Responsive design for desktop and mobile; seeded sample courses included.
- Persistent storage with SQLite by default, optionally PostgreSQL using DATABASE_URL.

## Requirements

- **Node.js 20.19+ or 22.12+** (newer LTS is fine) and npm: https://nodejs.org/
- **Python 3.10+**: https://www.python.org/downloads/
- **VS Code** recommended: https://code.visualstudio.com/
- No XAMPP, MySQL, or Anaconda required.

## One-click launch on Windows

1. Extract `LearnHub_Complete.zip`.
2. Double-click `START_LEARNHUB.bat` (on the first run, package downloads require internet).
3. Wait until the backend window says `Running on http://127.0.0.1:5000` and the frontend window says `Local: http://127.0.0.1:5173`.
4. Open **http://127.0.0.1:5173/** in Chrome or Edge.
5. Leave the two terminal windows open. To stop, press Ctrl+C in both windows.

The launcher depends on `python`, `node`, and `npm` being accessible in Command Prompt. If Node.js or Python is not recognized, install it or open a new CMD window after installation.

## Manual launch using VS Code

Open the **LearnHub** folder with VS Code, not just `server` or `client`.

**Terminal 1 (Flask API):**

```powershell
cd server
python -m pip install -r requirements.txt
python app.py
```

**Terminal 2 (React app):**

```powershell
cd client
npm install
npm run dev
```

Go to **http://127.0.0.1:5173/**.

### Important path troubleshooting

If Windows says `The system cannot find the path specified` after `cd server`, you're in the wrong folder. In File Explorer, open the **LearnHub** folder (the one containing `client` and `server`), click the address bar, type `cmd` and press Enter. Now use the terminal commands above.

### Database

On first start, the backend creates `server/data/learnhub.db` and sample courses automatically. The SQLite database survives restarts. Keep a backup of `server/data/learnhub.db` when the server is stopped to preserve user accounts and learning progress. Keep database files private.

For **PostgreSQL**, copy `server/.env.example` to `server/.env` and set:

```
DATABASE_URL=postgresql://username:password@host:5432/learnhub
SECRET_KEY=use-a-long-random-unique-value
```

`psycopg2-binary` is included in the requirements. Create the database in PostgreSQL first; SQLAlchemy creates tables automatically at startup. No automatic migration of existing SQLite data is provided.

**Important:** Never upload `.env`, the database, or the generated `.flask_secret` file to GitHub. `.gitignore` excludes these.

## Demo workflow

### Student
1. Register a student account.
2. Go to **Explore Courses**; choose one of the five seeded courses.
3. Press **Enroll for free**.
4. Open a lesson, read it, click **Mark complete**, and take the quiz.
5. Visit **My Learning** and **Dashboard** to see progress.

### Instructor
1. Log out, and register a different account with **Create courses as an instructor** selected.
2. Open **Instructor Studio → Create course**.
3. Open the new course, add a lesson (min 30 characters), and optionally add quiz questions.
4. Student accounts can discover and enroll in published courses.
5. Instructors can unpublish or republish courses.

## Project tree

```
LearnHub/
├── client/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       └── style.css
├── server/
│   ├── app.py
│   ├── requirements.txt
│   ├── .env.example
│   └── data/                   # auto-generated DB and session secret
├── START_LEARNHUB.bat
├── RUN_BACKEND.bat
├── RUN_FRONTEND.bat
├── README.md
└── .gitignore
```

## API overview

| Method | Path | Description |
| --- | --- | --- |
| GET | /api/csrf | Initialize session CSRF token |
| POST | /api/auth/register | Register student or instructor |
| POST | /api/auth/login | Login |
| POST | /api/auth/logout | Logout |
| GET | /api/auth/me | Current user |
| GET | /api/courses | Published course catalog |
| GET | /api/courses/:id | Course details; lesson content for authorized users |
| GET | /api/dashboard | Role-based dashboard |
| POST | /api/courses/:id/enroll | Enroll as student |
| POST | /api/courses | Instructor creates course |
| PATCH | /api/courses/:id | Owner publishes/unpublishes |
| POST | /api/courses/:id/lessons | Owner creates lesson |
| POST | /api/lessons/:id/questions | Owner creates quiz question |
| POST | /api/lessons/:id/complete | Enrolled student marks completed |
| POST | /api/lessons/:id/quiz | Enrolled student submits quiz |

Vite proxies requests starting with `/api` to Flask on port 5000. The browser uses secure HttpOnly session cookies and a CSRF header for form mutations; course and lesson access are checked on the backend.

## Production caveats

This is a **portfolio/educational project**, not a production-ready learning platform. Before deploying for public use, add email verification, password reset, login rate limiting, stronger monitoring, database migrations/backups, WSGI HTTPS hosting, CSP/security headers, and proper roles/account moderation. The instructor role is available through self-registration in this demo. **Do not rely on this for paid coursework or store sensitive data.** Videos are linked through YouTube rather than uploaded/hosted on the server.

## GitHub

Upload the project folder excluding `.env`, `server/data/*`, `node_modules`, and `client/dist`. Attach screenshots of your running app once tested.

**CV summary:** Built a full-stack online learning management platform using React, Flask, REST APIs and SQLAlchemy, featuring role-based authentication, course enrollment, interactive quizzes, lesson progress tracking and an instructor dashboard.

## License

MIT — see `LICENSE`.
