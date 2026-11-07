import { useEffect, useState } from "react";

// Update at every minute boundary and after a background tab resumes. Calendar
// rollover does not depend on new ingestion, HTTP responses or a page reload.
export function useMeteoNow(initial: Date, live: boolean) {
  const [now, setNow] = useState(initial);
  useEffect(() => {
    if (!live) { setNow(initial); return; }
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setNow(new Date());
      clearTimeout(timer);
      timer = setTimeout(tick, 60_000 - Date.now() % 60_000);
    };
    tick();
    document.addEventListener("visibilitychange", tick);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", tick); };
  }, [initial, live]);
  return now;
}
