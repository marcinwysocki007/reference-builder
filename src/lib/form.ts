// Node 18 has no global `File` constructor (added in Node 20). The Web `FormData`
// returns Blob-like objects with a `name` and `arrayBuffer()` method. Duck-type instead.
export interface UploadedFile {
  name: string;
  type: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export function isUploadedFile(v: unknown): v is UploadedFile {
  return (
    typeof v === "object" &&
    v !== null &&
    "arrayBuffer" in v &&
    typeof (v as { arrayBuffer: unknown }).arrayBuffer === "function" &&
    "name" in v &&
    typeof (v as { name: unknown }).name === "string"
  );
}
