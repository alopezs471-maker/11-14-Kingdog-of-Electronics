import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import time
from http import cookies
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
DB = Path(os.environ.get('KINGDOG_DB', ROOT / 'data' / 'kingdog.sqlite3'))
DB.parent.mkdir(parents=True, exist_ok=True)
PUBLIC_ORIGIN = os.environ.get('KINGDOG_PUBLIC_ORIGIN', '').rstrip('/')
if PUBLIC_ORIGIN:
    parsed_origin = urlparse(PUBLIC_ORIGIN)
    if (parsed_origin.scheme != 'https' or not parsed_origin.hostname or parsed_origin.path
            or parsed_origin.query or parsed_origin.fragment or parsed_origin.username or parsed_origin.password):
        raise ValueError('KINGDOG_PUBLIC_ORIGIN debe ser un origen HTTPS sin ruta')
with sqlite3.connect(DB) as db:
    db.executescript('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
        salt TEXT NOT NULL, password_hash TEXT NOT NULL
    ); CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires INTEGER NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id)
    ); CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY, window_start INTEGER NOT NULL, count INTEGER NOT NULL
    );''')


def password_hash(password, salt):
    return hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), 310000).hex()


def allow_attempt(keys, limit, window):
    now = int(time.time())
    with sqlite3.connect(DB, timeout=10) as db:
        db.execute('BEGIN IMMEDIATE')
        db.execute('DELETE FROM rate_limits WHERE window_start <= ?', (now - window,))
        rows = [db.execute('SELECT count FROM rate_limits WHERE key = ?', (key,)).fetchone() for key in keys]
        if any(row and row[0] >= limit for row in rows):
            return False
        for key in keys:
            db.execute('INSERT INTO rate_limits VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET count = count + 1', (key, now))
        return True


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'")
        super().end_headers()

    def reply(self, status, data, cookie=None):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        if status == 429:
            self.send_header('Retry-After', '900')
        if cookie:
            self.send_header('Set-Cookie', cookie)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def session(self, db):
        jar = cookies.SimpleCookie()
        try:
            jar.load(self.headers.get('Cookie', ''))
            token = jar['session'].value
        except (KeyError, cookies.CookieError):
            return None
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        return db.execute('SELECT users.id, users.name, users.email FROM users JOIN sessions ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires > ?', (token_hash, int(time.time()))).fetchone()

    def do_GET(self):
        path = urlparse(self.path).path
        if path == '/api/me':
            with sqlite3.connect(DB) as db:
                user = self.session(db)
            return self.reply(200, {'user': dict(zip(('id', 'name', 'email'), user)) if user else None})
        if path not in ('/', '/index.html', '/pc.html', '/pc.js', '/smartphone.html', '/app.js', '/cuenta.js', '/cuenta.css'):
            self.send_error(404)
            return
        super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        if path not in ('/api/register', '/api/login', '/api/logout', '/api/profile'):
            return self.reply(404, {'error': 'Ruta no encontrada.'})
        origin = self.headers.get('Origin')
        expected_origin = PUBLIC_ORIGIN or 'http://' + self.headers.get('Host', '')
        if origin != expected_origin:
            return self.reply(403, {'error': 'Origen no permitido.'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length < 1 or length > 4096 or self.headers.get_content_type() != 'application/json':
                raise ValueError()
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict):
                raise ValueError()
        except (ValueError, UnicodeDecodeError):
            return self.reply(400, {'error': 'Solicitud inválida.'})
        if path in ('/api/register', '/api/login'):
            email_for_limit = data.get('email', '')
            email_for_limit = email_for_limit.strip().lower()[:254] if isinstance(email_for_limit, str) else ''
            ip_key = 'ip:' + self.client_address[0]
            email_key = 'email:' + hashlib.sha256(email_for_limit.encode()).hexdigest()
            if not allow_attempt((ip_key, email_key), 10, 900):
                return self.reply(429, {'error': 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.'})
        with sqlite3.connect(DB) as db:
            if path == '/api/logout':
                jar = cookies.SimpleCookie()
                try:
                    jar.load(self.headers.get('Cookie', ''))
                    token = jar['session'].value
                    db.execute('DELETE FROM sessions WHERE token_hash = ?', (hashlib.sha256(token.encode()).hexdigest(),))
                except (KeyError, cookies.CookieError):
                    pass
                return self.reply(200, {'ok': True}, 'session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0')
            if path == '/api/profile':
                user = self.session(db)
                if not user:
                    return self.reply(401, {'error': 'Inicia sesión primero.'})
                name = data.get('name', '')
                if not isinstance(name, str) or not 1 <= len(name.strip()) <= 80:
                    return self.reply(400, {'error': 'Escribe un nombre de hasta 80 caracteres.'})
                name = name.strip()
                db.execute('UPDATE users SET name = ? WHERE id = ?', (name, user[0]))
                return self.reply(200, {'user': {'id': user[0], 'name': name, 'email': user[2]}})
            email, password = data.get('email', ''), data.get('password', '')
            if not isinstance(email, str) or not isinstance(password, str):
                return self.reply(400, {'error': 'Datos inválidos.'})
            email = email.strip().lower()
            if len(email) > 254 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email) or not 8 <= len(password) <= 128:
                return self.reply(400, {'error': 'Escribe un correo válido y una contraseña de 8 a 128 caracteres.'})
            if path == '/api/register':
                name = data.get('name', '')
                if not isinstance(name, str) or not 1 <= len(name.strip()) <= 80:
                    return self.reply(400, {'error': 'Escribe un nombre de hasta 80 caracteres.'})
                salt = secrets.token_hex(16)
                try:
                    cursor = db.execute('INSERT INTO users (name, email, salt, password_hash) VALUES (?, ?, ?, ?)', (name.strip(), email, salt, password_hash(password, salt)))
                    user = (cursor.lastrowid, name.strip(), email)
                except sqlite3.IntegrityError:
                    return self.reply(409, {'error': 'Este correo ya está registrado.'})
            else:
                row = db.execute('SELECT id, name, email, salt, password_hash FROM users WHERE email = ?', (email,)).fetchone()
                candidate = password_hash(password, row[3] if row else '00' * 16)
                if not row or not hmac.compare_digest(candidate, row[4]):
                    return self.reply(401, {'error': 'Correo o contraseña incorrectos.'})
                user = row[:3]
            token = secrets.token_urlsafe(32)
            db.execute('DELETE FROM sessions WHERE expires <= ?', (int(time.time()),))
            db.execute('INSERT INTO sessions VALUES (?, ?, ?)', (hashlib.sha256(token.encode()).hexdigest(), user[0], int(time.time()) + 604800))
            secure = '; Secure' if PUBLIC_ORIGIN else ''
            return self.reply(200, {'user': dict(zip(('id', 'name', 'email'), user))}, f'session={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800{secure}')


if __name__ == '__main__':
    port = int(os.environ.get('PORT', '4173'))
    print(f'Kingdog disponible en el puerto {port}', flush=True)
    ThreadingHTTPServer((os.environ.get('KINGDOG_HOST', '127.0.0.1'), port), Handler).serve_forever()
