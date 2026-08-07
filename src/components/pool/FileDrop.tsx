import { useRef } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfigurator } from "@/lib/pool/context";
import type { UploadedFile } from "@/lib/pool/types";

interface Props {
  category: UploadedFile["category"];
  label: string;
  hint: string;
}

/** Reference uploads: plans, PDFs, drawings and site photos. */
export function FileDrop({ category, label, hint }: Props) {
  const { config, addUploads, removeUpload } = useConfigurator();
  const input = useRef<HTMLInputElement>(null);
  const files = config.uploads.filter((file) => file.category === category);

  const onFiles = (list: FileList | null) => {
    if (!list) return;
    const next: UploadedFile[] = Array.from(list).map((file) => ({
      id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      size: file.size,
      type: file.type,
      url: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      category,
    }));
    addUploads(next);
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
          Drop files here or click to browse — PDF, DWG, JPG, PNG
        </span>
      </button>
      <input
        ref={input}
        type="file"
        multiple
        accept=".pdf,.dwg,.dxf,image/*"
        className="hidden"
        onChange={(event) => onFiles(event.target.files)}
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
              <span className="min-w-0 flex-1 truncate text-[12px] font-light text-foreground">
                {file.name}
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={() => removeUpload(file.id)}>
                <X />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
