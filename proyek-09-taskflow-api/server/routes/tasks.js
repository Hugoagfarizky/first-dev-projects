import { Router } from "express";
import { createTasksController } from "../controllers/tasksController.js";

export function createTasksRouter(service) {
  const router = Router();
  const controller = createTasksController(service);

  router.get("/", controller.list);
  router.post("/", controller.create);
  router.get("/:id", controller.getById);
  router.patch("/:id", controller.update);
  router.delete("/:id", controller.remove);

  return router;
}
