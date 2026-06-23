import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aiRouter from "./ai";
import authRouter from "./auth";
import friendsRouter from "./friends";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(friendsRouter);
router.use(aiRouter);

export default router;
