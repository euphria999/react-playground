import { IMPORT_MAP_FILE_NAME } from './files';
import type { Files } from './stores';

type ImportMap = {
  imports?: Record<string, string>;
  [key: string]: unknown;
};

const CODE_FILE_PATTERN = /\.[jt]sx?$/i;
const BARE_SPECIFIER_PROTOCOL_PATTERN = /^[a-zA-Z][a-zA-Z\d+\-.]*:/;
const STATIC_IMPORT_PATTERN = /(?:import|export)\s+(?:[^'"`]*?\s+from\s+)?["']([^"'`]+)["']/g;

const isCodeFile = (fileName: string) => CODE_FILE_PATTERN.test(fileName);

const isBareModuleSpecifier = (specifier: string) => (
  !specifier.startsWith('.')
  && !specifier.startsWith('/')
  && !BARE_SPECIFIER_PROTOCOL_PATTERN.test(specifier)
);

const createAutoImportUrl = (specifier: string) => `https://esm.sh/${specifier}`;

export const collectBareModuleSpecifiers = (files: Files) => {
  const specifiers = new Set<string>();

  Object.values(files).forEach(file => {
    if (!isCodeFile(file.name)) {
      return;
    }

    STATIC_IMPORT_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null = null;

    while ((match = STATIC_IMPORT_PATTERN.exec(file.value)) !== null) {
      const specifier = match[1]?.trim();
      if (!specifier || !isBareModuleSpecifier(specifier)) {
        continue;
      }
      specifiers.add(specifier);
    }
  });

  return [...specifiers].sort();
};

const parseImportMap = (content: string) => {
  try {
    return JSON.parse(content) as ImportMap;
  } catch (error) {
    console.warn('Failed to parse import map:', error);
    return null;
  }
};

const stringifyImportMap = (importMap: ImportMap) => `${JSON.stringify(importMap, null, 2)}\n`;

export const syncImportMapFile = (
  files: Files,
  previousAutoImports: string[] = []
) => {
  const importMapFile = files[IMPORT_MAP_FILE_NAME];

  if (!importMapFile) {
    return {
      files,
      autoImportEntries: previousAutoImports,
    };
  }

  const importMap = parseImportMap(importMapFile.value);

  if (!importMap) {
    return {
      files,
      autoImportEntries: previousAutoImports,
    };
  }

  const currentImports = importMap.imports ?? {};
  const manualImports = { ...currentImports };

  previousAutoImports.forEach(specifier => {
    if (manualImports[specifier] === createAutoImportUrl(specifier)) {
      delete manualImports[specifier];
    }
  });

  const nextAutoImportEntries: string[] = [];

  collectBareModuleSpecifiers(files).forEach(specifier => {
    if (manualImports[specifier]) {
      return;
    }

    manualImports[specifier] = createAutoImportUrl(specifier);
    nextAutoImportEntries.push(specifier);
  });

  const nextImportMap = stringifyImportMap({
    ...importMap,
    imports: manualImports,
  });

  if (nextImportMap === importMapFile.value && nextAutoImportEntries.length === previousAutoImports.length) {
    const hasSameEntries = nextAutoImportEntries.every((entry, index) => entry === previousAutoImports[index]);
    if (hasSameEntries) {
      return {
        files,
        autoImportEntries: previousAutoImports,
      };
    }
  }

  return {
    files: {
      ...files,
      [IMPORT_MAP_FILE_NAME]: {
        ...importMapFile,
        value: nextImportMap,
      },
    },
    autoImportEntries: nextAutoImportEntries,
  };
};
