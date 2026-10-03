export function validateImportFile(file: Pick<File, 'name' | 'size'>): string {
  if (!/\.xlsx$/i.test(file.name)) return 'Selecciona un archivo Excel con extensión .xlsx.';
  if (file.size > 5 * 1024 * 1024) return 'El archivo no debe superar los 5 MB.';
  if (!file.size) return 'El archivo está vacío.';

  return '';
}

export const formatImportFileSize = (size: number) =>
  size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / (1024 * 1024)).toFixed(2)} MB`;
