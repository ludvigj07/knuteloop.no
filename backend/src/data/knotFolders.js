export const KNOT_FOLDERS = [
  {
    id: 'Generelle',
    description: 'Vanlige knuter som passer for de fleste og gir en ryddig start.',
  },
  {
    id: 'Dobbelknuter',
    description: 'Knuter som ofte krever en venn, en gruppe eller en annen person.',
  },
  {
    id: 'Alkoholknuter',
    description: 'Knuter som er knyttet til drikking, edruvalg eller alkoholtema.',
  },
  {
    id: 'Sexknuter',
    description: 'Knuter med florting, kropp eller dating som tema.',
  },
  {
    id: 'Fordervett-knuter',
    description: 'Knuter som trenger ekstra vurdering og litt mer dommekraft.',
  },
];

const KNOT_FOLDER_BY_ID = {
  'knot-1': 'Generelle',
  'knot-2': 'Dobbelknuter',
  'knot-3': 'Generelle',
  'knot-4': 'Dobbelknuter',
  'knot-5': 'Generelle',
  'knot-6': 'Dobbelknuter',
  'board-1': 'Generelle',
  'board-2': 'Generelle',
  'board-3': 'Generelle',
  'board-4': 'Generelle',
  'board-5': 'Fordervett-knuter',
  'board-6': 'Fordervett-knuter',
  'board-7': 'Generelle',
  'board-8': 'Generelle',
  'board-9': 'Generelle',
  'board-10': 'Generelle',
  'board-11': 'Sexknuter',
  'board-12': 'Dobbelknuter',
  'board-13': 'Fordervett-knuter',
  'board-14': 'Sexknuter',
  'board-15': 'Dobbelknuter',
  'board-16': 'Sexknuter',
  'board-17': 'Generelle',
  'board-18': 'Generelle',
  'board-19': 'Generelle',
  'board-20': 'Alkoholknuter',
  'board-21': 'Fordervett-knuter',
  'board-22': 'Generelle',
  'board-23': 'Fordervett-knuter',
  'board-24': 'Generelle',
  'board-25': 'Generelle',
  'board-26': 'Dobbelknuter',
  'board-27': 'Generelle',
  'board-28': 'Generelle',
  'board-29': 'Sexknuter',
  'board-30': 'Sexknuter',
  'board-31': 'Generelle',
  'board-32': 'Generelle',
  'board-33': 'Alkoholknuter',
  'board-34': 'Dobbelknuter',
  'board-35': 'Alkoholknuter',
  'board-36': 'Dobbelknuter',
  'board-37': 'Generelle',
};

export function normalizeKnotFolder(folderId) {
  return KNOT_FOLDERS.some((folder) => folder.id === folderId)
    ? folderId
    : 'Generelle';
}

export function resolveKnotFolder(knot) {
  return normalizeKnotFolder(
    knot?.folder ?? KNOT_FOLDER_BY_ID[knot?.id] ?? 'Generelle',
  );
}
