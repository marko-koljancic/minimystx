export function downloadObjectAsJson(obj: unknown, filename: string): void {
  try {
    const jsonString = JSON.stringify(obj, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}.json`;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error downloading JSON file:", error);
  }
}
export function selectJsonFile(): Promise<unknown | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.style.display = "none";
    input.addEventListener("change", async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const maxSize = 20 * 1024 * 1024;
      if (file.size > maxSize) {
        resolve(null);
        return;
      }
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        resolve(parsed);
      } catch (error) {
        resolve(null);
      }
    });
    input.addEventListener("cancel", () => {
      resolve(null);
    });
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  });
}
export function sanitizeFilename(input: string): string {
  return input.replace(/[/\\:*?"<>|]/g, "").trim();
}
export function getDefaultFilename(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `minimystx-project-${year}${month}${day}`;
}
