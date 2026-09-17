import { useCallback, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, Loader2, RotateCw, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfigurator } from "@/lib/pool/context";
import type { UploadedFile } from "@/lib/pool/types";
import {
  ATTACHMENT_ACCEPT_ATTR,
  checkAttachment,
  MAX_ATTACHMENTS_PER_PROJECT,
} from "@/lib/lead/attachmentPolicy";
import { uploadAttachment } from "@/lib/lead/uploadAttachment.server";

interface Props {
  category: UploadedFile["category"];
  label: string;
  hint: string;
}

/** Reference uploads: plans, drawings and site photos (JPG/PNG/WEBP/PDF).
 * Each file gets a real, server-validated upload attempt to the private
 * `pool-shaper-attachments` bucket (P6B) -- the local thumbnail is only
 * ever a transient preview; `uploadStatus`/`storagePath` on the same
 * `UploadedFile` record are the durable, honest signal of whether it
 * actually made it to storage. */
export function FileDrop({ category, label, hint }: Props) {
  const { config, projectId, addUploads, removeUpload, setUploadStatus } = useConfigurator();
  const input = useRef<HTMLInputElement>(null);
  // Runtime-only: the actual File objects, kept just long enough to retry a
  // failed upload. Never part of canonical state (File/Blob can't be
  // serialized or persisted) -- see the module comment above.
  const fileRefs = useRef<Map<string, File>>(new Map());
  const files = config.uploads.filter((file) => file.category === category);
  const uploadFn = useServerFn(uploadAttachment);

  const attemptUpload = useCallback(
    async (id: string, file: File) => {
      setUploadStatus(id, "uploading");
      try {
        const form = new FormData();
        form.set("file", file);
        form.set("projectId", projectId);
        const result = await uploadFn({ data: form });
        setUploadStatus(id, "uploaded", result.storagePath);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Caricamento non riuscito.";
        setUploadStatus(id, "failed", null, message);
      }
    },
    [projectId, setUploadStatus, uploadFn],
  );

  const onFiles = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list);
    const remainingSlots = Math.max(0, MAX_ATTACHMENTS_PER_PROJECT - files.length);
    const accepted: { entry: UploadedFile; file: File }[] = [];
    incoming.forEach((file, index) => {
      const overLimit = index >= remainingSlots;
      const check = overLimit
        ? { ok: false, reason: `Massimo ${MAX_ATTACHMENTS_PER_PROJECT} allegati per progetto.` }
        : checkAttachment({ name: file.name, type: file.type, size: file.size });
      const id = `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`;
      accepted.push({
        entry: {
          id,
          name: file.name,
          size: file.size,
          type: file.type,
          url: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
          category,
          uploadStatus: check.ok ? "pending" : "failed",
          storagePath: null,
          ...(check.ok ? {} : { uploadError: check.reason }),
        },
        file,
      });
    });
    addUploads(accepted.map((item) => item.entry));
    for (const { entry, file } of accepted) {
      fileRefs.current.set(entry.id, file);
      if (entry.uploadStatus === "pending") void attemptUpload(entry.id, file);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="label-xs">{label}</span>
        <span className="text-[11.5px] font-light text-muted-foreground">{hint}</span>
      </div>

      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          onFiles(event.dataTransfer.files);
        }}
        className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 bg-card/30 px-6 py-9 transition-colors duration-500 hover:border-foreground/30 hover:bg-card"
      >
        <Upload className="size-4 text-muted-foreground" strokeWidth={1.25} />
        <span className="text-[12px] font-light text-muted-foreground">
          Drop files here or click to browse — JPG, PNG, WEBP, PDF
        </span>
      </button>
      <input
        ref={input}
        type="file"
        multiple
        accept={ATTACHMENT_ACCEPT_ATTR}
        className="hidden"
        onChange={(event) => {
          onFiles(event.target.files);
          event.target.value = "";
        }}
      />

      {files.length ? (
        <ul className="flex flex-col gap-2">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex items-center gap-3 rounded-xl border border-hairline bg-card/40 p-2.5"
            >
              {file.url ? (
                <img src={file.url} alt="" className="size-10 rounded-lg object-cover" />
              ) : (
                <span className="numeric flex size-10 items-center justify-center rounded-lg bg-muted text-[9px] uppercase text-muted-foreground">
                  {file.name.split(".").pop()}
                </span>
              )}
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[12px] font-light text-foreground">{file.name}</span>
                {file.uploadStatus === "uploading" ? (
                  <span className="flex items-center gap-1.5 text-[10.5px] font-light text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" strokeWidth={1.5} />
                    Caricamento…
                  </span>
                ) : file.uploadStatus === "uploaded" ? (
                  <span className="text-[10.5px] font-light text-muted-foreground">Caricato</span>
                ) : file.uploadStatus === "failed" ? (
                  <span className="flex items-center gap-1.5 text-[10.5px] font-light text-destructive">
                    <AlertCircle className="size-3" strokeWidth={1.5} />
                    {file.uploadError ?? "Caricamento non riuscito"}
                  </span>
                ) : null}
              </span>
              {file.uploadStatus === "failed" ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Riprova a caricare ${file.name}`}
                  onClick={() => {
                    const original = fileRefs.current.get(file.id);
                    if (original) void attemptUpload(file.id, original);
                  }}
                >
                  <RotateCw />
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Rimuovi ${file.name}`}
                onClick={() => {
                  fileRefs.current.delete(file.id);
                  removeUpload(file.id);
                }}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
