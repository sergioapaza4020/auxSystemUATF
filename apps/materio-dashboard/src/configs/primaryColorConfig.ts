export type PrimaryColorConfig = {
  name?: string;

  light: {
    main: string;
    light: string;
    dark: string;
  };

  dark: {
    main: string;
    light: string;
    dark: string;
  };
};

const primaryColorConfig: PrimaryColorConfig[] = [
  {
    name: 'primary-1',

    light: {
      main: '#003273',
      light: '#0052BC',
      dark: '#00142E',
    },

    dark: {
      main: '#4D9CFF',
      light: '#80B8FF',
      dark: '#2878D8',
    },
  },
];

export default primaryColorConfig;
