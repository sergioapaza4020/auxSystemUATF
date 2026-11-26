"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

const config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,css}"],
  corePlugins: {
    preflight: false,
  },
  important: "#__next",
  plugins: [
    require("tailwindcss-logical"),
    require("./src/@core/tailwind/plugin"),
  ],
  theme: {
    extend: {},
  },
};

exports.default = config;
/* v7-7b3fe7720c947533 */
