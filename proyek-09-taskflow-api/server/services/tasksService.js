import { randomUUID } from "node:crypto";

const SORT_EXPRESSIONS = Object.freeze({
  created_at: "created_at",
  priority: "CASE priority WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END",
  due_date: "due_date",
});

const TASK_COLUMNS = Object.freeze([
  "id",
  "title",
  "description",
  "status",
  "priority",
  "due_date",
  "created_at",
  "updated_at",
]);

const COLUMN_MAP = Object.freeze({
  title: "title",
  description: "description",
  status: "status",
  priority: "priority",
  due_date: "due_date",
});

const SELECT_TASK = `SELECT ${TASK_COLUMNS.join(", ")} FROM tasks`;

function escapeLike(value) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function rowToTask(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    due_date: row.due_date,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function buildOrderBy(sort, order) {
  const direction = order === "asc" ? "ASC" : "DESC";
  if (sort === "priority") {
    return `ORDER BY ${SORT_EXPRESSIONS.priority} ${direction}, created_at DESC, id ASC`;
  }
  if (sort === "due_date") {
    return `ORDER BY (due_date IS NULL) ASC, due_date ${direction}, created_at DESC, id ASC`;
  }
  return `ORDER BY created_at ${direction}, id ASC`;
}

export function createTasksService(db) {
  const statements = {
    getById: db.prepare(`${SELECT_TASK} WHERE id = ?`),
    insert: db.prepare(`
      INSERT INTO tasks (
        id, title, description, status, priority, due_date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `),
    delete: db.prepare("DELETE FROM tasks WHERE id = ?"),
    summary: db.prepare("SELECT status, COUNT(*) AS count FROM tasks GROUP BY status"),
  };

  function getTaskById(id) {
    return rowToTask(statements.getById.get(id));
  }

  function getSummary() {
    const summary = { total: 0, todo: 0, in_progress: 0, done: 0 };
    for (const row of statements.summary.all()) {
      summary[row.status] = row.count;
      summary.total += row.count;
    }
    return summary;
  }

  function listTasks({ q, status, priority, sort, order, page, limit }) {
    const conditions = [];
    const values = [];

    if (q) {
      conditions.push("title LIKE ? ESCAPE '\\'");
      values.push(`%${escapeLike(q)}%`);
    }
    if (status) {
      conditions.push("status = ?");
      values.push(status);
    }
    if (priority) {
      conditions.push("priority = ?");
      values.push(priority);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const total = db
      .prepare(`SELECT COUNT(*) AS total FROM tasks ${where}`)
      .get(...values).total;

    const offset = (page - 1) * limit;
    const rows = db
      .prepare(
        `${SELECT_TASK} ${where} ${buildOrderBy(sort, order)} LIMIT ? OFFSET ?`,
      )
      .all(...values, limit, offset);

    return {
      data: rows.map(rowToTask),
      pagination: {
        page,
        limit,
        total,
        total_pages: total === 0 ? 0 : Math.ceil(total / limit),
      },
      summary: getSummary(),
    };
  }

  const insertTask = db.transaction((task) => {
    statements.insert.run(
      task.id,
      task.title,
      task.description,
      task.status,
      task.priority,
      task.due_date,
      task.created_at,
      task.updated_at,
    );
    return getTaskById(task.id);
  });

  function createTask(input) {
    const timestamp = new Date().toISOString();
    return insertTask({
      id: randomUUID(),
      title: input.title,
      description: input.description ?? "",
      status: input.status ?? "todo",
      priority: input.priority ?? "medium",
      due_date: input.due_date ?? null,
      created_at: timestamp,
      updated_at: timestamp,
    });
  }

  function updateTask(id, updates) {
    const existing = getTaskById(id);
    if (!existing) return null;

    const fields = Object.keys(updates);
    if (fields.length === 0) return existing;

    let updatedAt = new Date().toISOString();
    if (updatedAt <= existing.updated_at) {
      updatedAt = new Date(Date.parse(existing.updated_at) + 1).toISOString();
    }

    const assignments = fields.map((field) => `${COLUMN_MAP[field]} = ?`);
    const values = fields.map((field) => updates[field]);
    assignments.push("updated_at = ?");

    db.prepare(`UPDATE tasks SET ${assignments.join(", ")} WHERE id = ?`).run(
      ...values,
      updatedAt,
      id,
    );

    return getTaskById(id);
  }

  function deleteTask(id) {
    return statements.delete.run(id).changes > 0;
  }

  return {
    listTasks,
    getTaskById,
    createTask,
    updateTask,
    deleteTask,
    getSummary,
  };
}
