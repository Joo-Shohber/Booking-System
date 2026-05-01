import pino from "pino";

const transport = pino.transport({
  targets: [
    {
      target: "pino/file",
      options: { destination: "./logs/error.log" },
      level: "error",
    },
    {
      target: "pino/file",
      options: { destination: "./logs/combined.log" },
      level: "debug",
    },
    {
      target: "pino-pretty",
      options: { colorize: true },
    },
  ],
});

export const logger = pino(
  {
    level: process.env.NODE_ENV === "production" ? "info" : "debug",

    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "req.body.password",
      ],
      censor: "[REDACTED]",
    },
  },

  transport,
);

export default logger;
