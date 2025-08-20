/**
 * Downloads an object as a JSON file
 * @param obj - The object to download as JSON
 * @param filename - The filename (without extension)
 */
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

    // Clean up the URL object
    URL.revokeObjectURL(url);

    console.info(`Project saved as ${filename}.json`);
  } catch (error) {
    console.error("Failed to download file:", error);
  }
}

/**
 * Opens a file picker and returns the parsed JSON content
 * @returns Promise that resolves to parsed JSON object or null if cancelled
 */
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

      // Check file size (20 MB limit)
      const maxSize = 20 * 1024 * 1024; // 20 MB in bytes
      if (file.size > maxSize) {
        console.error(
          `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum size is 20MB.`
        );
        resolve(null);
        return;
      }

      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        resolve(parsed);
      } catch (error) {
        console.error("Invalid JSON file:", error);
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

/**
 * Sanitizes a filename by removing invalid characters
 * @param input - The input string to sanitize
 * @returns Sanitized filename string
 */
export function sanitizeFilename(input: string): string {
  // Remove invalid filename characters: / \ : * ? " < > |
  return input.replace(/[/\\:*?"<>|]/g, "").trim();
}

/**
 * Generates a default project filename with current date
 * @returns Default filename string
 */
export function getDefaultFilename(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `minimystx-project-${year}${month}${day}`;
}
