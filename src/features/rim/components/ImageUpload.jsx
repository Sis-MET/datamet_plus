import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X } from 'lucide-react';
import { cn } from '../../../shared/utils/cn';

/** Fotos del instrumento (hasta [maxFiles]); se guardan con el RIM. */
export function ImageUpload({ maxFiles = 5, onFilesChange, files = [], error }) {
  const onDrop = useCallback((acceptedFiles) => {
    const currentFiles = files || [];
    const remainingSlots = maxFiles - currentFiles.length;
    const filesToAdd = acceptedFiles.slice(0, remainingSlots);
    if (filesToAdd.length === 0) return;
    const newFiles = [...currentFiles, ...filesToAdd].map(file => {
      if (!file.preview) {
        return Object.assign(file, { preview: URL.createObjectURL(file) });
      }
      return file;
    });
    onFilesChange(newFiles);
  }, [files, maxFiles, onFilesChange]);

  const removeFile = (index) => {
    const newFiles = [...files];
    if (newFiles[index].preview) URL.revokeObjectURL(newFiles[index].preview);
    newFiles.splice(index, 1);
    onFilesChange(newFiles);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': [], 'image/png': [], 'image/webp': [] },
    maxFiles: maxFiles - (files?.length || 0),
    disabled: (files?.length || 0) >= maxFiles,
  });

  return (
    <div className="w-full">
      <p className="field-label">Fotos del instrumento <span className="font-normal text-fg-subtle">(hasta {maxFiles}, opcional)</span></p>
      {(files?.length || 0) < maxFiles && (
        <div
          {...getRootProps()}
          className={cn(
            'cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-colors',
            isDragActive ? 'border-fg/40 bg-surface-2' : 'border-line-strong hover:border-fg/30 hover:bg-surface-2/60',
            error && 'border-danger'
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center justify-center gap-1.5">
            <Upload className="h-7 w-7 text-fg-subtle" aria-hidden="true" />
            <p className="text-sm text-fg-muted">
              <span className="font-semibold text-fg">Elija las fotos</span> o arrástrelas aquí
            </p>
            <p className="text-xs text-fg-subtle">JPG, PNG o WEBP; se reducen antes de registrarse.</p>
          </div>
        </div>
      )}
      {error && <p className="field-error">{error.message}</p>}
      {files && files.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {files.map((file, index) => (
            <div key={file.name + index} className="group relative aspect-square overflow-hidden rounded-xl border border-line bg-surface-2">
              <img src={file.preview} alt={file.name} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeFile(index)}
                aria-label={`Quitar ${file.name}`}
                className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-surface/90 text-fg shadow-xs transition-colors hover:bg-danger hover:text-surface"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
