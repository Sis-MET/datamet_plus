import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X } from 'lucide-react';
import { cn } from '../../../shared/utils/cn';

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
    accept: { 'image/*': [] },
    maxFiles: maxFiles - (files?.length || 0),
    disabled: (files?.length || 0) >= maxFiles
  });

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-300 mb-2">
        Evidencias Fotográficas (Máx {maxFiles})
      </label>
      {(files?.length || 0) < maxFiles && (
        <div
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
            isDragActive ? "border-primary-500 bg-primary-900/20" : "border-gray-600 hover:border-primary-500 hover:bg-[#1e1e1e]",
            error && "border-red-500 bg-red-900/20"
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center justify-center space-y-2">
            <Upload className="h-8 w-8 text-gray-500" />
            <p className="text-sm text-gray-300">
              <span className="font-semibold text-primary-400">Click para subir</span> o arrastra imágenes aquí
            </p>
            <p className="text-xs text-gray-500">PNG, JPG hasta 5MB</p>
          </div>
        </div>
      )}
      {error && <p className="mt-1 text-sm text-red-500">{error.message}</p>}
      {files && files.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {files.map((file, index) => (
            <div key={file.name + index} className="relative group aspect-square rounded-lg overflow-hidden bg-[#2a2a2a] border border-gray-700">
              <img src={file.preview} alt={file.name} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
