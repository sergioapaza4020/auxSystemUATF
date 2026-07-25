export type PrimaryColorConfig = {
  name?: string;
  light?: string;
  main: string;
  dark?: string;
};

// Primary color config object
const primaryColorConfig: PrimaryColorConfig[] = [
  {
    name: 'primary-1',
    light: '#0052bcff',
    main: '#003273ff',
    dark: '#00142E',
  },
];

export default primaryColorConfig;
