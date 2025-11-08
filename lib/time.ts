export function formatISTDateTime(date: Date): string {
  try {
    const fmt = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
    return `${fmt.format(date)} IST`;
  } catch {
    return `${date.toISOString()} IST`;
  }
}

export function formatISTTime(date: Date): string {
  try {
    const fmt = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
    return `${fmt.format(date)} IST`;
  } catch {
    return `${date.toISOString().slice(11, 19)} IST`;
  }
}


