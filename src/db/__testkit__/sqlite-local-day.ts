/** Test-local clock: only the exact SQLite current local-day call is overridden. */
import { nodeSqliteExecutor, openTestDb } from "./node-sqlite";

export function openSqliteLocalDayFixture(initialLocalDay: string) {
  const db = openTestDb();
  const native = openTestDb();
  let localDay = initialLocalDay;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    try {
      db.close();
    } finally {
      native.close();
    }
  };
  const setLocalDay = (day: string) => {
    const result = native.prepare("SELECT date(?) AS day").get(day);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || result?.day !== day)
      throw new Error("Invalid local day");
    localDay = day;
  };
  try {
    setLocalDay(initialLocalDay);
    db.function("date", { varargs: true }, (...args) => {
      if (args.length === 2 && args[0] === "now" && args[1] === "localtime")
        return localDay;
      return (
        native
          .prepare(`SELECT date(${args.map(() => "?").join(",")}) AS day`)
          .get(...args)?.day ?? null
      );
    });
  } catch (error) {
    close();
    throw error;
  }
  return { db, exec: nodeSqliteExecutor(db), setLocalDay, close };
}
