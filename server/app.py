"""LearnHub: educational course platform API (Flask + SQLAlchemy)."""
from __future__ import annotations

import os
import re
import secrets
from datetime import datetime, timezone
from functools import wraps
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv
from flask import Flask, jsonify, request, session, send_from_directory
from flask_login import (LoginManager, UserMixin, current_user, login_required,
                         login_user, logout_user)
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import UniqueConstraint, func
from werkzeug.security import check_password_hash, generate_password_hash

BASE = Path(__file__).resolve().parent
load_dotenv(BASE / '.env')
DATA = BASE / 'data'
DATA.mkdir(exist_ok=True)
SECRET_FILE = DATA / '.flask_secret'
if not SECRET_FILE.exists():
    SECRET_FILE.write_text(secrets.token_hex(32), encoding='utf-8')

app = Flask(__name__, static_folder='../client/dist', static_url_path='/')
app.config.update(
    SECRET_KEY=os.getenv('SECRET_KEY') or SECRET_FILE.read_text(encoding='utf-8').strip(),
    SQLALCHEMY_DATABASE_URI=os.getenv('DATABASE_URL') or f"sqlite:///{(DATA / 'learnhub.db').as_posix()}",
    SQLALCHEMY_TRACK_MODIFICATIONS=False,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
    SESSION_COOKIE_SECURE=os.getenv('HTTPS_ONLY') == '1',
    MAX_CONTENT_LENGTH=256 * 1024,
)
# Accept the older Render/Heroku-style PostgreSQL URI where needed.
if app.config['SQLALCHEMY_DATABASE_URI'].startswith('postgres://'):
    app.config['SQLALCHEMY_DATABASE_URI'] = app.config['SQLALCHEMY_DATABASE_URI'].replace('postgres://', 'postgresql://', 1)

db = SQLAlchemy(app)
login_manager = LoginManager(app)


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(90), nullable=False)
    email = db.Column(db.String(180), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(16), nullable=False, default='student')
    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)


class Course(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    instructor_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    title = db.Column(db.String(140), nullable=False)
    description = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(48), nullable=False)
    level = db.Column(db.String(24), nullable=False, default='Beginner')
    accent = db.Column(db.String(16), nullable=False, default='violet')
    published = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)
    instructor = db.relationship('User', backref='created_courses')
    lessons = db.relationship('Lesson', backref='course', order_by='Lesson.position', cascade='all, delete-orphan')


class Lesson(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey('course.id'), nullable=False)
    title = db.Column(db.String(140), nullable=False)
    content = db.Column(db.Text, nullable=False)
    video_url = db.Column(db.String(300), nullable=False, default='')
    minutes = db.Column(db.Integer, nullable=False, default=10)
    position = db.Column(db.Integer, nullable=False)
    questions = db.relationship('Question', backref='lesson', order_by='Question.id', cascade='all, delete-orphan')
    __table_args__ = (UniqueConstraint('course_id', 'position', name='uq_course_lesson_position'),)


class Question(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    lesson_id = db.Column(db.Integer, db.ForeignKey('lesson.id'), nullable=False)
    prompt = db.Column(db.String(350), nullable=False)
    option_a = db.Column(db.String(180), nullable=False)
    option_b = db.Column(db.String(180), nullable=False)
    option_c = db.Column(db.String(180), nullable=False)
    option_d = db.Column(db.String(180), nullable=False)
    correct = db.Column(db.String(1), nullable=False)


class Enrollment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey('course.id'), nullable=False)
    joined_at = db.Column(db.DateTime, default=utcnow, nullable=False)
    __table_args__ = (UniqueConstraint('user_id', 'course_id', name='uq_enrollment_user_course'),)


class Progress(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    lesson_id = db.Column(db.Integer, db.ForeignKey('lesson.id'), nullable=False)
    completed_at = db.Column(db.DateTime, default=utcnow, nullable=False)
    __table_args__ = (UniqueConstraint('user_id', 'lesson_id', name='uq_progress_user_lesson'),)


class QuizAttempt(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    lesson_id = db.Column(db.Integer, db.ForeignKey('lesson.id'), nullable=False)
    score = db.Column(db.Integer, nullable=False)
    total = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)


@login_manager.user_loader
def load_user(user_id):
    try:
        return db.session.get(User, int(user_id))
    except (ValueError, TypeError):
        return None


@login_manager.unauthorized_handler
def unauthorized():
    return jsonify(error='Please log in to continue.'), 401


@app.before_request
def protect_mutations():
    if request.path.startswith('/api/') and request.method in {'POST', 'PATCH', 'PUT', 'DELETE'}:
        if not session.get('csrf') or not secrets.compare_digest(request.headers.get('X-CSRF-Token', ''), session['csrf']):
            return jsonify(error='Session verification failed. Refresh the page and try again.'), 403


@app.errorhandler(404)
def missing(_):
    if request.path.startswith('/api/'):
        return jsonify(error='Not found.'), 404
    return 'Not found', 404


@app.errorhandler(413)
def too_large(_):
    return jsonify(error='Request is too large.'), 413


def error(message, status=400):
    return jsonify(error=message), status


def data():
    return request.get_json(silent=True) or {}


def signed_in_user():
    return {'id': current_user.id, 'name': current_user.name, 'email': current_user.email, 'role': current_user.role}


def instructor_required(fn):
    @wraps(fn)
    @login_required
    def wrapped(*args, **kwargs):
        if current_user.role != 'instructor':
            return error('Only instructors can do this.', 403)
        return fn(*args, **kwargs)
    return wrapped


def student_required(fn):
    @wraps(fn)
    @login_required
    def wrapped(*args, **kwargs):
        if current_user.role != 'student':
            return error('Only students can do this.', 403)
        return fn(*args, **kwargs)
    return wrapped


def can_access(course):
    if not current_user.is_authenticated:
        return False
    if current_user.role == 'instructor' and course.instructor_id == current_user.id:
        return True
    if current_user.role == 'student':
        return db.session.scalar(db.select(Enrollment.id).where(Enrollment.user_id == current_user.id, Enrollment.course_id == course.id)) is not None
    return False


def course_json(course, detail=False):
    enrollment_count = db.session.scalar(db.select(func.count(Enrollment.id)).where(Enrollment.course_id == course.id)) or 0
    out = {
        'id': course.id, 'title': course.title, 'description': course.description,
        'category': course.category, 'level': course.level, 'accent': course.accent,
        'published': course.published, 'instructor': course.instructor.name,
        'instructor_id': course.instructor_id, 'lesson_count': len(course.lessons),
        'students': enrollment_count, 'minutes': sum(l.minutes for l in course.lessons),
    }
    if detail:
        allowed = can_access(course)
        completed = set()
        if current_user.is_authenticated and current_user.role == 'student' and allowed:
            ids = [l.id for l in course.lessons]
            if ids:
                completed = set(db.session.scalars(db.select(Progress.lesson_id).where(Progress.user_id == current_user.id, Progress.lesson_id.in_(ids))).all())
        out['enrolled'] = allowed
        out['completed_count'] = len(completed)
        out['lessons'] = [
            {'id': l.id, 'title': l.title, 'minutes': l.minutes, 'position': l.position,
             'completed': l.id in completed, 'has_quiz': len(l.questions) > 0,
             **({'content': l.content, 'video_url': l.video_url,
                 'questions': [{'id': q.id, 'prompt': q.prompt,
                                'options': [q.option_a, q.option_b, q.option_c, q.option_d]}
                               for q in l.questions]} if allowed else {})}
            for l in course.lessons
        ]
    return out


@app.get('/api/csrf')
def csrf():
    if 'csrf' not in session:
        session['csrf'] = secrets.token_urlsafe(32)
    return jsonify(csrf=session['csrf'])


@app.get('/api/auth/me')
def me():
    return jsonify(user=signed_in_user() if current_user.is_authenticated else None)


@app.post('/api/auth/register')
def register():
    d = data()
    name = str(d.get('name', '')).strip()
    email = str(d.get('email', '')).strip().lower()
    password = str(d.get('password', ''))
    role = d.get('role', 'student')
    if not 2 <= len(name) <= 90:
        return error('Name must be 2–90 characters.')
    if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email) or len(email) > 180:
        return error('Enter a valid email address.')
    if not 8 <= len(password) <= 128:
        return error('Password must be 8–128 characters.')
    if role not in {'student', 'instructor'}:
        return error('Choose student or instructor.')
    if db.session.scalar(db.select(User.id).where(User.email == email)) is not None:
        return error('This email is already registered.', 409)
    user = User(name=name, email=email, password_hash=generate_password_hash(password), role=role)
    db.session.add(user)
    db.session.commit()
    login_user(user)
    return jsonify(user=signed_in_user()), 201


@app.post('/api/auth/login')
def login():
    d = data()
    email = str(d.get('email', '')).strip().lower()
    user = db.session.scalar(db.select(User).where(User.email == email))
    if not user or not check_password_hash(user.password_hash, str(d.get('password', ''))):
        return error('Incorrect email or password.', 401)
    login_user(user)
    return jsonify(user=signed_in_user())


@app.post('/api/auth/logout')
@login_required
def logout():
    logout_user()
    return jsonify(ok=True)


@app.get('/api/courses')
def courses():
    keyword = str(request.args.get('q', '')).strip()[:80]
    category = str(request.args.get('category', '')).strip()[:48]
    stmt = db.select(Course).where(Course.published.is_(True)).order_by(Course.id.desc())
    if keyword:
        stmt = stmt.where(Course.title.ilike(f'%{keyword}%'))
    if category and category != 'All':
        stmt = stmt.where(Course.category == category)
    return jsonify(courses=[course_json(c) for c in db.session.scalars(stmt).all()])


@app.get('/api/courses/<int:course_id>')
def course_detail(course_id):
    course = db.get_or_404(Course, course_id)
    if not course.published and not (current_user.is_authenticated and current_user.id == course.instructor_id):
        return error('Course unavailable.', 404)
    return jsonify(course=course_json(course, detail=True))


@app.post('/api/courses/<int:course_id>/enroll')
@student_required
def enroll(course_id):
    course = db.get_or_404(Course, course_id)
    if not course.published:
        return error('Course not available.', 404)
    if db.session.scalar(db.select(Enrollment.id).where(Enrollment.user_id == current_user.id, Enrollment.course_id == course.id)) is not None:
        return jsonify(ok=True)
    db.session.add(Enrollment(user_id=current_user.id, course_id=course.id))
    db.session.commit()
    return jsonify(ok=True), 201


@app.get('/api/dashboard')
@login_required
def dashboard():
    if current_user.role == 'student':
        enrolled = db.session.scalars(db.select(Enrollment).where(Enrollment.user_id == current_user.id).order_by(Enrollment.joined_at.desc())).all()
        items = []
        total_done = 0
        for e in enrolled:
            course = db.session.get(Course, e.course_id)
            ids = [l.id for l in course.lessons]
            done = db.session.scalar(db.select(func.count(Progress.id)).where(Progress.user_id == current_user.id, Progress.lesson_id.in_(ids))) if ids else 0
            total_done += done or 0
            items.append({**course_json(course), 'completed_count': done or 0,
                          'progress': round((done or 0) / len(ids) * 100) if ids else 0})
        completed_courses = sum(x['progress'] == 100 and x['lesson_count'] > 0 for x in items)
        return jsonify(role='student', stats={'enrolled': len(items), 'completed': completed_courses,
                                               'lessons': total_done}, courses=items)
    owned = db.session.scalars(db.select(Course).where(Course.instructor_id == current_user.id).order_by(Course.id.desc())).all()
    items = [course_json(c) for c in owned]
    return jsonify(role='instructor', stats={'courses': len(items),
                                             'students': sum(x['students'] for x in items),
                                             'lessons': sum(x['lesson_count'] for x in items)}, courses=items)


@app.post('/api/courses')
@instructor_required
def create_course():
    d = data()
    title = str(d.get('title', '')).strip()
    description = str(d.get('description', '')).strip()
    category = str(d.get('category', 'Development')).strip()
    level = d.get('level', 'Beginner')
    accent = d.get('accent', 'violet')
    if not 5 <= len(title) <= 140 or not 20 <= len(description) <= 2500:
        return error('Title must be 5–140 characters and description 20–2500 characters.')
    if category not in {'Development', 'Design', 'Business', 'Data Science', 'Marketing'}:
        return error('Select a valid category.')
    if level not in {'Beginner', 'Intermediate', 'Advanced'}:
        return error('Select a valid level.')
    if accent not in {'violet', 'blue', 'orange', 'green', 'pink'}:
        accent = 'violet'
    course = Course(instructor_id=current_user.id, title=title, description=description,
                    category=category, level=level, accent=accent, published=True)
    db.session.add(course)
    db.session.commit()
    return jsonify(course=course_json(course)), 201


@app.patch('/api/courses/<int:course_id>')
@instructor_required
def update_course(course_id):
    course = db.get_or_404(Course, course_id)
    if course.instructor_id != current_user.id:
        return error('This course does not belong to you.', 403)
    d = data()
    if 'published' in d:
        if not isinstance(d['published'], bool):
            return error('published must be true or false.')
        course.published = d['published']
    db.session.commit()
    return jsonify(course=course_json(course))


def valid_video(url):
    if not url:
        return True
    try:
        u = urlparse(url)
        return u.scheme == 'https' and u.hostname in {'www.youtube.com', 'youtube.com', 'youtu.be', 'www.youtube-nocookie.com'}
    except ValueError:
        return False


@app.post('/api/courses/<int:course_id>/lessons')
@instructor_required
def create_lesson(course_id):
    course = db.get_or_404(Course, course_id)
    if course.instructor_id != current_user.id:
        return error('You cannot edit this course.', 403)
    d = data()
    title = str(d.get('title', '')).strip()
    content = str(d.get('content', '')).strip()
    video_url = str(d.get('video_url', '')).strip()
    if not 4 <= len(title) <= 140 or not 30 <= len(content) <= 12000:
        return error('Lesson title must be 4–140 characters, content 30–12000 characters.')
    if len(video_url) > 300 or not valid_video(video_url):
        return error('Optional video must be a valid HTTPS YouTube URL.')
    try:
        minutes = int(d.get('minutes', 10))
    except (TypeError, ValueError):
        return error('Invalid lesson duration.')
    if not 1 <= minutes <= 240:
        return error('Lesson duration must be 1–240 minutes.')
    lesson = Lesson(course_id=course.id, title=title, content=content, video_url=video_url,
                    minutes=minutes, position=len(course.lessons) + 1)
    db.session.add(lesson)
    db.session.commit()
    return jsonify(lesson_id=lesson.id), 201


@app.post('/api/lessons/<int:lesson_id>/questions')
@instructor_required
def add_question(lesson_id):
    lesson = db.get_or_404(Lesson, lesson_id)
    if lesson.course.instructor_id != current_user.id:
        return error('You cannot edit this lesson.', 403)
    d = data()
    prompt = str(d.get('prompt', '')).strip()
    options = d.get('options')
    correct = str(d.get('correct', '')).upper()
    if not 8 <= len(prompt) <= 350 or not isinstance(options, list) or len(options) != 4:
        return error('Enter a question (8–350 characters) and four answers.')
    if any(not isinstance(x, str) or not 1 <= len(x.strip()) <= 180 for x in options) or correct not in {'A', 'B', 'C', 'D'}:
        return error('Enter four valid options and the correct answer (A–D).')
    question = Question(lesson_id=lesson.id, prompt=prompt,
                        option_a=options[0].strip(), option_b=options[1].strip(),
                        option_c=options[2].strip(), option_d=options[3].strip(), correct=correct)
    db.session.add(question)
    db.session.commit()
    return jsonify(question_id=question.id), 201


@app.post('/api/lessons/<int:lesson_id>/complete')
@student_required
def complete_lesson(lesson_id):
    lesson = db.get_or_404(Lesson, lesson_id)
    if not can_access(lesson.course):
        return error('Enroll in this course first.', 403)
    existing = db.session.scalar(db.select(Progress.id).where(Progress.user_id == current_user.id, Progress.lesson_id == lesson.id))
    if existing is None:
        db.session.add(Progress(user_id=current_user.id, lesson_id=lesson.id))
        db.session.commit()
    return jsonify(ok=True)


@app.post('/api/lessons/<int:lesson_id>/quiz')
@student_required
def submit_quiz(lesson_id):
    lesson = db.get_or_404(Lesson, lesson_id)
    if not can_access(lesson.course):
        return error('Enroll in this course first.', 403)
    if not lesson.questions:
        return error('This lesson has no quiz.')
    answers = data().get('answers', {})
    if not isinstance(answers, dict):
        return error('Invalid quiz answers.')
    correct_count = sum(str(answers.get(str(q.id), '')).upper() == q.correct for q in lesson.questions)
    db.session.add(QuizAttempt(user_id=current_user.id, lesson_id=lesson.id,
                               score=correct_count, total=len(lesson.questions)))
    db.session.commit()
    return jsonify(score=correct_count, total=len(lesson.questions),
                   correct_answers={str(q.id): q.correct for q in lesson.questions})


# Serve compiled frontend when deployed as one Flask service. Vite serves it separately in development.
@app.get('/')
def home():
    dist = BASE.parent / 'client' / 'dist'
    if (dist / 'index.html').exists():
        return send_from_directory(dist, 'index.html')
    return jsonify(message='LearnHub API is running. Open React at http://localhost:5173/ during development.')


@app.get('/<path:resource>')
def frontend_resource(resource):
    if resource.startswith('api/'):
        return error('Not found.', 404)
    dist = BASE.parent / 'client' / 'dist'
    if (dist / resource).is_file():
        return send_from_directory(dist, resource)
    if (dist / 'index.html').exists():
        return send_from_directory(dist, 'index.html')
    return error('Not found.', 404)


def seed_sample_courses():
    if db.session.scalar(db.select(func.count(Course.id))):
        return
    seed_user = User(name='LearnHub Academy', email='academy@internal.learnhub',
                     password_hash=generate_password_hash(secrets.token_urlsafe(40)), role='instructor')
    db.session.add(seed_user)
    db.session.flush()
    examples = [
        ('Frontend Development Bootcamp', 'Development', 'Beginner', 'violet',
         'Build beautiful, responsive websites with HTML, CSS, and JavaScript fundamentals. Learn by creating usable components and practicing real workflows.',
         [('How the web works', 'The browser requests resources from a server. HTML describes the structure of a document, CSS controls its presentation, and JavaScript adds interactions. Open Developer Tools and inspect the Elements and Network panels to see the three layers in action.', 'What describes webpage structure?', ['CSS', 'HTML', 'SQL', 'Python'], 'B'),
          ('Designing with CSS', 'Use the box model to understand padding, border, margin, and content. Flexbox aligns items in one dimension, while CSS Grid handles two-dimensional layout. Responsive design combines flexible sizes with media queries for phones and desktops.', 'Which CSS feature is designed for two-dimensional layout?', ['Flexbox', 'Grid', 'Padding', 'Opacity'], 'B'),
          ('JavaScript interactions', 'JavaScript responds to browser events such as clicks and typing. Select elements with querySelector, then add event listeners. Update content through textContent, and keep data separate from its displayed representation.', 'Which method registers a click handler?', ['addEventListener', 'appendStyle', 'onSelectText', 'cssQuery'], 'A')]),
        ('UI/UX Design Essentials', 'Design', 'Beginner', 'pink',
         'Learn the principles behind approachable digital experiences, from user research and visual hierarchy to accessible interface patterns.',
         [('Understand user goals', 'Begin with the user, their goal, and the context of their task. Interview users and identify friction points before deciding on features. Translate findings into user stories and simple task flows.', 'What comes first in a user-centered design process?', ['Adding animations', 'User research', 'Choosing gradients', 'Writing APIs'], 'B'),
          ('Visual hierarchy', 'Hierarchy directs attention using size, contrast, spacing, and alignment. Choose a limited type scale and color palette. Group related items together and maintain consistent spacing throughout the interface.', 'Which helps create visual hierarchy?', ['Random spacing', 'Consistent contrast', 'Hidden labels', 'Many fonts'], 'B'),
          ('Accessible interfaces', 'Use readable contrast, meaningful labels, visible focus states, and keyboard-friendly controls. Do not communicate important status using color alone. Test common tasks without a mouse.', 'Which is a good accessibility practice?', ['Remove focus rings', 'Use unlabeled icons', 'Provide visible focus states', 'Use color only'], 'C')]),
        ('Python for Data Analysis', 'Data Science', 'Intermediate', 'blue',
         'Explore practical data analysis techniques with Python, data cleaning, summary statistics, and thoughtful visualization.',
         [('Explore a dataset', 'Start by identifying column types, missing values, and row counts. Decide what questions the data can answer. Inspect a small representative sample and document data quality issues before analysis.', 'What should you do before analyzing a dataset?', ['Ignore missing data', 'Check quality', 'Delete columns randomly', 'Publish conclusions'], 'B'),
          ('Clean and transform', 'Cleaning includes handling missing values, normalizing formats, and removing duplicate records when appropriate. Validate assumptions after each transformation and preserve the raw source for reproducibility.', 'Which is a valid cleaning operation?', ['Normalize date formats', 'Hide outliers without review', 'Invent values', 'Discard documentation'], 'A'),
          ('Explain with charts', 'Choose charts according to the question: line charts show trends, bar charts compare categories, and scatter plots explore relationships. Always label axes and use honest scales.', 'Which chart best shows change over time?', ['Line chart', 'Pie chart', 'Icon grid', 'Word cloud'], 'A')]),
        ('Digital Marketing Foundations', 'Marketing', 'Beginner', 'orange',
         'Plan measurable digital campaigns with clear audiences, compelling content, and practical methods for evaluating results.',
         [('Find your audience', 'Identify target audiences by needs, behaviors, and problems, not assumptions alone. Write a specific value proposition and align each channel with the audience you intend to reach.', 'What should guide campaign messaging?', ['Random trends', 'Audience needs', 'Competitor colors', 'Office location'], 'B'),
          ('Create useful content', 'Useful content solves the audience’s problem. Develop a simple editorial calendar and make each piece answer one clear question. Test variations while keeping the brand voice consistent.', 'What makes content useful?', ['Clear audience value', 'More hashtags', 'Longer sentences', 'More popups'], 'A'),
          ('Measure performance', 'Define metrics before launch: reach, click-through, conversion, and retention measure different stages of a customer journey. Review results with context and adjust the next experiment.', 'Which metric tracks completed desired actions?', ['Impressions', 'Conversions', 'Page color', 'Word count'], 'B')]),
        ('Business Analytics with Spreadsheets', 'Business', 'Intermediate', 'green',
         'Turn raw spreadsheet data into meaningful business insights using structured tables, formulas, and useful performance indicators.',
         [('Build clean spreadsheets', 'Separate raw inputs, calculations, and summaries into clearly labeled areas. Use consistent column types and avoid merged cells in the data table. Check for unexpected empty rows.', 'Which makes analysis easier?', ['Merged data rows', 'Consistent tables', 'Unlabeled columns', 'Mixed date types'], 'B'),
          ('Summarize business data', 'Use aggregate measures such as totals, averages, and rates. Build pivot-style summaries by time or category to make comparison easier. Choose KPIs that reflect the business objective.', 'What does a KPI represent?', ['Key performance indicator', 'Known parsing issue', 'Keyboard input prompt', 'Key project image'], 'A'),
          ('Present findings', 'Communicate the question, insight, evidence, and next action. Highlight major changes and explain uncertainty. Keep dashboards focused on decisions, not decoration.', 'A good report should include?', ['Only colors', 'Actionable insight', 'Every chart possible', 'No context'], 'B')]),
    ]
    for title, category, level, accent, description, lessons in examples:
        course = Course(instructor_id=seed_user.id, title=title, category=category, level=level,
                        accent=accent, description=description, published=True)
        db.session.add(course)
        db.session.flush()
        for index, (ltitle, content, prompt, choices, answer) in enumerate(lessons, 1):
            lesson = Lesson(course_id=course.id, title=ltitle, content=content, minutes=12 + 3 * index,
                            video_url='', position=index)
            db.session.add(lesson)
            db.session.flush()
            db.session.add(Question(lesson_id=lesson.id, prompt=prompt, option_a=choices[0],
                                    option_b=choices[1], option_c=choices[2], option_d=choices[3], correct=answer))
    db.session.commit()


with app.app_context():
    db.create_all()
    seed_sample_courses()

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=False)
