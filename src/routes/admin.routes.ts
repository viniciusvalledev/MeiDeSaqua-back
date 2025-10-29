import { Router } from "express";
import { AdminController } from "../controllers/AdminController";
import { adminAuthMiddleware } from "../middlewares/adminAuth.middleware";

const router = Router();

router.post("/login", AdminController.login);

router.get("/pending", adminAuthMiddleware, AdminController.getPending);
router.post(
  "/approve/:id",
  adminAuthMiddleware,
  AdminController.approveRequest
);
router.post(
  "/edit-and-approve/:id",
  adminAuthMiddleware,
  AdminController.editAndApproveRequest
);
router.post(
    "/approve/:id", 
    adminAuthMiddleware, 
    AdminController.approveRequest
);
router.post(
    "/reject/:id", 
    adminAuthMiddleware, 
    AdminController.rejectRequest
);
router.get(
  "/estabelecimentos-ativos",
  adminAuthMiddleware,
  AdminController.getAllActiveEstabelecimentos
);
router.patch(
  "/estabelecimento/:id",
  adminAuthMiddleware,
  AdminController.adminUpdateEstabelecimento
);
router.delete("/estabelecimento/:id",
   adminAuthMiddleware, 
   AdminController.adminDeleteEstabelecimento
  );

export default router;
