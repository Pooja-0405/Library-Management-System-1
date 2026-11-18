from flask import Flask, render_template, request, jsonify
import sqlite3

app = Flask(__name__)

def get_db():
    conn = sqlite3.connect("database.db")
    conn.row_factory = sqlite3.Row
    return conn

def initialize_db():
    conn = get_db()

    conn.execute("""
        CREATE TABLE IF NOT EXISTS books (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            author TEXT NOT NULL,
            category TEXT,
            quantity INTEGER NOT NULL
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            roll_no TEXT UNIQUE
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS issued (
            id INTEGER PRIMARY KEY
 AUTOINCREMENT,
            book_id INTEGER,
            student_id INTEGER,
            issue_date TEXT,
            return_date TEXT,
            status TEXT DEFAULT 'Issued'
        )
    """)
    columns = [
        row["name"]
        for row in conn.execute("PRAGMA table_info(issued)").fetchall()
    ]

    if "due_date" not in columns:
        conn.execute("ALTER TABLE issued ADD COLUMN due_date TEXT")


    conn.commit()
    conn.close()

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/api/books", methods=["GET", "POST"])
def books():
    conn = get_db()

    if request.method == "POST":
        data = request.json

        conn.execute(
            """INSERT INTO books
            (title, author, category, quantity)
            VALUES (?, ?, ?, ?)""",
            (
                data["title"],
                data["author"],
                data["category"],
                data["quantity"]
            )
        )

        conn.commit()
        conn.close()

        return jsonify({"message": "Book added successfully"})

    rows = conn.execute("SELECT * FROM books").fetchall()
    conn.close()

    return jsonify([dict(row) for row in rows])

@app.route("/api/stats")
def stats():
    conn = get_db()

    total = conn.execute(
        "SELECT COALESCE(SUM(quantity), 0) FROM books"
    ).fetchone()[0]

    students = conn.execute(
        "SELECT COUNT(*) FROM students"
    ).fetchone()[0]

    issued = conn.execute(
        "SELECT COUNT(*) FROM issued WHERE status='Issued'"
    ).fetchone()[0]

    conn.close()

    return jsonify({
        "total_books": total,
        "students": students,
        "issued_books": issued
    })
@app.route("/api/students", methods=["GET", "POST"])
def manage_students():
    conn = get_db()

    if request.method == "POST":
        data = request.json

        name = data.get("name", "").strip()
        roll_no = data.get("roll_no", "").strip()

        if not name or not roll_no:
            conn.close()
            return jsonify({"error": "Enter all details"}), 400

        try:
            conn.execute(
                "INSERT INTO students (name, roll_no) VALUES (?, ?)",
                (name, roll_no)
            )
            conn.commit()
        except sqlite3.IntegrityError:
            conn.close()
            return jsonify({"error": "Roll number already exists"}), 400

        conn.close()
        return jsonify({"message": "Student added successfully"})

    rows = conn.execute("SELECT * FROM students").fetchall()
    conn.close()

    return jsonify([dict(row) for row in rows])

from datetime import date

@app.route("/api/issues", methods=["GET", "POST"])
def manage_issues():
    conn = get_db()

    if request.method == "POST":
        data = request.get_json(silent=True) or {}

        try:
            book_id = int(data.get("book_id"))
            student_id = int(data.get("student_id"))
        except (TypeError, ValueError):
            conn.close()
            return jsonify({"error": "Select a valid book and student"}), 400

        due_date = data.get("due_date", "")

        if not due_date:
            conn.close()
            return jsonify({"error": "Select a due date"}), 400

        try:
            date.fromisoformat(due_date)
        except ValueError:
            conn.close()
            return jsonify({"error": "Invalid due date"}), 400

        book = conn.execute(
            "SELECT quantity FROM books WHERE id = ?",
            (book_id,)
        ).fetchone()

        student = conn.execute(
            "SELECT id FROM students WHERE id = ?",
            (student_id,)
        ).fetchone()

        if not book or not student:
            conn.close()
            return jsonify({"error": "Book or student not found"}), 404

        if book["quantity"] <= 0:
            conn.close()
            return jsonify({"error": "Book is out of stock"}), 400

        conn.execute("""
            INSERT INTO issued
            (book_id, student_id, issue_date, due_date, status)
            VALUES (?, ?, ?, ?, 'Issued')
        """, (book_id, student_id, date.today().isoformat(), due_date))

        conn.execute(
            "UPDATE books SET quantity = quantity - 1 WHERE id = ?",
            (book_id,)
        )

        conn.commit()
        conn.close()

        return jsonify({"message": "Book issued successfully"})

    rows = conn.execute("""
        SELECT issued.id, books.title, students.name,
               students.roll_no, issued.issue_date,
               issued.due_date, issued.status
        FROM issued
        JOIN books ON issued.book_id = books.id
        JOIN students ON issued.student_id = students.id
        ORDER BY issued.id DESC
    """).fetchall()

    conn.close()
    return jsonify([dict(row) for row in rows])


@app.route("/api/return/<int:issue_id>", methods=["POST"])
def return_book(issue_id):
    conn = get_db()

    issue = conn.execute("""
        SELECT book_id, status
        FROM issued
        WHERE id = ?
    """, (issue_id,)).fetchone()

    if not issue:
        conn.close()
        return jsonify({"error": "Issue record not found"}), 404

    if issue["status"] != "Issued":
        conn.close()
        return jsonify({"error": "Book has already been returned"}), 400

    conn.execute(
    "UPDATE issued SET status = 'Returned', return_date = ? WHERE id = ?",
    (date.today().isoformat(), issue_id)
)

    conn.execute(
        "UPDATE books SET quantity = quantity + 1 WHERE id = ?",
        (issue["book_id"],)
    )

    conn.commit()
    conn.close()

    return jsonify({"message": "Book returned successfully"})
if __name__ == "__main__":
    initialize_db()
    app.run(debug=True)