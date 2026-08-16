import { createApp } from "./app.js";
import { createPostgresStore } from "./postgres-store.js";

const port = Number(process.env.PORT ?? 3000);

const store = process.env.DATABASE_URL ? createPostgresStore(process.env.DATABASE_URL) : undefined;

createApp({ store }).listen(port, () => {
  console.info(`Backend listening on port ${port}`);
});
