import { ApiError, notFoundError, validationError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  isValidTaskId,
  validateCreateTask,
  validateListQuery,
  validateUpdateTask,
} from "../utils/validation.js";

function assertTaskId(id) {
  if (!isValidTaskId(id)) {
    throw new ApiError(400, "INVALID_ID", "ID tugas tidak valid.", [
      { field: "id", message: "ID tugas harus berupa UUID yang valid." },
    ]);
  }
}

export function createTasksController(service) {
  return {
    list: asyncHandler(async (request, response) => {
      const validation = validateListQuery(request.query);
      if (!validation.ok) throw validationError(validation.details);
      response.json(service.listTasks(validation.value));
    }),

    getById: asyncHandler(async (request, response) => {
      assertTaskId(request.params.id);
      const task = service.getTaskById(request.params.id);
      if (!task) throw notFoundError();
      response.json({ data: task });
    }),

    create: asyncHandler(async (request, response) => {
      const validation = validateCreateTask(request.body);
      if (!validation.ok) throw validationError(validation.details);
      const task = service.createTask(validation.value);
      response
        .status(201)
        .location(`/api/v1/tasks/${task.id}`)
        .json({ data: task });
    }),

    update: asyncHandler(async (request, response) => {
      assertTaskId(request.params.id);
      const validation = validateUpdateTask(request.body);
      if (!validation.ok) throw validationError(validation.details);
      const task = service.updateTask(request.params.id, validation.value);
      if (!task) throw notFoundError();
      response.json({ data: task });
    }),

    remove: asyncHandler(async (request, response) => {
      assertTaskId(request.params.id);
      const deleted = service.deleteTask(request.params.id);
      if (!deleted) throw notFoundError();
      response.status(204).end();
    }),
  };
}
