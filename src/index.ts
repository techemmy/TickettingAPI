import express from "express";
import { Config } from "./Config/config";
import passport from "passport";
import helmet from "helmet";
import { logger } from "./logging/logger";
import session from "express-session";
import userRoutes from "./Routes/UserRoute";
import eventRoutes from "./Routes/EventRoute";
import ticketRoutes from "./Routes/TicketRoute";
import adminRouter from "./Routes/adminRouter";
import swaggerUi from "swagger-ui-express";
import swaggerDocument from "./Config/swaggerConfig";
import { authenticateJWT } from "./Utils/authUtils";
import {
    checkIfUserIsAdmin,
    checkRevokedToken,
} from "./Middlewares/AuthMiddleware";
import cookieParser from "cookie-parser";
import eventTicketTypeRouter from "./Routes/EventTicketTypeRoute";
import cors from "cors";
import { authRouter } from "./Routes/authRouter";
import bodyParser from "body-parser";
import { notificationRouter } from "./Routes/NotificationRouter";
import "./Config/PassportConfig";
import errorHandler from "./Middlewares/ErrorHandlingMiddleware";
import rateLimiter from "./Utils/rateLimiterUtils";

const SECRET = Config.SESSION_SECRET;
const app = express();

// security config and middlewares
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet());
app.use(cors());
app.use(rateLimiter);

// parse request body middlewares
app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));
app.use(bodyParser.json({ limit: "10mb" }));

// swagger docs
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// auth middlewares
app.use(
    session({
        secret: SECRET,
        resave: false,
        saveUninitialized: true,
        cookie: { secure: false, httpOnly: true, maxAge: 3600000 },
    }),
);
app.use(passport.initialize());
app.use(passport.session());
app.use(cookieParser());

// routes middlewares
app.use("/api/v1/users", checkRevokedToken, userRoutes);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/events", eventRoutes);
app.use("/api/v1", notificationRouter);
app.use("/api/v1/tickets", authenticateJWT, checkRevokedToken, ticketRoutes);
app.use("/api/v1/ticket-types", eventTicketTypeRouter);
app.use("/api/v1/admin", authenticateJWT, checkIfUserIsAdmin, adminRouter);

app.get("/home", authenticateJWT, (_req, res) => {
    logger.info("WELCOME");
    res.status(200).send({
        message: "Welcome!!",
    });
});

app.use(errorHandler);

export default app;
