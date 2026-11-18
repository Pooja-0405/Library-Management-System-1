let books = [];

async function loadStats() {
    const response = await fetch("/api/stats");
    const data = await response.json();

    document.getElementById("totalBooks").innerText =
        data.total_books;

    document.getElementById("totalStudents").innerText =
        data.students;

    document.getElementById("issuedBooks").innerText =
        data.issued_books;

    updateChart(data);
}

async function loadBooks() {
    const response = await fetch("/api/books");
    books = await response.json();

    displayBooks();

    const select = document.getElementById("issueBookSelect");

    if (select) {
        select.innerHTML = '<option value="">Select Book</option>';

        books.forEach(book => {
            if (book.quantity > 0) {
                const option = document.createElement("option");
                option.value = book.id;
                option.textContent = book.title +
                    " (Available: " + book.quantity + ")";
                select.appendChild(option);
            }
        });
    }
}


async function addBook() {
    const title = document.getElementById("title").value.trim();
    const author = document.getElementById("author").value.trim();
    const category = document.getElementById("category").value.trim();
    const quantity = Number(document.getElementById("quantity").value);

    if (!title || !author || !category ||
        !Number.isInteger(quantity) || quantity < 0) {
        alert("Please enter valid book details");
        return;
    }

    const response = await fetch("/api/books", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            title,
            author,
            category,
            quantity
        })
    });

    if (!response.ok) {
        alert("Unable to add book");
        return;
    }

    alert("Book added successfully!");

    document.getElementById("title").value = "";
    document.getElementById("author").value = "";
    document.getElementById("category").value = "";
    document.getElementById("quantity").value = "";

    await loadBooks();
    await loadStats();
}

function displayBooks() {
    const search = document.getElementById("search")
        .value.toLowerCase();

    const filtered = books.filter(book =>
        book.title.toLowerCase().includes(search) ||
        book.author.toLowerCase().includes(search)
    );

    document.getElementById("bookList").innerHTML =
        filtered.map(book => `
        <tr>
            <td>${book.id}</td>
            <td>${escapeHTML(book.title)}</td>
            <td>${escapeHTML(book.author)}</td>
            <td>${escapeHTML(book.category || "")}</td>
            <td>${book.quantity}</td>
        </tr>
    `).join("");
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

let chart;

function updateChart(data) {
    const ctx = document.getElementById("libraryChart");

    if (chart) chart.destroy();

    chart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: ["Books", "Students", "Issued"],
            datasets: [{
                label: "Library Statistics",
                data: [
                    data.total_books,
                    data.students,
                    data.issued_books
                ],
                backgroundColor: [
                    "#2563eb",
                    "#16a34a",
                    "#f59e0b"
                ]
            }]
        },
        options: {
            responsive: true
        }
    });
}

loadBooks();
loadStats();
async function loadStudents() {
    const response = await fetch("/api/students");
    const students = await response.json();
    const select = document.getElementById("issueStudentSelect");

if (select) {
    select.innerHTML = '<option value="">Select Student</option>';

    students.forEach(student => {
        const option = document.createElement("option");
        option.value = student.id;
        option.textContent = student.name + " (" + student.roll_no + ")";
        select.appendChild(option);
    });
}

    const list = document.getElementById("studentList");
    list.innerHTML = "";

    students.forEach(student => {
        const row = document.createElement("tr");

        [student.id, student.name, student.roll_no]
            .forEach(value => {
                const cell = document.createElement("td");
                cell.textContent = value;
                row.appendChild(cell);
            });

        list.appendChild(row);
    });
}

async function addStudent() {
    const name = document.getElementById("studentName").value.trim();
    const roll = document.getElementById("rollNo").value.trim();

    if (!name || !roll) {
        alert("Please enter student details");
        return;
    }

    const response = await fetch("/api/students", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            name: name,
            roll_no: roll
        })
    });

    const result = await response.json();

    if (!response.ok) {
        alert(result.error);
        return;
    }

    alert("Student registered successfully!");

    document.getElementById("studentName").value = "";
    document.getElementById("rollNo").value = "";

    await loadStudents();
    await loadStats();
}

loadStudents();
async function issueBook() {
    const bookId = document.getElementById("issueBookSelect").value;
    const studentId = document.getElementById("issueStudentSelect").value;
    const dueDate = document.getElementById("dueDate").value;

    if (!bookId || !studentId || !dueDate) {
        alert("Please select a book, student and due date");
        return;
    }

    const response = await fetch("/api/issues", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            book_id: bookId,
            student_id: studentId,
            due_date: dueDate
        })
    });

    const result = await response.json();

    if (!response.ok) {
        alert(result.error);
        return;
    }

    alert(result.message);

    document.getElementById("issueBookSelect").value = "";
    document.getElementById("issueStudentSelect").value = "";
    document.getElementById("dueDate").value = "";

    await loadBooks();
    await loadIssues();
    await loadStats();
}

async function loadIssues() {
    const response = await fetch("/api/issues");
    const issues = await response.json();

    const list = document.getElementById("issueList");

    if (!list) return;

    list.innerHTML = "";

    issues.forEach(issue => {
        const row = document.createElement("tr");

        const values = [
            issue.id,
            issue.title,
            issue.name,
            issue.roll_no,
            issue.issue_date,
            issue.due_date,
            issue.status
        ];

        values.forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value ?? "";
            row.appendChild(cell);
        });

        const actionCell = document.createElement("td");

        if (issue.status === "Issued") {
            const button = document.createElement("button");
            button.textContent = "Return";
            button.onclick = () => returnBook(issue.id);
            actionCell.appendChild(button);
        } else {
            actionCell.textContent = "Completed";
        }

        row.appendChild(actionCell);
        list.appendChild(row);
    });
}

async function returnBook(id) {
    if (!confirm("Confirm book return?")) return;

    const response = await fetch("/api/return/" + id, {
        method: "POST"
    });

    const result = await response.json();

    if (!response.ok) {
        alert(result.error);
        return;
    }

    alert(result.message);

    await loadBooks();
    await loadIssues();
    await loadStats();
}

loadIssues();